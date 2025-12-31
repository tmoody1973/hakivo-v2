# Automatic YouTube Link Detection and Embedding

**Date:** December 31, 2025
**Type:** Feature Enhancement
**Component:** Blog Post Renderer

## Summary
Implemented automatic YouTube link detection and embedding in blog posts. Users can now paste YouTube URLs as plain text in Sanity, and they will automatically be converted to embedded videos on the frontend.

## Changes Made

### Blog Post Renderer Enhancement
- **File:** `/app/blog/[slug]/page.tsx`
- Added custom `normal` block renderer to PortableText components
- Automatically detects YouTube URLs in plain text content
- Converts detected URLs to embedded YouTube videos with 16:9 aspect ratio
- Maintains surrounding text while replacing URLs with embeds

## How It Works

1. **Detection:** The system uses regex to identify YouTube URLs in paragraph text
2. **Extraction:** Video IDs are extracted from various YouTube URL formats
3. **Replacement:** URLs are replaced with iframe embeds while preserving surrounding text
4. **Formats Supported:**
   - `https://www.youtube.com/watch?v=VIDEO_ID`
   - `https://youtu.be/VIDEO_ID`
   - `https://youtube.com/embed/VIDEO_ID`
   - `https://youtube.com/v/VIDEO_ID`

## User Benefits

- **Simplified Content Creation:** No need to use the YouTube block type in Sanity
- **Natural Writing Flow:** Just paste YouTube links as you would in any text
- **Backward Compatible:** Existing YouTube blocks continue to work
- **Flexible:** Works with any YouTube URL format

## Example Usage

In Sanity, users can now write:
```
Check out this video: https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

And it will automatically render as an embedded video on the frontend.

## Technical Implementation

```typescript
// Custom normal paragraph renderer
normal: ({ children }) => {
  // Process children to find and replace YouTube URLs
  const processChildren = (child: any): any => {
    if (typeof child === 'string') {
      // Detect YouTube URLs with regex
      // Replace with iframe embeds
      // Return processed content
    }
    // Handle arrays and other types
  }

  return <p className="mb-4">{processedChildren}</p>
}
```

## Commit Reference
- Commit: `1be50c00` - feat: add automatic YouTube link detection and embedding in blog posts