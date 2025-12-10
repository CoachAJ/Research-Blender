# Research Blender

**AI-Powered Research Synthesis Tool** - Transform multiple sources into cohesive, well-structured articles using Google's Gemini AI.

## Features

- **Multi-Source Input**: YouTube videos, web articles, images, audio recordings, and text notes
- **YouTube Transcript Extraction**: Automatically fetches transcripts from any public YouTube video
- **AI-Powered Synthesis**: Gemini AI blends all sources into a unified narrative
- **Cover Image Generation**: Generate AI cover art based on article content
- **Modern UI**: Beautiful, responsive interface with glass morphism effects

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React Frontend │────▶│  Vite Dev Server │────▶│  Python Backend  │
│   (Port 3000)    │     │     (Proxy)      │     │   (Port 5000)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │ youtube-transcript│
                                               │       -api       │
                                               └─────────────────┘
```

## Prerequisites

- **Node.js** (v18+)
- **Python** (v3.9+)
- **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/)

## Setup

### 1. Install Frontend Dependencies

```bash
npm install
```

### 2. Install Python Backend Dependencies

```bash
cd server
pip install -r requirements.txt
```

### 3. Configure Environment

Create/edit `.env.local` in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

## Running the Application

### Local Development

**Start the Frontend:**
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

**Note**: YouTube transcript fetching works via Netlify Functions in production. For local development, you can either:
- Use the Netlify CLI: `netlify dev` (recommended)
- Or run the Python backend separately (see `server/` folder)

### Production Deployment (Netlify)

1. **Connect to Netlify**:
   - Push code to GitHub
   - Import repository in Netlify
   - Netlify will auto-detect settings from `netlify.toml`

2. **Deploy**:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`

3. **Done!** YouTube transcripts will work automatically via serverless functions.

## How It Works

1. **Add Sources**: Use the Source Hopper to add:
   - YouTube URLs (transcripts auto-extracted)
   - Web article URLs (content fetched via Google Search grounding)
   - Text notes (direct input)
   - Images/Videos (analyzed by Gemini Vision)
   - Audio recordings (transcribed by Gemini)

2. **Blend**: Click "Blend Research" to synthesize all sources

3. **Export**: Copy, download, or share your generated article

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite
- **Backend**: Flask, youtube-transcript-api
- **AI**: Google Gemini 2.5 Flash (text), Gemini 3 Pro (vision)

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/youtube/transcript` | POST | Fetch YouTube transcript |
| `/api/youtube/info` | POST | Get video metadata |

## License

MIT
