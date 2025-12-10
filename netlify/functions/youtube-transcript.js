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

// Multiple client configurations to try (in order of preference)
const CLIENT_CONFIGS = [
  // iOS client - often less restricted
  {
    context: {
      client: {
        clientName: "IOS",
        clientVersion: "19.29.1",
        deviceMake: "Apple",
        deviceModel: "iPhone16,2",
        hl: "en",
        gl: "US",
      }
    },
    userAgent: "com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)"
  },
  // Android client - same as Python library
  {
    context: {
      client: {
        clientName: "ANDROID",
        clientVersion: "19.30.36",
        androidSdkVersion: 34,
        hl: "en",
        gl: "US",
      }
    },
    userAgent: "com.google.android.youtube/19.30.36 (Linux; U; Android 14) gzip"
  },
  // TV HTML5 client - embedded player, sometimes less restricted
  {
    context: {
      client: {
        clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
        clientVersion: "2.0",
        hl: "en",
        gl: "US",
      }
    },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  }
];

/**
 * Fetch transcript using YouTube's Innertube API with optional OAuth token
 * When authenticated, requests are less likely to be blocked
 */
async function fetchTranscriptDirect(videoId, accessToken = null) {
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
  console.log('Step 2: Got API key, trying different client configurations...');
  if (accessToken) {
    console.log('Using OAuth access token for authenticated requests');
  }
  
  // Step 2: Try each client configuration until one works
  let innertubeData = null;
  let lastError = null;
  
  for (let i = 0; i < CLIENT_CONFIGS.length; i++) {
    const config = CLIENT_CONFIGS[i];
    console.log(`Trying client ${i + 1}/${CLIENT_CONFIGS.length}: ${config.context.client.clientName}`);
    
    try {
      const innertubeUrl = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`;
      
      // Build headers - add Authorization if we have an access token
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': config.userAgent,
        'X-Youtube-Client-Name': config.context.client.clientName === 'IOS' ? '5' : 
                                 config.context.client.clientName === 'ANDROID' ? '3' : '85',
        'X-Youtube-Client-Version': config.context.client.clientVersion,
        'Origin': 'https://www.youtube.com',
        'Referer': 'https://www.youtube.com/',
      };
      
      // Add OAuth token if provided
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
      
      const innertubeResponse = await fetch(innertubeUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          context: config.context,
          videoId: videoId,
        })
      });
      
      if (!innertubeResponse.ok) {
        lastError = new Error(`Innertube API request failed: ${innertubeResponse.status}`);
        continue;
      }
      
      const data = await innertubeResponse.json();
      
      // Check playability status
      const playabilityStatus = data.playabilityStatus?.status;
      if (playabilityStatus === 'OK') {
        // Check if we have captions
        if (data.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
          innertubeData = data;
          console.log(`Success with ${config.context.client.clientName} client!`);
          break;
        } else {
          lastError = new Error('No captions available');
        }
      } else {
        const reason = data.playabilityStatus?.reason || 'Unknown';
        console.log(`${config.context.client.clientName} failed: ${playabilityStatus} - ${reason}`);
        lastError = new Error(`${playabilityStatus}: ${reason}`);
      }
    } catch (err) {
      console.log(`${config.context.client.clientName} error: ${err.message}`);
      lastError = err;
    }
  }
  
  if (!innertubeData) {
    throw lastError || new Error('All client configurations failed');
  }
  
  console.log('Step 3: Got innertube data, extracting captions...');
  
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
 * Extract captions directly from YouTube video page HTML
 * This method extracts the timedtext URL from the page and fetches captions directly
 */
async function fetchTranscriptFromPage(videoId) {
  console.log('Trying to extract captions from video page HTML...');
  
  const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  const pageResponse = await fetch(videoPageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Cookie': 'CONSENT=YES+cb.20210328-17-p0.en+FX+917'
    }
  });
  
  if (!pageResponse.ok) {
    throw new Error(`Failed to fetch video page: ${pageResponse.status}`);
  }
  
  const html = await pageResponse.text();
  
  // Try to find captions in the ytInitialPlayerResponse
  const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});(?:var|<\/script>)/s);
  if (!playerResponseMatch) {
    console.log('Could not find ytInitialPlayerResponse');
    return null;
  }
  
  try {
    const playerResponse = JSON.parse(playerResponseMatch[1]);
    const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    
    if (!captions || captions.length === 0) {
      console.log('No caption tracks found in player response');
      return null;
    }
    
    // Find English captions or use the first available
    let captionTrack = captions.find(c => c.languageCode === 'en' || c.languageCode?.startsWith('en'));
    if (!captionTrack) {
      captionTrack = captions[0];
    }
    
    console.log(`Found caption track: ${captionTrack.languageCode} - ${captionTrack.name?.simpleText || 'unnamed'}`);
    
    // Fetch the caption XML
    const captionUrl = captionTrack.baseUrl;
    const captionResponse = await fetch(captionUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    
    if (!captionResponse.ok) {
      console.log(`Failed to fetch caption XML: ${captionResponse.status}`);
      return null;
    }
    
    const captionXml = await captionResponse.text();
    
    // Parse the XML
    const segments = [];
    const regex = /<text start="([^"]+)" dur="([^"]+)"[^>]*>([^<]*)<\/text>/g;
    let match;
    while ((match = regex.exec(captionXml)) !== null) {
      segments.push({
        start: parseFloat(match[1]),
        duration: parseFloat(match[2]),
        text: match[3]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/\n/g, ' ')
          .trim()
      });
    }
    
    if (segments.length > 0) {
      console.log(`Successfully extracted ${segments.length} caption segments from page`);
      return {
        segments,
        fullText: segments.map(s => s.text).join(' ')
      };
    }
    
    return null;
  } catch (e) {
    console.log('Error parsing player response:', e.message);
    return null;
  }
}

/**
 * Fetch transcript from third-party APIs that have solved IP blocking
 */
async function fetchTranscriptFromThirdParty(videoId) {
  const apis = [
    // Supadata YouTube Transcript API (free tier available)
    {
      name: 'Supadata',
      fetch: async () => {
        const response = await fetch(`https://api.supadata.ai/v1/youtube/transcript?video_id=${videoId}&text=true`, {
          headers: {
            'Accept': 'application/json',
          }
        });
        if (!response.ok) return null;
        const data = await response.json();
        if (data.content) {
          return {
            segments: [{ start: 0, duration: 0, text: data.content }],
            fullText: data.content
          };
        }
        return null;
      }
    },
    // youtubetranscript.com (scraping service)
    {
      name: 'YouTubeTranscript.com',
      fetch: async () => {
        const response = await fetch(`https://youtubetranscript.com/?server_vid2=${videoId}`);
        if (!response.ok) return null;
        const text = await response.text();
        
        // Parse the XML response
        const segments = [];
        const regex = /<text start="([^"]+)" dur="([^"]+)"[^>]*>([^<]*)<\/text>/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
          segments.push({
            start: parseFloat(match[1]),
            duration: parseFloat(match[2]),
            text: match[3]
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&#39;/g, "'")
              .trim()
          });
        }
        
        if (segments.length > 0) {
          return {
            segments,
            fullText: segments.map(s => s.text).join(' ')
          };
        }
        return null;
      }
    },
    // Tactiq transcript API
    {
      name: 'Tactiq',
      fetch: async () => {
        const response = await fetch(`https://tactiq-apps-prod.tactiq.io/transcript?videoId=${videoId}&langCode=en`);
        if (!response.ok) return null;
        const data = await response.json();
        
        if (data.captions && data.captions.length > 0) {
          const segments = data.captions.map((c) => ({
            start: c.start / 1000,
            duration: c.dur / 1000,
            text: c.text
          }));
          return {
            segments,
            fullText: segments.map(s => s.text).join(' ')
          };
        }
        return null;
      }
    }
  ];
  
  for (const api of apis) {
    try {
      console.log(`Trying ${api.name}...`);
      const result = await api.fetch();
      if (result && result.fullText && result.fullText.length > 50) {
        console.log(`${api.name} succeeded: ${result.fullText.length} chars`);
        return result;
      }
      console.log(`${api.name}: No valid transcript returned`);
    } catch (error) {
      console.log(`${api.name} error:`, error.message);
    }
  }
  
  return null;
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
    const { url, accessToken } = JSON.parse(event.body);
    
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
    
    // Try multiple methods to fetch transcript
    let result = null;
    let lastError = null;
    
    // Method 1: Try extracting captions directly from video page HTML (most reliable)
    try {
      console.log('Method 1: Trying to extract captions from video page...');
      result = await fetchTranscriptFromPage(videoId);
      if (result) {
        console.log('Page extraction succeeded!');
      }
    } catch (e) {
      console.log('Page extraction failed:', e.message);
      lastError = e;
    }
    
    // Method 2: Try third-party transcript APIs (they have residential IPs)
    if (!result) {
      try {
        console.log('Method 2: Trying third-party APIs...');
        result = await fetchTranscriptFromThirdParty(videoId);
        if (result) {
          console.log('Third-party API succeeded!');
        }
      } catch (e) {
        console.log('Third-party APIs failed:', e.message);
        lastError = e;
      }
    }
    
    // Method 3: Try direct Innertube API (may fail due to IP blocking)
    if (!result) {
      try {
        console.log('Method 3: Trying direct Innertube API...');
        result = await fetchTranscriptDirect(videoId);
      } catch (e) {
        console.log('Innertube API failed:', e.message);
        lastError = e;
      }
    }
    
    if (!result) {
      throw lastError || new Error('All transcript fetch methods failed');
    }
    
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
