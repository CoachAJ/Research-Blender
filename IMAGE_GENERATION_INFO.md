# Image Generation Information

## Current Image Model
**Model**: `gemini-2.5-flash-image` (Nano Banana)
- Fast image generation
- Supports text-to-image
- Supports image-to-image with editing instructions
- Can incorporate reference images

## Recent Updates

### 1. YouTube Transcript Processing
**Changed**: YouTube transcripts are NO LONGER summarized when added to sources
- **Before**: Transcripts were immediately summarized using Gemini AI
- **After**: Raw transcripts are preserved and will be processed during the blend stage
- **Benefit**: More accurate synthesis with full context available during blending

### 2. Image Reference Incorporation
**New Feature**: Uploaded images can now be incorporated into generated cover art

**How it works**:
1. Upload images as sources (via the Media tab)
2. When generating cover art, the system automatically:
   - Extracts all uploaded image sources
   - Passes them as reference images to the AI model
   - Instructs the model to incorporate visual elements, style, or composition from the references

**Example Use Cases**:
- Upload a logo → Generated cover will incorporate the logo style
- Upload product photos → Generated cover will reference the product aesthetics
- Upload brand imagery → Generated cover will match brand visual identity

### 3. Editable Image Prompts
**New Feature**: Image generation prompts are now visible and editable

**Workflow**:
1. Click "Generate AI Cover"
2. AI generates a descriptive prompt
3. Modal appears showing the prompt
4. Edit the prompt to customize:
   - Art style (e.g., "cyberpunk", "watercolor")
   - Composition (e.g., "add mountains")
   - Colors, mood, subject matter
5. Click "Generate Image" to create with your custom prompt

## Technical Details

### Image Generation Function
```typescript
generateCoverImage(
  prompt: string,
  referenceImages?: string[]  // Base64 data URLs
): Promise<string>
```

### Reference Image Format
- Accepts base64-encoded data URLs
- Supports: PNG, JPEG, WebP
- Automatically extracts from uploaded Image sources
- Multiple reference images supported

## Console Logging
The system now logs:
- "Starting image generation..."
- "Generating prompt..."
- "Prompt generated: [preview]"
- "Modal should be visible now"
- "Generating image with X reference image(s)"

Check browser console (F12) for debugging information.
