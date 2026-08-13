# m0vi0 portfolio site

Static site, no build step. Structure:

```
index.html              — landing page
assets/style.css         — shared styles for every page
writeups/wifi-heatmap.html    — CASE_004 (draft, fill in [bracketed] parts)
writeups/deauth-wazuh.html    — CASE_003 (draft, fill in [bracketed] parts)
```

## Before you publish

1. In `index.html`, replace:
   - `[email protected]` (two spots)
   - `https://linkedin.com/in/your-handle`
   - `https://github.com/your-handle`
2. Fill in every `[bracketed]` section in the two writeup pages with your
   actual commands, numbers, and screenshots. Delete the red "DRAFT" box at
   the top of each once done.
3. Once a writeup is real, change its case card status in `index.html` from
   `<div class="case-status status-progress">DRAFT</div>` to
   `<div class="case-status status-complete">READ WRITEUP</div>`.

## Hosting on GitHub Pages

1. Create a new **public** repo named exactly `yourusername.github.io`
   (this exact naming is what makes GitHub auto-host it as your root site).
2. Push everything in this folder to the root of that repo:
   ```bash
   git init
   git add .
   git commit -m "portfolio site"
   git branch -M main
   git remote add origin https://github.com/yourusername/yourusername.github.io.git
   git push -u origin main
   ```
3. In the repo, go to **Settings → Pages** and confirm the source is set to
   the `main` branch, root folder. (Usually auto-detected for this repo name.)
4. Site goes live at `https://yourusername.github.io` within a minute or two.

Any time you push new commits to `main`, the live site updates automatically —
no separate deploy step.
