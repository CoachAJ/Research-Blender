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

/**
 * Fetch transcript using YouTube's timedtext API directly
 */
async function fetchTranscriptDirect(videoId) {
  // First, get the video page to extract caption track info
  const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  const response = await fetch(videoPageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch video page: ${response.status}`);
  }
  
  const html = await response.text();
  
  // Log a snippet for debugging
  console.log('Page length:', html.length);
  
  // Try multiple patterns to find caption tracks
  let captionTracks = null;
  
  // Pattern 1: Look for captionTracks in the player response
  const pattern1 = /"captionTracks":\s*(\[[\s\S]*?\])(?=\s*[,}])/;
  const match1 = html.match(pattern1);
  if (match1) {
    try {
      captionTracks = JSON.parse(match1[1]);
      console.log('Found captions with pattern 1:', captionTracks.length, 'tracks');
    } catch (e) {
      console.log('Pattern 1 parse failed:', e.message);
    }
  }
  
  // Pattern 2: Look for timedtext URL directly
  if (!captionTracks) {
    const pattern2 = /https:\/\/www\.youtube\.com\/api\/timedtext[^"]+/g;
    const matches = html.match(pattern2);
    if (matches && matches.length > 0) {
      // Unescape the URL
      const captionUrl = matches[0].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
      console.log('Found timedtext URL directly:', captionUrl.substring(0, 100));
      
      // Fetch the transcript directly
      const transcriptResponse = await fetch(captionUrl);
      if (transcriptResponse.ok) {
        const transcriptXml = await transcriptResponse.text();
        return parseTranscriptXml(transcriptXml);
      }
    }
  }
  
  // Pattern 3: Look in ytInitialPlayerResponse
  if (!captionTracks) {
    const pattern3 = /ytInitialPlayerResponse\s*=\s*(\{[\s\S]*?\});/;
    const match3 = html.match(pattern3);
    if (match3) {
      try {
        const playerResponse = JSON.parse(match3[1]);
        captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (captionTracks) {
          console.log('Found captions in ytInitialPlayerResponse:', captionTracks.length, 'tracks');
        }
      } catch (e) {
        console.log('Pattern 3 parse failed:', e.message);
      }
    }
  }
  
  // Pattern 4: Search for baseUrl with timedtext
  if (!captionTracks) {
    const pattern4 = /"baseUrl"\s*:\s*"(https:[^"]*timedtext[^"]*)"/;
    const match4 = html.match(pattern4);
    if (match4) {
      const captionUrl = match4[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
      console.log('Found baseUrl with timedtext:', captionUrl.substring(0, 100));
      
      const transcriptResponse = await fetch(captionUrl);
      if (transcriptResponse.ok) {
        const transcriptXml = await transcriptResponse.text();
        return parseTranscriptXml(transcriptXml);
      }
    }
  }
  
  if (!captionTracks || captionTracks.length === 0) {
    // Check if video exists but has no captions
    if (html.includes('"playabilityStatus"')) {
      if (html.includes('"isLive":true') || html.includes('"isLiveContent":true')) {
        throw new Error('Live videos do not have transcripts');
      }
      throw new Error('No captions available for this video');
    }
    throw new Error('Could not find video or captions');
  }
  
  // Get the first available caption track (prefer English)
  let track = captionTracks.find(t => t.languageCode === 'en' || t.vssId?.includes('.en')) || captionTracks[0];
  let captionUrl = track.baseUrl;
  
  // Unescape URL if needed
  captionUrl = captionUrl.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
  
  console.log('Fetching caption URL:', captionUrl.substring(0, 100));
  
  // Fetch the actual transcript
  const transcriptResponse = await fetch(captionUrl);
  if (!transcriptResponse.ok) {
    throw new Error(`Failed to fetch transcript: ${transcriptResponse.status}`);
  }
  
  const transcriptXml = await transcriptResponse.text();
  return parseTranscriptXml(transcriptXml);
}

/**
 * Parse XML transcript into segments
 */
function parseTranscriptXml(transcriptXml) {
  const segments = [];
  
  // Handle both XML formats
  const textMatches = transcriptXml.matchAll(/<text[^>]*start="([^"]+)"[^>]*dur="([^"]+)"[^>]*>([^<]*)<\/text>/g);
  
  for (const match of textMatches) {
    const start = parseFloat(match[1]);
    const duration = parseFloat(match[2]);
    // Decode HTML entities
    let text = match[3]
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
  
  // Try alternative pattern if no matches
  if (segments.length === 0) {
    const altMatches = transcriptXml.matchAll(/<p[^>]*t="(\d+)"[^>]*d="(\d+)"[^>]*>([^<]*)<\/p>/g);
    for (const match of altMatches) {
      const start = parseInt(match[1]) / 1000;
      const duration = parseInt(match[2]) / 1000;
      let text = match[3].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
      if (text) {
        segments.push({ start, duration, text });
      }
    }
  }
  
  if (segments.length === 0) {
    console.log('Transcript XML sample:', transcriptXml.substring(0, 500));
    throw new Error('Could not parse transcript XML');
  }
  
  console.log('Parsed', segments.length, 'segments');
  
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
