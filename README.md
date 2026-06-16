# saadmemon.com — portfolio

## Deploy to Netlify (free, ~60 seconds)

1. Go to https://netlify.com and sign up (free)
2. Drag the entire `portfolio` folder onto the Netlify dashboard
3. Done — you get a URL like `saad-memon-xyz.netlify.app`
4. To use `saadmemon.com`: go to Site Settings → Domain Management → Add custom domain

---

## Before you go live — swap these placeholders

### 1. Add your video (featured reel)
In `index.html`, find the comment `<!-- SWAP THIS -->` and replace the placeholder div with:
```html
<iframe src="https://www.youtube.com/embed/YOUR_VIDEO_ID" allowfullscreen></iframe>
```
Get YOUR_VIDEO_ID from your YouTube video URL: youtube.com/watch?v=**THIS_PART**

### 2. Update your email
Search for `your@email.com` (3 places) and replace with your real email.

### 3. Link your SoundCloud
Find `https://soundcloud.com` in the footer and replace with your actual SoundCloud profile URL.

### 4. Link your projects
Each project card has `href="#"` — replace with:
- Karachi Sonification → a YouTube/Vimeo link or a SoundCloud track
- Music Production → your SoundCloud profile or a specific playlist
- Sound Design Reel → your reel YouTube link

### 5. Copyright year
Update `© 2025 Saad Memon` in the footer if needed.

---

## File structure
```
portfolio/
  index.html     ← the whole site, everything in one file
  README.md      ← this file
```

That's it. One file = easy to update, fast to load, works everywhere.
