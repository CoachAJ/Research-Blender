# Production Deployment Guide

## Problem
The YouTube transcript feature requires a Python backend server, which is not included in static frontend deployments (Netlify, Vercel, etc.).

## Solution: Deploy Backend to Render (Free)

### Step 1: Deploy Python Backend to Render

1. **Go to [Render.com](https://render.com)** and sign up/login

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository: `https://github.com/CoachAJ/Research-Blender`

3. **Configure the Service**
   - **Name**: `research-blender-api`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: `server`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python app.py`
   - **Instance Type**: `Free`

4. **Add Environment Variables** (if needed in future)
   - Currently none required

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (2-3 minutes)
   - Copy the service URL (e.g., `https://research-blender-api.onrender.com`)

### Step 2: Update Frontend to Use Production Backend

Update `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
```

### Step 3: Configure Environment Variables

**For Local Development** (`.env.local`):
```env
VITE_API_URL=http://localhost:5000
```

**For Production** (Netlify/Vercel):
Add environment variable:
```
VITE_API_URL=https://research-blender-api.onrender.com
```

### Step 4: Update Frontend Code

Update `services/geminiService.ts` to use environment variable:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const fetchYoutubeTranscript = async (url: string) => {
  const response = await fetch(`${API_BASE_URL}/youtube/transcript`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  // ... rest of code
};
```

## Alternative: Netlify Functions (Serverless)

If you prefer to keep everything on Netlify:

1. Create `netlify/functions/youtube-transcript.js`:

```javascript
const { YouTubeTranscriptApi } = require('youtube-transcript-api');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { url } = JSON.parse(event.body);
    const api = new YouTubeTranscriptApi();
    const transcript = await api.fetch(url);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        transcript: transcript.map(t => t.text).join(' ')
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
```

2. Update frontend to call `/.netlify/functions/youtube-transcript`

## Recommended Approach

**Use Render for Backend** - It's free, easy, and keeps the architecture clean.

## Testing Production

After deployment:
1. Open browser console (F12)
2. Try adding a YouTube URL
3. Check Network tab for API calls
4. Verify transcript is fetched successfully

## Troubleshooting

**CORS Errors**: Make sure Flask CORS is enabled (already done in `server/app.py`)

**Backend Not Responding**: Check Render logs for errors

**404 on API calls**: Verify the API_URL environment variable is set correctly
