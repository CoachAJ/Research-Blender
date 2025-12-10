# Troubleshooting Guide

## YouTube Transcripts Not Working in Netlify

### Check 1: Verify Functions Are Deployed

1. Go to your Netlify site dashboard
2. Click on "Functions" tab
3. You should see:
   - `youtube-transcript`
   - `youtube-info`
   - `health`

If functions are missing, check build logs.

### Check 2: Test Function Directly

Open your browser console and run:

```javascript
fetch('https://YOUR-SITE.netlify.app/.netlify/functions/youtube-transcript', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
})
.then(r => r.json())
.then(console.log)
```

Replace `YOUR-SITE` with your actual Netlify site name.

**Expected Response:**
```json
{
  "success": true,
  "video_id": "dQw4w9WgXcQ",
  "transcript": "..."
}
```

### Check 3: View Function Logs

1. Netlify Dashboard → Functions
2. Click on `youtube-transcript`
3. Click "Function log" tab
4. Try fetching a transcript in your app
5. Check for errors in the logs

### Common Issues & Solutions

#### Issue: "Function not found" (404)

**Solution:**
- Ensure `netlify.toml` is in the root directory
- Verify `functions = "netlify/functions"` in netlify.toml
- Check that function files are in `netlify/functions/` folder
- Redeploy the site

#### Issue: "Module not found: youtubei.js"

**Solution:**
- Ensure `netlify/functions/package.json` exists
- Contains `"youtubei.js": "^16.0.1"` in dependencies
- Redeploy (Netlify will auto-install)

#### Issue: Function timeout

**Solution:**
- YouTube API might be slow
- Try a different video
- Check if video has captions enabled

#### Issue: CORS errors

**Solution:**
- Functions should already have CORS headers
- Check browser console for specific error
- Verify you're calling `/api/youtube/transcript` not `/.netlify/functions/...`

### Check 4: Verify Build Settings

In Netlify Dashboard → Site Settings → Build & Deploy:

- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Functions directory:** `netlify/functions`
- **Node version:** 18 (from .nvmrc)

### Check 5: Test with Known Working Video

Try these videos (known to have transcripts):
- `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- `https://www.youtube.com/watch?v=jNQXAC9IVRw`

### Check 6: Browser Console Errors

Open DevTools (F12) → Console tab

Look for:
- Network errors (red in Network tab)
- JavaScript errors
- Failed fetch requests

### Manual Function Test

You can test the function locally before deploying:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Run local dev server with functions
netlify dev

# Test in browser at http://localhost:8888
```

### Still Not Working?

1. **Check Netlify Build Logs:**
   - Dashboard → Deploys → Click latest deploy
   - Look for errors during build
   - Verify functions were bundled

2. **Verify Function Endpoint:**
   - Open: `https://YOUR-SITE.netlify.app/.netlify/functions/health`
   - Should return: `{"status":"ok","service":"research-blender-api","platform":"netlify-functions"}`

3. **Check Video Availability:**
   - Some videos don't have transcripts
   - Private/age-restricted videos won't work
   - Try multiple different videos

4. **Redeploy:**
   - Sometimes a fresh deploy fixes issues
   - Dashboard → Deploys → Trigger deploy → Deploy site

### Debug Mode

Add this to your browser console to see detailed errors:

```javascript
localStorage.setItem('debug', 'true');
```

Then try fetching a transcript and check console for detailed logs.

### Contact Support

If none of these work:
1. Check Netlify Status: https://www.netlifystatus.com/
2. Review Netlify Function docs: https://docs.netlify.com/functions/overview/
3. Check GitHub Issues for youtubei.js
