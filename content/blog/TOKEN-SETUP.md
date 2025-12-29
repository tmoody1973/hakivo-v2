# 🔑 Sanity Token Setup

Your current token doesn't have write permissions. Follow these steps to create a proper token:

## Step-by-Step Instructions

### 1. Go to Sanity Management Console
Visit: https://sanity.io/manage/personal/project/s583epdw

Or:
1. Go to https://sanity.io/manage
2. Click on "hakivo" project

### 2. Navigate to API Tokens
- Click **API** in the left sidebar
- Click **Tokens** tab

### 3. Create New Token
1. Click **Add API token**
2. Fill in:
   - **Name**: `Blog Import CLI`
   - **Permissions**: Select **Editor** ⚠️ (NOT "Viewer")
3. Click **Add token**

### 4. Copy the Token
- **Important**: Copy it now - you won't see it again!
- It should look like: `sk...`

### 5. Add to .env.local
In your project root (`/Users/tarikmoody/Documents/Projects/hakivo-v2`):

```bash
# .env.local
SANITY_TOKEN=sk_your_actual_token_here
```

**Make sure** `.env.local` is in your `.gitignore` (it should be already)!

### 6. Restart Your Terminal
After adding the token:
```bash
# Close and reopen your terminal, or:
source ~/.zshrc  # or ~/.bashrc
```

### 7. Test the Import Again
```bash
npm run blog:import content/blog/example-welcome-post.md
```

You should see:
```
✅ Success! Draft created with ID: drafts.xxx
📝 Edit in Studio: https://hakivo.sanity.studio/...
```

## Token Permissions Explained

| Permission | Can Read | Can Create | Can Edit | Can Delete |
|-----------|----------|-----------|----------|------------|
| Viewer    | ✅       | ❌        | ❌       | ❌         |
| Editor    | ✅       | ✅        | ✅       | ✅         |
| Admin     | ✅       | ✅        | ✅       | ✅         |

**For blog imports, you need at least Editor permissions.**

## Security Notes

- ✅ Keep tokens in `.env.local` (never commit to git)
- ✅ Use Editor role (not Admin unless you need it)
- ✅ Rotate tokens periodically
- ❌ Never share tokens publicly
- ❌ Never commit tokens to GitHub

## Troubleshooting

### "SANITY_TOKEN not found"
- Make sure `.env.local` exists in project root
- Check the file contains: `SANITY_TOKEN=sk...`
- Restart terminal after adding

### "Insufficient permissions"
- Token needs **Editor** or **Admin** role
- Recreate token with correct permissions
- Update `.env.local` with new token

### "Invalid token"
- Token may have been deleted or expired
- Create a new token
- Update `.env.local`

## Quick Reference

```bash
# Project: hakivo
# Project ID: s583epdw
# Dataset: production
# Required Permission: Editor
```

Token management: https://sanity.io/manage/personal/project/s583epdw/api/tokens
