/**
 * Extract YouTube video ID from various URL formats
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

// Innertube API configuration (from youtube-transcript-api Python library)
const INNERTUBE_CONTEXT = {
  client: {
    clientName: "WEB",
    clientVersion: "2.20240313.05.00",
    hl: "en",
    gl: "US",
  }
};

/**
 * Fetch transcript using YouTube's Innertube API
 * Based on the approach from youtube-transcript-api Python library
 */
async function fetchTranscriptDirect(videoId) {
  console.log('Step 1: Fetching video page to get API key...');
  
  // Step 1: Fetch the video page to get the INNERTUBE_API_KEY
  const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  const pageResponse = await fetch(videoPageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
  });
  
  if (!pageResponse.ok) {
    throw new Error(`Failed to fetch video page: ${pageResponse.status}`);
  }
  
  const html = await pageResponse.text();
  console.log('Page fetched, length:', html.length);
  
  // Check for consent page
  if (html.includes('action="https://consent.youtube.com/s"')) {
    throw new Error('YouTube consent page detected - region may require consent');
  }
  
  // Extract INNERTUBE_API_KEY
  const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/);
  if (!apiKeyMatch) {
    // Check if IP is blocked
    if (html.includes('class="g-recaptcha"')) {
      throw new Error('IP blocked by YouTube - recaptcha detected');
    }
    throw new Error('Could not extract INNERTUBE_API_KEY from page');
  }
  
  const apiKey = apiKeyMatch[1];
  console.log('Step 2: Got API key, fetching innertube data...');
  
  // Step 2: Call the Innertube API to get video data including captions
  const innertubeUrl = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`;
  
  const innertubeResponse = await fetch(innertubeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: JSON.stringify({
      context: INNERTUBE_CONTEXT,
      videoId: videoId,
    })
  });
  
  if (!innertubeResponse.ok) {
    throw new Error(`Innertube API request failed: ${innertubeResponse.status}`);
  }
  
  const innertubeData = await innertubeResponse.json();
  console.log('Step 3: Got innertube data, extracting captions...');
  
  // Check playability status
  const playabilityStatus = innertubeData.playabilityStatus?.status;
  if (playabilityStatus !== 'OK') {
    const reason = innertubeData.playabilityStatus?.reason || 'Unknown reason';
    if (playabilityStatus === 'LOGIN_REQUIRED') {
      if (reason.includes('bot')) {
        throw new Error('Request blocked - bot detection');
      }
      if (reason.includes('inappropriate')) {
        throw new Error('Video is age restricted');
      }
    }
    if (playabilityStatus === 'ERROR') {
      throw new Error(`Video unavailable: ${reason}`);
    }
    throw new Error(`Video not playable: ${reason}`);
  }
  
  // Extract captions
  const captionsData = innertubeData.captions?.playerCaptionsTracklistRenderer;
  if (!captionsData || !captionsData.captionTracks) {
    throw new Error('No captions/transcripts available for this video');
  }
  
  const captionTracks = captionsData.captionTracks;
  console.log('Found', captionTracks.length, 'caption tracks');
  
  // Find the best caption track (prefer English, then any manual, then auto-generated)
  let selectedTrack = captionTracks.find(t => t.languageCode === 'en' && t.kind !== 'asr');
  if (!selectedTrack) {
    selectedTrack = captionTracks.find(t => t.languageCode === 'en');
  }
  if (!selectedTrack) {
    selectedTrack = captionTracks.find(t => t.kind !== 'asr');
  }
  if (!selectedTrack) {
    selectedTrack = captionTracks[0];
  }
  
  console.log('Selected track:', selectedTrack.languageCode, selectedTrack.kind || 'manual');
  
  // Step 3: Fetch the actual transcript XML
  let captionUrl = selectedTrack.baseUrl;
  // Remove srv3 format to get plain XML
  captionUrl = captionUrl.replace('&fmt=srv3', '');
  
  console.log('Step 4: Fetching transcript from:', captionUrl.substring(0, 80) + '...');
  
  const transcriptResponse = await fetch(captionUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });
  
  if (!transcriptResponse.ok) {
    throw new Error(`Failed to fetch transcript: ${transcriptResponse.status}`);
  }
  
  const transcriptXml = await transcriptResponse.text();
  console.log('Got transcript XML, length:', transcriptXml.length);
  
  return parseTranscriptXml(transcriptXml);
}

/**
 * Parse XML transcript into segments
 */
function parseTranscriptXml(transcriptXml) {
  const segments = [];
  
  // Pattern for standard timedtext XML format
  const textMatches = transcriptXml.matchAll(/<text[^>]*start="([^"]+)"[^>]*(?:dur="([^"]+)")?[^>]*>([\s\S]*?)<\/text>/g);
  
  for (const match of textMatches) {
    const start = parseFloat(match[1]);
    const duration = match[2] ? parseFloat(match[2]) : 0;
    // Decode HTML entities and clean up text
    let text = match[3]
      .replace(/<[^>]*>/g, '') // Remove any nested tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\n/g, ' ')
      .trim();
    
    if (text) {
      segments.push({ start, duration, text });
    }
  }
  
  if (segments.length === 0) {
    console.log('Transcript XML sample:', transcriptXml.substring(0, 500));
    throw new Error('Could not parse transcript XML - no text segments found');
  }
  
  console.log('Successfully parsed', segments.length, 'segments');
  
  return {
    segments,
    fullText: segments.map(s => s.text).join(' ')
  };
}

/**
 * Netlify Function Handler
 * Fetches YouTube transcript
 */
exports.handler = async (event) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS request for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' })
    };
  }

  let videoId = null;
  
  try {
    // Parse request body
    const { url } = JSON.parse(event.body);
    
    if (!url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'URL is required' })
      };
    }

    // Extract video ID
    videoId = extractVideoId(url);
    if (!videoId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid YouTube URL or video ID' })
      };
    }

    console.log(`Fetching transcript for video: ${videoId}`);
    
    // Fetch transcript using direct method
    const result = await fetchTranscriptDirect(videoId);
    
    console.log(`Successfully fetched transcript: ${result.segments.length} segments, ${result.fullText.length} chars`);
    
    // Return success response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        video_id: videoId,
        transcript: result.fullText,
        segments: result.segments
      })
    };

  } catch (error) {
    console.error('Error fetching transcript:', error.message);
    
    let errorMessage = 'Could not fetch transcript';
    let statusCode = 500;
    
    const errorMsg = error.message?.toLowerCase() || '';
    
    if (errorMsg.includes('no captions') || errorMsg.includes('no caption')) {
      errorMessage = 'No captions/transcript available for this video';
      statusCode = 404;
    } else if (errorMsg.includes('private') || errorMsg.includes('unavailable')) {
      errorMessage = 'Video is private or unavailable';
      statusCode = 404;
    } else {
      errorMessage = `Failed to fetch transcript: ${error.message}`;
    }
    
    return {
      statusCode,
      headers,
      body: JSON.stringify({
        success: false,
        error: errorMessage,
        videoId: videoId
      })
    };
  }
};
