# 📝 Import Blog Posts with Claude Code (Easiest Method!)

## 🎯 The Simplest Way

Since you have Sanity MCP configured, you can import blog posts directly through Claude Code!

###Step 1: Create Your Markdown File

Create a file in `content/blog/`, for example:

```markdown
---
title: "My Amazing Post"
slug: "my-amazing-post"
author: "Your Name"
publishedAt: "2025-01-15"
excerpt: "A great post about..."
tags:
  - product
  - feature
---

# My Amazing Post

Your content here...
```

### Step 2: Ask Claude to Import It

Just say:

> "Import the blog post from content/blog/my-post.md to Sanity"

Claude will:
1. Read your markdown file
2. Parse the frontmatter
3. Use the Sanity MCP `create_document_from_markdown` tool
4. Create a draft in Sanity

### Step 3: Edit in Sanity Studio

1. Open https://hakivo.sanity.studio
2. Find your draft
3. Add images, polish formatting
4. Publish!

## 📋 Example Conversation with Claude

**You**: "Create a blog post about our new features"

**Claude**: *writes the blog post*

**You**: "Save that to content/blog/new-features.md"

**Claude**: *saves the file*

**You**: "Now import it to Sanity"

**Claude**: *uses Sanity MCP to create the draft*

## 🛠️ Alternative: Manual Studio Creation

If you prefer the Sanity Studio UI:

1. Go to https://hakivo.sanity.studio
2. Click "Blog Post"
3. Fill in fields
4. Write content in the rich text editor
5. Publish

## 🎨 Tips for Best Results

### With Claude:
- Ask Claude to write posts in markdown format
- Request specific frontmatter fields
- Have Claude save directly to `content/blog/`
- Then import with one command

### In Studio:
- Use the rich text editor for complex formatting
- Upload images directly through Sanity
- Preview as you write
- Categories and tags auto-complete

## 📚 More Resources

- [Full Workflow Guide](./WORKFLOW.md)
- [Blog Setup Documentation](../../hakivo-api/studio-hakivo/BLOG-SETUP.md)
- [Sanity Studio](https://hakivo.sanity.studio)
