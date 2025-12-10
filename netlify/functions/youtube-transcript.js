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
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch video page: ${response.status}`);
  }
  
  const html = await response.text();
  
  // Extract captions data from the page
  const captionsMatch = html.match(/"captions":\s*(\{[^}]+?"playerCaptionsTracklistRenderer"[^}]+?\})/);
  
  if (!captionsMatch) {
    // Try alternative pattern
    const altMatch = html.match(/\"captionTracks\":(\[.*?\])/);
    if (!altMatch) {
      throw new Error('No captions available for this video');
    }
    
    try {
      const captionTracks = JSON.parse(altMatch[1]);
      if (captionTracks.length === 0) {
        throw new Error('No caption tracks found');
      }
      
      // Get the first available caption track (prefer English)
      let track = captionTracks.find(t => t.languageCode === 'en') || captionTracks[0];
      const captionUrl = track.baseUrl;
      
      // Fetch the actual transcript
      const transcriptResponse = await fetch(captionUrl);
      if (!transcriptResponse.ok) {
        throw new Error(`Failed to fetch transcript: ${transcriptResponse.status}`);
      }
      
      const transcriptXml = await transcriptResponse.text();
      
      // Parse XML transcript
      const segments = [];
      const textMatches = transcriptXml.matchAll(/<text start="([^"]+)" dur="([^"]+)"[^>]*>([^<]*)<\/text>/g);
      
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
          .replace(/\n/g, ' ')
          .trim();
        
        if (text) {
          segments.push({ start, duration, text });
        }
      }
      
      if (segments.length === 0) {
        throw new Error('Could not parse transcript');
      }
      
      return {
        segments,
        fullText: segments.map(s => s.text).join(' ')
      };
    } catch (e) {
      throw new Error(`Failed to parse captions: ${e.message}`);
    }
  }
  
  throw new Error('Could not extract caption data from video page');
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
