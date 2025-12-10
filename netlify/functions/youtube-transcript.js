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

// Cache the Innertube instance
let youtube = null;

async function getYouTubeClient() {
  if (!youtube) {
    // Dynamic import for ES Module compatibility
    const { Innertube } = await import('youtubei.js');
    youtube = await Innertube.create();
  }
  return youtube;
}

/**
 * Netlify Function Handler
 * Fetches YouTube transcript
 */
exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' })
    };
  }

  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS request for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Parse request body
    const { url } = JSON.parse(event.body);
    
    if (!url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'URL is required'
        })
      };
    }

    // Extract video ID
    const videoId = extractVideoId(url);
    if (!videoId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Invalid YouTube URL or video ID'
        })
      };
    }

    // Get YouTube client
    const yt = await getYouTubeClient();
    
    // Fetch video info
    const info = await yt.getInfo(videoId);
    
    // Get transcript
    const transcriptData = await info.getTranscript();
    
    if (!transcriptData || !transcriptData.transcript) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'No transcript/captions found for this video'
        })
      };
    }

    // Extract transcript content
    const segments = transcriptData.transcript.content.body.initial_segments;
    
    if (!segments || segments.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Transcript is empty'
        })
      };
    }

    // Combine all segments into full text
    const fullTranscript = segments
      .map(seg => seg.snippet?.text || '')
      .filter(text => text.trim())
      .join(' ');
    
    // Return success response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        video_id: videoId,
        transcript: fullTranscript,
        segments: segments.map(seg => ({
          start: seg.start_ms / 1000, // Convert to seconds
          duration: seg.end_ms ? (seg.end_ms - seg.start_ms) / 1000 : 0,
          text: seg.snippet?.text || ''
        })).filter(seg => seg.text.trim())
      })
    };

  } catch (error) {
    console.error('Error fetching transcript:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      videoId: videoId
    });
    
    // Determine error type and return appropriate message
    let errorMessage = 'Could not fetch transcript';
    let statusCode = 500;
    
    const errorMsg = error.message?.toLowerCase() || '';
    
    if (errorMsg.includes('disabled') || errorMsg.includes('subtitle')) {
      errorMessage = 'Transcripts/captions are disabled for this video';
      statusCode = 404;
    } else if (errorMsg.includes('unavailable') || errorMsg.includes('private')) {
      errorMessage = 'Video is unavailable or private';
      statusCode = 404;
    } else if (errorMsg.includes('not found') || errorMsg.includes('could not find')) {
      errorMessage = 'No transcript/captions found for this video';
      statusCode = 404;
    } else if (errorMsg.includes('transcript')) {
      errorMessage = `Transcript error: ${error.message}`;
      statusCode = 404;
    } else {
      // Include actual error for debugging in production
      errorMessage = `Failed to fetch transcript: ${error.message}`;
      console.error('Full error stack:', error.stack);
    }
    
    return {
      statusCode,
      headers,
      body: JSON.stringify({
        success: false,
        error: errorMessage,
        videoId: videoId,
        debug: {
          message: error.message,
          name: error.name,
          // Include more debug info to help diagnose
          errorType: error.constructor.name
        }
      })
    };
  }
};
