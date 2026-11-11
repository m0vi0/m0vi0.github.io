# m0vi0.github.io

Mervin Sequeira's portfolio, built with Vite (React, TypeScript, Tailwind and shadcn for the overlays; the 3D room is plain three.js in `src/scene/`).

- `npm install`, then `npm run dev` (http://localhost:8766) to work on it, or `npm run build && npm run preview` (http://localhost:8767) for the built site.
- Models, textures, data and `style.css` are static files in `public/assets/`; the code in `src/` is bundled.
- `.github/workflows/deploy.yml` builds and publishes on every push to `main`. In Settings → Pages, set Source to "GitHub Actions".

## Record shelf: Spotify top 40

The record player in the 3D room plays my all-time Spotify top 40. `scripts/fetch-spotify.mjs` saves them to `public/assets/data/top-tracks.json` and their covers to `public/assets/covers/`. They play through Spotify's embed: whole songs for listeners logged in to Spotify outside Safari, 30 s previews for everyone else. Until it has run, the shelf shows its placeholder records. No keys ever reach the browser.

### One-time setup (about 10 minutes)
1. Create an app at https://developer.spotify.com/dashboard. The app owner needs Spotify Premium. Add the redirect URI `http://127.0.0.1:8888/callback`.
2. `cp .env.example .env`, then paste the client ID and secret into `.env`. `.env` is gitignored.
3. Run `node --env-file=.env scripts/fetch-spotify.mjs --auth`, open the printed link, allow access, and paste the printed `SPOTIFY_REFRESH_TOKEN=...` line into `.env`.
4. Run `node --env-file=.env scripts/fetch-spotify.mjs` to pull the real top 40 and their covers.

### Weekly update on GitHub
`.github/workflows/spotify.yml` runs the same script every Monday at 06:00 UTC, and on demand from the Actions tab. It commits only when the list changed, and the deploy workflow then publishes it.
1. Add the values from `.env` as repository secrets (Settings → Secrets and variables → Actions), or run `gh secret set SPOTIFY_CLIENT_ID` and the same for `SPOTIFY_CLIENT_SECRET` and `SPOTIFY_REFRESH_TOKEN`.
2. Scheduled runs start once the workflow is on `main`. GitHub pauses them after 60 days without repo activity; re-enable them in the Actions tab.
3. The bot commits to `main`, so pull before you push.
