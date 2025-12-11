/**
 * Research Blender - YouTube Transcript Extension
 * Fetches transcripts using the user's residential IP
 */

// Listen for messages from the Research Blender web app
chrome.runtime.onMessageExternal.addListener(
  (request, sender, sendResponse) => {
    console.log('Received request:', request);
    
    if (request.action === 'ping') {
      // Health check - app uses this to detect if extension is installed
      sendResponse({ success: true, version: '1.0.0' });
      return true;
    }
    
    if (request.action === 'getTranscript') {
      const videoId = request.videoId;
      
      if (!videoId) {
        sendResponse({ success: false, error: 'No video ID provided' });
        return true;
      }
      
      // Fetch transcript asynchronously
      fetchTranscript(videoId)
        .then(result => {
          console.log('Transcript fetched successfully');
          sendResponse(result);
        })
        .catch(error => {
          console.error('Error fetching transcript:', error);
          sendResponse({ success: false, error: error.message });
        });
      
      // Return true to indicate we'll respond asynchronously
      return true;
    }
    
    sendResponse({ success: false, error: 'Unknown action' });
    return true;
  }
);

/**
 * Extract video ID from various YouTube URL formats
 */
function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^#&?]{11})/,
    /(?:youtube\.com\/shorts\/)([^#&?]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  // Check if it's already just a video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }
  
  return null;
}

/**
 * Fetch transcript from YouTube
 */
async function fetchTranscript(videoId) {
  console.log('Fetching transcript for video:', videoId);
  
  // Step 1: Fetch the video page to get caption info
  const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  const pageResponse = await fetch(videoPageUrl, {
    credentials: 'include', // Include cookies for better success rate
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });
  
  if (!pageResponse.ok) {
    throw new Error(`Failed to fetch video page: ${pageResponse.status}`);
  }
  
  const html = await pageResponse.text();
  
  // Step 2: Extract ytInitialPlayerResponse which contains caption URLs
  const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});(?:var|<\/script>)/s);
  if (!playerResponseMatch) {
    throw new Error('Could not find player response in page');
  }
  
  let playerResponse;
  try {
    playerResponse = JSON.parse(playerResponseMatch[1]);
  } catch (e) {
    throw new Error('Failed to parse player response');
  }
  
  // Check if video is playable
  const playabilityStatus = playerResponse?.playabilityStatus?.status;
  if (playabilityStatus !== 'OK') {
    const reason = playerResponse?.playabilityStatus?.reason || 'Video unavailable';
    throw new Error(reason);
  }
  
  // Step 3: Get caption tracks
  const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  
  if (!captions || captions.length === 0) {
    throw new Error('No captions available for this video');
  }
  
  // Find English captions or use the first available
  let captionTrack = captions.find(c => 
    c.languageCode === 'en' || 
    c.languageCode?.startsWith('en') ||
    c.vssId?.includes('.en')
  );
  
  if (!captionTrack) {
    captionTrack = captions[0];
    console.log('No English captions, using:', captionTrack.languageCode);
  }
  
  console.log('Using caption track:', captionTrack.languageCode, captionTrack.name?.simpleText);
  
  // Step 4: Fetch the caption XML
  const captionUrl = captionTrack.baseUrl;
  const captionResponse = await fetch(captionUrl);
  
  if (!captionResponse.ok) {
    throw new Error(`Failed to fetch captions: ${captionResponse.status}`);
  }
  
  const captionXml = await captionResponse.text();
  
  // Step 5: Parse the XML into segments
  const segments = [];
  const regex = /<text start="([^"]+)" dur="([^"]+)"[^>]*>([^<]*)<\/text>/g;
  let match;
  
  while ((match = regex.exec(captionXml)) !== null) {
    const text = match[3]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\n/g, ' ')
      .trim();
    
    if (text) {
      segments.push({
        start: parseFloat(match[1]),
        duration: parseFloat(match[2]),
        text: text
      });
    }
  }
  
  if (segments.length === 0) {
    throw new Error('Could not parse caption data');
  }
  
  const fullText = segments.map(s => s.text).join(' ');
  
  console.log(`Parsed ${segments.length} segments, ${fullText.length} chars`);
  
  return {
    success: true,
    videoId: videoId,
    transcript: fullText,
    segments: segments,
    language: captionTrack.languageCode
  };
}

// Log when extension loads
console.log('Research Blender YouTube Transcript Extension loaded');
