# 📝 Markdown to Sanity Blog Workflow

Write blog posts in Markdown with Claude Code, then push to Sanity for final polish!

## 🚀 Quick Start

### 1. Create a Markdown File

```bash
# Copy the template
cp content/blog/_template.md content/blog/my-first-post.md
```

### 2. Write Your Post

Edit the file with frontmatter metadata and markdown content:

```markdown
---
title: "Introducing Hakivo 2.0"
slug: "introducing-hakivo-2"
author: "Tarik Moody"
publishedAt: "2025-01-15"
excerpt: "We're excited to announce major improvements to Hakivo"
tags:
  - product
  - announcement
categories:
  - announcements
---

# Introducing Hakivo 2.0

We're thrilled to announce...
```

### 3. Get Your Sanity Token

**One-time setup:**

1. Go to https://sanity.io/manage
2. Select your project (hakivo - s583epdw)
3. Go to **API** → **Tokens**
4. Click **Add API token**
5. Name: `Blog Import Script`
6. Permissions: **Editor**
7. Copy the token

Add to your `.env.local`:
```bash
SANITY_TOKEN=your_token_here
```

### 4. Import to Sanity

```bash
npm run blog:import content/blog/my-first-post.md
```

You'll see:
```
📖 Reading: content/blog/my-first-post.md
📝 Converting: "Introducing Hakivo 2.0"
🚀 Pushing to Sanity...
✅ Success! Draft created with ID: drafts.abc123
📝 Edit in Studio: http://localhost:3333/structure/blogPost;abc123
```

### 5. Polish in Sanity Studio

1. Open http://localhost:3333
2. Find your draft post
3. Add/adjust images
4. Fine-tune formatting
5. **Publish!**

## 📋 Frontmatter Fields

### Required
- `title`: Post headline
- `slug`: URL-friendly slug
- `publishedAt`: Publication date (YYYY-MM-DD)

### Optional
- `author`: Author name
- `excerpt`: Summary for preview cards
- `tags`: Array of tags
- `categories`: Array of category names
- `featuredImage`: { url, alt }
- `seo`: { metaDescription, metaKeywords }

## ✍️ Markdown Features Supported

### Headings
```markdown
# H1 Heading
## H2 Heading
### H3 Heading
```

### Text Formatting
```markdown
**Bold text**
*Italic text*
[Links](https://example.com)
```

### Blockquotes
```markdown
> Important quote or callout
```

### Lists
```markdown
- Bullet point
- Another point

1. Numbered item
2. Another item
```

### Images
```markdown
![Alt text](https://example.com/image.jpg)
```

## 🎯 Best Practices

### 1. Write in Claude Code
- Use Claude to help draft content
- Get Claude to research and fact-check
- Let Claude suggest headlines and excerpts

### 2. Keep Markdown Simple
- Use basic markdown (headings, lists, links, bold/italic)
- Add complex formatting in Sanity Studio later
- Images can be added in Studio for better control

### 3. Use Frontmatter
- Set all metadata upfront
- Makes imports consistent
- Easy to version control

### 4. Review in Studio
- Always review imported posts
- Add featured images via Sanity's image manager
- Fine-tune portable text formatting
- Preview before publishing

## 🔄 Workflow Examples

### Example 1: Quick Announcement

```bash
# 1. Create from template
cp content/blog/_template.md content/blog/feature-launch.md

# 2. Write in your editor (or ask Claude!)
# Edit feature-launch.md

# 3. Import
npm run blog:import content/blog/feature-launch.md

# 4. Polish in Studio and publish
```

### Example 2: Detailed Tutorial

```bash
# 1. Ask Claude to write a tutorial
# "Write a tutorial blog post about..."

# 2. Save Claude's output to content/blog/tutorial.md

# 3. Import to Sanity
npm run blog:import content/blog/tutorial.md

# 4. Add screenshots and code examples in Studio
# 5. Publish
```

### Example 3: Batch Import

```bash
# Import multiple posts
npm run blog:import content/blog/post1.md
npm run blog:import content/blog/post2.md
npm run blog:import content/blog/post3.md

# Then review all drafts in Studio
```

## 🐛 Troubleshooting

### "SANITY_TOKEN not found"
Add your token to `.env.local`:
```bash
SANITY_TOKEN=sk_your_token_here
```

### "Missing required frontmatter fields"
Make sure you have:
- title
- slug
- publishedAt

### "Slug already exists"
Change the slug in your frontmatter to something unique.

### Images not showing
Images with URLs in frontmatter need to be:
1. Uploaded to Sanity Studio manually, OR
2. Use Sanity's image manager in the Studio

## 📂 Folder Structure

```
content/blog/
├── _template.md          # Copy this for new posts
├── WORKFLOW.md          # This guide
├── 2025-01-15-post1.md  # Your posts
└── 2025-01-16-post2.md
```

## 🎨 Advanced: Custom Markdown Processing

The import script converts basic markdown to Portable Text. For advanced features:

1. Import the basic structure
2. Use Sanity Studio to add:
   - Call-out boxes
   - Embedded media
   - Custom components
   - Advanced formatting

## 📚 Resources

- [Markdown Guide](https://www.markdownguide.org/)
- [Sanity Portable Text](https://www.sanity.io/docs/portable-text)
- [Blog Setup Guide](../../hakivo-api/studio-hakivo/BLOG-SETUP.md)

## 💡 Pro Tips

1. **Version Control**: Keep markdown files in git
2. **Claude Assistance**: Ask Claude to draft posts
3. **Batch Writing**: Write multiple posts, import later
4. **SEO First**: Set meta descriptions in frontmatter
5. **Preview**: Always preview in Studio before publishing
