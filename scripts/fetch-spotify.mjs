// Saves my Spotify top 40 (all time) to public/assets/data/top-tracks.json and their covers to public/assets/covers/, read by rack.js.
// One-time login, prints the refresh token for .env:  node --env-file=.env scripts/fetch-spotify.mjs --auth
// Update (locally, or weekly on GitHub with the same names as repo secrets):  node --env-file-if-exists=.env scripts/fetch-spotify.mjs
// No keys set: the committed placeholder list stays as it is. Plain Node 22+, no packages.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';

const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret, SPOTIFY_REFRESH_TOKEN: refresh } = process.env;
const REDIRECT = 'http://127.0.0.1:8888/callback';
const OUT = new URL('../public/assets/data/top-tracks.json', import.meta.url), COVERS = new URL('../public/assets/covers/', import.meta.url);
const basic = () => 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');

async function token(body) {
  const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { Authorization: basic(), 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  if (!r.ok) throw new Error(`token request failed: ${r.status} ${await r.text()}`);
  return r.json();
}

if (process.argv.includes('--auth')) {
  if (!id || !secret) throw new Error('set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env first');
  const state = randomUUID();
  const url = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({ client_id: id, response_type: 'code', redirect_uri: REDIRECT, scope: 'user-top-read', state });
  const server = createServer(async (req, res) => {
    const q = new URL(req.url, REDIRECT).searchParams;
    if (!req.url.startsWith('/callback') || q.get('state') !== state || !q.get('code')) { res.writeHead(400).end('Login failed or was cancelled. Run --auth again.'); return; }
    try {
      const t = await token({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: REDIRECT });
      res.end('Done. Back to the terminal.');
      console.log(`\nAdd this line to .env (and as the SPOTIFY_REFRESH_TOKEN repo secret):\nSPOTIFY_REFRESH_TOKEN=${t.refresh_token}`);
    } catch (e) { res.writeHead(500).end('Token exchange failed, see the terminal.'); console.error(e.message); }
    server.close();
  }).listen(8888, '127.0.0.1', () => console.log(`Open this in your browser and allow access:\n${url}`));
} else if (!id || !secret || !refresh) {
  console.log('No Spotify keys set: keeping the placeholder list in public/assets/data/top-tracks.json.');
} else {
  const { access_token } = await token({ grant_type: 'refresh_token', refresh_token: refresh });
  const r = await fetch('https://api.spotify.com/v1/me/top/tracks?time_range=long_term&limit=40', { headers: { Authorization: `Bearer ${access_token}` } });
  if (!r.ok) throw new Error(`top tracks request failed: ${r.status} ${await r.text()}`);
  const tracks = [];
  for (const t of (await r.json()).items) {
    if (!/^[A-Za-z0-9]{22}$/.test(t.id)) throw new Error(`unexpected track id ${t.id}`);   // it becomes a file name
    const img = t.album.images.reduce((a, b) => Math.abs(b.width - 300) < Math.abs(a.width - 300) ? b : a);   // Spotify gives 640, 300 and 64 px
    const c = await fetch(img.url);
    if (!c.ok) throw new Error(`cover download failed: ${c.status} ${img.url}`);
    writeFileSync(new URL(`${t.id}.jpg`, COVERS), Buffer.from(await c.arrayBuffer()));
    tracks.push({ id: t.id, name: t.name, artists: t.artists.map(a => a.name), album: t.album.name, cover: `assets/covers/${t.id}.jpg`, url: t.external_urls.spotify, preview_url: t.preview_url ?? null });
  }
  const keep = new Set(tracks.map(t => `${t.id}.jpg`));
  for (const f of readdirSync(COVERS)) if (f.endsWith('.jpg') && !keep.has(f)) rmSync(new URL(f, COVERS));   // dropped out of the top 40, or a placeholder
  writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), tracks }, null, 1) + '\n');
  console.log(`Saved ${tracks.length} tracks: ${tracks.map(t => t.name).join(' · ')}`);
}

// self-check: whatever the list is now, every entry is complete and its cover is on disk
if (!process.argv.includes('--auth')) {
  const { tracks } = JSON.parse(readFileSync(OUT, 'utf8'));
  if (!tracks.length) throw new Error('top-tracks.json has no tracks');
  for (const t of tracks) if (!t.name || !t.artists?.length || !existsSync(new URL(`../public/${t.cover}`, import.meta.url))) throw new Error(`incomplete entry: ${JSON.stringify(t)}`);
}
