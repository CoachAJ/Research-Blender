const { YoutubeTranscript } = require('youtube-transcript');

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

    // Fetch transcript
    const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);
    
    if (!transcriptData || transcriptData.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'No transcript found for this video'
        })
      };
    }

    // Combine all segments into full text
    const fullTranscript = transcriptData.map(segment => segment.text).join(' ');
    
    // Return success response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        video_id: videoId,
        transcript: fullTranscript,
        segments: transcriptData.map(seg => ({
          start: seg.offset,
          duration: seg.duration,
          text: seg.text
        }))
      })
    };

  } catch (error) {
    console.error('Error fetching transcript:', error);
    
    // Determine error type and return appropriate message
    let errorMessage = 'Could not fetch transcript';
    let statusCode = 500;
    
    if (error.message?.includes('disabled')) {
      errorMessage = 'Transcripts are disabled for this video';
      statusCode = 404;
    } else if (error.message?.includes('unavailable')) {
      errorMessage = 'Video is unavailable';
      statusCode = 404;
    } else if (error.message?.includes('not found')) {
      errorMessage = 'No transcript found for this video';
      statusCode = 404;
    }
    
    return {
      statusCode,
      headers,
      body: JSON.stringify({
        success: false,
        error: errorMessage
      })
    };
  }
};
