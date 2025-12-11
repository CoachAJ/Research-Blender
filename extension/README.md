# Research Blender - YouTube Transcript Extension

This Chrome extension fetches YouTube transcripts using your browser (residential IP), bypassing YouTube's bot detection.

## Installation (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select this `extension` folder
5. Note the **Extension ID** that appears (you'll need this)

## Setup

After installing, copy the Extension ID and add it to your Research Blender app's configuration.

The extension will automatically communicate with Research Blender when you fetch YouTube transcripts.

## How It Works

1. Research Blender sends a message to this extension with a YouTube video ID
2. The extension fetches the video page using your browser (your home IP)
3. It extracts the caption/transcript data
4. Returns the transcript to Research Blender

## Permissions

- **youtube.com**: Required to fetch video pages and transcripts
- **externally_connectable**: Allows Research Blender website to communicate with this extension

## Troubleshooting

- Make sure the extension is enabled in `chrome://extensions/`
- Check the extension's service worker console for errors (click "Inspect views: service worker")
- Ensure you're logged into YouTube in your browser for best results
