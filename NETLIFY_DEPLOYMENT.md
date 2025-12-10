# Netlify Deployment Guide

## ✅ Serverless Functions Ready!

Your Research Blender app is now configured to work with Netlify Functions for YouTube transcript fetching. No separate backend server needed!

## Quick Deploy to Netlify

### Option 1: Netlify Dashboard (Easiest)

1. **Go to [Netlify](https://app.netlify.com)**
   - Sign up or log in

2. **Import from Git**
   - Click "Add new site" → "Import an existing project"
   - Choose "Deploy with GitHub"
   - Select your repository: `CoachAJ/Research-Blender`

3. **Configure Build Settings** (Auto-detected from `netlify.toml`)
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`

4. **Deploy!**
   - Click "Deploy site"
   - Wait 2-3 minutes for build
   - Your site is live! 🎉

### Option 2: Netlify CLI

```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod
```

## What's Included

### Netlify Functions Created:
- ✅ `/api/youtube/transcript` - Fetches YouTube transcripts
- ✅ `/api/youtube/info` - Gets video metadata
- ✅ `/api/health` - Health check endpoint

### Configuration Files:
- ✅ `netlify.toml` - Build and redirect configuration
- ✅ `netlify/functions/*.js` - Serverless function handlers

## Testing Locally

To test Netlify Functions locally:

```bash
# Install Netlify CLI (if not already installed)
npm install -D netlify-cli

# Run local dev server with functions
npx netlify dev
```

This will:
- Start the Vite dev server
- Start Netlify Functions locally
- Proxy API requests correctly

## How It Works

1. **Frontend makes request**: `/api/youtube/transcript`
2. **Netlify redirects** (via `netlify.toml`): `/.netlify/functions/youtube-transcript`
3. **Serverless function runs**: Fetches transcript using `youtube-transcript` npm package
4. **Response returned**: Transcript data sent back to frontend

## Troubleshooting

### YouTube Transcripts Not Working

**Check Function Logs:**
1. Go to Netlify Dashboard
2. Click on your site
3. Go to "Functions" tab
4. Click on `youtube-transcript`
5. View logs for errors

**Common Issues:**
- Video has no captions/transcript
- Video is private or age-restricted
- Rate limiting (try again in a few minutes)

### Build Failures

**Check Build Logs:**
1. Netlify Dashboard → Site → Deploys
2. Click on failed deploy
3. View build logs

**Common Fixes:**
- Ensure `package.json` has all dependencies
- Check Node.js version (should be 18+)
- Clear cache and retry deploy

## Environment Variables

Currently, no environment variables are needed for the backend functions.

The Gemini API key is entered by users in the app settings (stored in browser localStorage).

## Custom Domain (Optional)

1. Go to Site Settings → Domain Management
2. Add custom domain
3. Follow DNS configuration instructions

## Performance

**Netlify Functions:**
- Cold start: ~1-2 seconds
- Warm start: ~100-300ms
- Free tier: 125k requests/month

**Perfect for this use case!**

## Next Steps

After deployment:
1. Test YouTube transcript fetching
2. Share your live URL!
3. Monitor function usage in Netlify Dashboard

## Support

If you encounter issues:
- Check Netlify Function logs
- Review browser console for errors
- Verify YouTube video has captions enabled
