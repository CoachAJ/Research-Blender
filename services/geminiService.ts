import { GoogleGenAI } from "@google/genai";

const API_KEY_STORAGE_KEY = 'research_blender_api_key';
const USER_PROFILE_STORAGE_KEY = 'research_blender_user_profile';

export interface UserProfile {
  name: string;
  website: string;
}

/**
 * Get the API key from localStorage
 */
export const getApiKey = (): string | null => {
  return localStorage.getItem(API_KEY_STORAGE_KEY);
};

/**
 * Set the API key in localStorage
 */
export const setApiKey = (key: string): void => {
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
};

/**
 * Remove the API key from localStorage
 */
export const clearApiKey = (): void => {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
};

/**
 * Check if API key is configured
 */
export const hasApiKey = (): boolean => {
  const key = getApiKey();
  return !!key && key.length > 0;
};

/**
 * Get user profile from localStorage
 */
export const getUserProfile = (): UserProfile | null => {
  const data = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * Set user profile in localStorage
 */
export const setUserProfile = (profile: UserProfile): void => {
  localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
};

/**
 * Check if user profile is configured
 */
export const hasUserProfile = (): boolean => {
  const profile = getUserProfile();
  return !!profile && !!profile.name;
};

const getAiClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API Key is missing. Please add your Gemini API key in Settings.");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper to convert blob/file to base64
const fileToBase64 = (file: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Checks if URL is a YouTube video
 */
const isYoutubeUrl = (url: string): boolean => {
  return /(?:youtube\.com|youtu\.be)/.test(url);
};

/**
 * Get YouTube access token from localStorage if available
 */
const getYouTubeAccessToken = (): string | null => {
  const token = localStorage.getItem('youtube_access_token');
  const expiry = localStorage.getItem('youtube_token_expiry');
  
  if (token && expiry && Date.now() < parseInt(expiry)) {
    return token;
  }
  return null;
};

/**
 * Fetches YouTube transcript via Netlify function
 * The server tries multiple methods including third-party APIs
 * If user is authenticated with YouTube, uses their credentials for better success rate
 */
const fetchYoutubeTranscript = async (url: string): Promise<{ transcript: string; videoId: string } | null> => {
  const videoId = extractVideoId(url);
  if (!videoId) {
    console.error('Could not extract video ID from URL:', url);
    return null;
  }

  console.log('Fetching transcript for video:', videoId);
  
  // Get YouTube access token if user is authenticated
  const accessToken = getYouTubeAccessToken();
  if (accessToken) {
    console.log('Using YouTube OAuth token for authenticated request');
  }

  try {
    const response = await fetch('/api/youtube/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, accessToken })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('Transcript fetch successful:', data.transcript.length, 'chars');
      return {
        transcript: data.transcript,
        videoId: data.video_id
      };
    }
    
    console.warn('Transcript fetch failed:', data.error);
    return null;
  } catch (e) {
    console.error('Transcript fetch error:', e);
    return null;
  }
};

/**
 * Parse XML transcript into plain text
 */
function parseTranscriptXml(xml: string): string | null {
  const segments: string[] = [];
  const regex = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let match;
  
  while ((match = regex.exec(xml)) !== null) {
    let text = match[1]
      .replace(/<[^>]*>/g, '') // Remove nested tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\n/g, ' ')
      .trim();
    
    if (text) {
      segments.push(text);
    }
  }
  
  return segments.length > 0 ? segments.join(' ') : null;
}

/**
 * Extract video ID from YouTube URL
 */
const extractVideoId = (url: string): string | null => {
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
};

/**
 * Normalization: Image Understanding
 * Uses gemini-3-pro-preview
 */
export const analyzeImage = async (file: File): Promise<string> => {
  const ai = getAiClient();
  const base64Data = await fileToBase64(file);

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: file.type || 'image/png',
            data: base64Data
          }
        },
        {
          text: "Analyze this image in detail. Describe the visual elements, context, text visible, and overall meaning. This description will be used as a source for a research article."
        }
      ]
    }
  });

  return response.text || "No description generated.";
};

/**
 * Normalization: Video Understanding (File Upload)
 * Uses gemini-3-pro-preview
 */
export const analyzeVideo = async (file: File): Promise<string> => {
  const ai = getAiClient();
  const base64Data = await fileToBase64(file);

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: file.type || 'video/mp4',
            data: base64Data
          }
        },
        {
          text: `You are an expert video analyst. Your task is to extract all information from this video file.
          
          1. AUDIO TRANSCRIPTION: Listen carefully to the audio and provide a detailed, near-verbatim transcript of what is said. Distinguish between speakers if possible.
          2. VISUAL DESCRIPTION: Describe key visual elements, text on screen, and actions that accompany the audio.
          3. SUMMARY: Provide a concise summary of the core message.
          
          Return this as a structured document for research synthesis.`
        }
      ]
    }
  });

  return response.text || "No summary generated.";
};

/**
 * Normalization: Audio Transcription
 * Uses gemini-2.5-flash
 */
export const transcribeAudio = async (blob: Blob): Promise<string> => {
  const ai = getAiClient();
  const base64Data = await fileToBase64(blob);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: blob.type || 'audio/webm',
            data: base64Data
          }
        },
        {
          text: "Transcribe this audio recording accurately. Include speaker differentiation if possible and summarize the key points at the end."
        }
      ]
    }
  });

  return response.text || "No transcription generated.";
};

/**
 * Normalization: URL Processing
 * YouTube: Uses Python backend with youtube-transcript-api for reliable transcript fetching
 * General Web: Uses Google Search Grounding
 */
export const processUrl = async (url: string): Promise<{ text: string; thumbnail?: string }> => {
  const ai = getAiClient();

  // --- YouTube Logic (via Python backend) ---
  if (isYoutubeUrl(url)) {
    const transcriptData = await fetchYoutubeTranscript(url);
    
    if (!transcriptData || !transcriptData.transcript) {
      throw new Error('Could not fetch transcript for this video. It may not have captions enabled.');
    }
    
    const thumbnail = `https://img.youtube.com/vi/${transcriptData.videoId}/maxresdefault.jpg`;
    
    // Return raw transcript without summarization - will be processed during blend
    return {
      text: transcriptData.transcript,
      thumbnail
    };
  } 
  
  // --- General Web Logic (Google Search Grounding) ---
  else {
    const prompt = `
      Research the following URL: ${url}. 
      Extract the main article text or content. 
      If it is a long article, provide a very detailed summary that preserves key facts, quotes, and structure.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    let content = response.text || "No content found.";
    const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (grounding && grounding.length > 0) {
      const links = grounding
        .map((chunk: any) => chunk.web?.uri)
        .filter((uri: any) => !!uri)
        .join(', ');
      if (links) {
        content += `\n\n(Sources: ${links})`;
      }
    }

    return { text: content };
  }
};

/**
 * Synthesis: The Writer
 * Uses gemini-2.5-flash
 */
export const synthesizeNarrative = async (sourcesText: string): Promise<string> => {
  const ai = getAiClient();

  const prompt = `
    You are an expert research synthesist and writer. 
    Below are several raw information sources (transcripts, descriptions, notes). 
    Your task is to "blend" them into a single, high-quality Markdown article.
    
    Guidelines:
    1. Adopt a single authoritative voice.
    2. Look for connecting threads between the sources.
    3. Use headers and subheaders to structure the narrative.
    4. Do not just list the sources (e.g., "Source A says..."). Weave the information together.
    5. Be comprehensive but concise.

    RAW SOURCES:
    ${sourcesText}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt
  });

  return response.text || "Could not synthesize article.";
};

/**
 * Visual Context: The Art Director (Prompt Generation)
 * Uses gemini-2.5-flash
 */
export const generateImagePrompt = async (articleText: string): Promise<string> => {
  const ai = getAiClient();
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `
      Read the following article and act as an Art Director.
      Write a detailed prompt for an AI image generator to create a high-quality, relevant cover image (thumbnail).
      The style should be modern, editorial, and visually striking.
      Return ONLY the prompt text.
      
      ARTICLE START:
      ${articleText.substring(0, 3000)}...
    `
  });

  return response.text || "A conceptual abstract visualization of research data.";
};

/**
 * Visual Context: Image Generation
 * Uses gemini-2.5-flash-image (Nano Banana model)
 * Can optionally incorporate reference images
 */
export const generateCoverImage = async (
  prompt: string, 
  referenceImages?: string[]
): Promise<string> => {
  const ai = getAiClient();

  // Build content parts
  const parts: any[] = [];
  
  // Add reference images if provided
  if (referenceImages && referenceImages.length > 0) {
    for (const imgData of referenceImages) {
      const cleanBase64 = imgData.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
      const mimeMatch = imgData.match(/^data:(image\/[a-zA-Z+]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: cleanBase64
        }
      });
    }
    
    // Add instruction to incorporate the reference images
    parts.push({
      text: `${prompt}\n\nIMPORTANT: Incorporate visual elements, style, or composition from the provided reference image(s) into the generated cover art.`
    });
  } else {
    parts.push({ text: prompt });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts },
    config: {
        // No responseMimeType for this model
    }
  });

  // Extract image
  for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
  }
  
  throw new Error("No image generated");
};

/**
 * Image Editing
 * Uses gemini-2.5-flash-image (Nano Banana)
 */
export const editImage = async (base64Image: string, editInstruction: string): Promise<string> => {
    const ai = getAiClient();
    
    // Extract mime type from base64 string if present, otherwise default to png
    const mimeMatch = base64Image.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

    // Ensure base64 string is clean
    const cleanBase64 = base64Image.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: cleanBase64
                    }
                },
                {
                    text: editInstruction
                }
            ]
        }
    });

     for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    
    throw new Error("No edited image generated");
};