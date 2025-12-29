# Hakivo Blog Setup Guide

## ✅ What's Been Set Up

### 1. Sanity Studio (Content Management)
- **Location**: `/hakivo-api/studio-hakivo`
- **Schema**: Blog posts and categories
- **Project ID**: `s583epdw`
- **Dataset**: `production`

### 2. Blog Schema Features
- Title, slug, author, publish date
- Rich text content with images
- Featured image with alt text
- Excerpt/summary
- Tags and categories
- SEO metadata (meta description, keywords)

### 3. Frontend Integration
- **Blog listing**: `/blog` - Anthropic-style layout with hero, featured grid, and chronological list
- **Individual posts**: `/blog/[slug]` - Full post view with portable text
- **Navigation**: Blog link added to all navigation menus (public + authenticated)
- **Sitemap**: Blog posts automatically included in sitemap.xml

## 🚀 How to Use

### Starting the Sanity Studio

```bash
cd hakivo-api/studio-hakivo
npm run dev
```

The studio will open at `http://localhost:3333`

### Creating Your First Blog Post

1. Open the studio at `http://localhost:3333`
2. Click "Blog Post" in the sidebar
3. Fill in the required fields:
   - **Title**: Post headline
   - **Slug**: Auto-generated from title (click "Generate")
   - **Published At**: Publication date
   - **Content**: Rich text editor (supports headings, links, images, formatting)
4. Optional fields:
   - Author name
   - Excerpt (recommended for preview cards)
   - Featured image (recommended for visual appeal)
   - Tags (comma-separated)
   - Categories
   - SEO metadata
5. Click **Publish** when ready

### Creating Categories

1. Click "Category" in the sidebar
2. Add title and description
3. Generate slug
4. Publish

You can then reference categories in your blog posts.

## 📁 File Structure

```
hakivo-api/studio-hakivo/
├── schemaTypes/
│   ├── blogPost.ts      # Blog post schema
│   ├── category.ts      # Category schema
│   └── index.ts         # Schema exports
├── sanity.config.ts     # Studio configuration
└── sanity.cli.ts        # CLI configuration

app/
├── blog/
│   ├── page.tsx         # Blog listing (hero + grid + list)
│   └── [slug]/
│       └── page.tsx     # Individual blog post
└── sitemap.ts           # Updated with blog posts

lib/sanity/
├── client.ts            # Sanity client configuration
├── queries.ts           # GROQ queries
└── types.ts             # TypeScript types

components/
├── conditional-nav.tsx  # Updated with /blog route
├── dashboard-header.tsx # Added Blog link
└── public-header.tsx    # Added Blog link
```

## 🎨 Design Features

The blog page uses an Anthropic-inspired layout:

1. **Hero Section**: Latest post with large image and excerpt
2. **Featured Grid**: Next 4 posts with colorful accent backgrounds
3. **All News List**: Chronological list with dates, categories, and tags
4. **Responsive**: Mobile-friendly grid and layout

## 🔧 Customization

### Changing Accent Colors

Edit `/app/blog/page.tsx`:

```typescript
const ACCENT_COLORS = [
  'bg-blue-50 dark:bg-blue-950/30',
  'bg-purple-50 dark:bg-purple-950/30',
  // Add more colors...
]
```

### Adding More Fields to Schema

Edit `/hakivo-api/studio-hakivo/schemaTypes/blogPost.ts` and add new fields, then deploy:

```bash
npx sanity schema deploy
```

## 📱 Where Blog Appears

- **Homepage**: Nav link "Blog" (between Pricing and FAQ)
- **Public Header**: Nav link for unauthenticated users
- **Dashboard Header**: Nav link for authenticated users
- **Sitemap**: Automatic SEO optimization
- **Public Routes**: `/blog` is accessible to everyone

## 🔄 Content Revalidation

- Blog listing and posts revalidate every 60 seconds
- Uses Next.js ISR (Incremental Static Regeneration)
- New posts appear within 1 minute

## 📊 SEO Optimization

All blog posts include:
- Dynamic meta titles and descriptions
- Open Graph tags for social sharing
- Twitter Card metadata
- Structured data via sitemap
- Automatic image optimization

## 🎯 Next Steps

1. **Create your first post** in the Sanity Studio
2. **Add categories** for organization
3. **Upload featured images** for visual appeal
4. **Test the blog** at `http://localhost:3000/blog`
5. **Share your posts** on social media (automatic OG images)

## 🆘 Troubleshooting

### Studio won't start
```bash
cd hakivo-api/studio-hakivo
npm install
npm run dev
```

### Posts not showing
- Check that posts are **Published** (not drafts)
- Wait 60 seconds for revalidation
- Check console for errors

### Schema changes not appearing
```bash
npx sanity schema deploy
```

## 📚 Resources

- [Sanity Documentation](https://www.sanity.io/docs)
- [Portable Text](https://www.sanity.io/docs/portable-text)
- [GROQ Query Language](https://www.sanity.io/docs/groq)
- [Next.js + Sanity](https://www.sanity.io/plugins/next-sanity)
