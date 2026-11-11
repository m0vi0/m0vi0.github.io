// Saves my Spotify top 20 (all time) to public/assets/data/top-tracks.json and their covers to public/assets/covers/, read by rack.js,
// and with a YouTube key each track's official YouTube upload, which the record shelf plays in full in YouTube's own player.
// One-time login, prints the refresh token for .env:  node --env-file=.env scripts/fetch-spotify.mjs --auth
// Update (locally, or weekly on GitHub with the same names as repo secrets):  node --env-file-if-exists=.env scripts/fetch-spotify.mjs
// No keys set: the committed placeholder list stays as it is. Plain Node 22+, no packages.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';

const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret, SPOTIFY_REFRESH_TOKEN: refresh } = process.env;
const REDIRECT = 'http://127.0.0.1:8888/callback';
const OUT = new URL('../public/assets/data/top-tracks.json', import.meta.url), COVERS = new URL('../public/assets/covers/', import.meta.url);
const before = existsSync(OUT) ? new Map(JSON.parse(readFileSync(OUT, 'utf8')).tracks.map(t => [t.id, t.yt])) : new Map();   // last run's YouTube matches
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
  console.log('No Spotify keys set: keeping the placeholder list in assets/data/top-tracks.json.');
} else {
  const { access_token } = await token({ grant_type: 'refresh_token', refresh_token: refresh });
  const r = await fetch('https://api.spotify.com/v1/me/top/tracks?time_range=long_term&limit=20', { headers: { Authorization: `Bearer ${access_token}` } });
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
  for (const f of readdirSync(COVERS)) if (f.endsWith('.jpg') && !keep.has(f)) rmSync(new URL(f, COVERS));   // dropped out of the top 20, or a placeholder
  writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), tracks }, null, 1) + '\n');
  console.log(`Saved ${tracks.length} tracks: ${tracks.map(t => t.name).join(' · ')}`);
}

// each track's official YouTube upload (YouTube Data API v3, YOUTUBE_API_KEY): YouTube's "Artist - Topic" audio when there is one, else the top
// music result that may be embedded. A track keeps last run's match, so only new tracks cost a search (100 of the key's 10,000 daily units).
// ponytail: a wrong match is fixed by editing that track's "yt" in top-tracks.json; add an overrides list if that happens often
const ytKey = process.env.YOUTUBE_API_KEY;
if (ytKey && !process.argv.includes('--auth')) {
  const data = JSON.parse(readFileSync(OUT, 'utf8'));
  for (const t of data.tracks) {
    if (!t.id) continue;                                     // a placeholder
    t.yt = t.yt ?? before.get(t.id);
    if (t.yt) continue;
    const q = new URLSearchParams({ part: 'snippet', type: 'video', videoCategoryId: '10', videoEmbeddable: 'true', maxResults: '10', q: `${t.artists[0]} ${t.name}`, key: ytKey });
    const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${q}`);
    if (!r.ok) throw new Error(`YouTube search failed: ${r.status} ${await r.text()}`);
    // the best of the results: its title has the track's name, it's on the artist's own channel ("Artist - Topic", their channel or VEVO),
    // and it isn't a fan's lyric upload. None with the name: none, rather than the wrong song
    const norm = x => x.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&amp;/g, '&').replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const name = norm(t.name.replace(/\s*[([](feat|with)[^)\]]*[)\]]/i, '')), artist = norm(t.artists[0]);
    const score = i => { const ti = norm(i.snippet.title), ch = norm(i.snippet.channelTitle);
      return (ti.includes(name) ? 4 : 0) + (ch === `${artist} topic` ? 4 : ch.startsWith(artist) || ch.includes(artist.replace(/ /g, '')) ? 3 : /vevo$/.test(ch) && ti.includes(artist) ? 2 : 0) - (/\b(lyrics?|letra)\b/.test(ti) ? 3 : 0); };
    const hit = ((await r.json()).items ?? []).filter(i => norm(i.snippet.title).includes(name)).sort((a, b) => score(b) - score(a))[0];
    if (hit && /^[\w-]{11}$/.test(hit.id.videoId)) { t.yt = hit.id.videoId; console.log(`YouTube: ${t.name} -> ${hit.snippet.title} (${hit.snippet.channelTitle})`); }
    else console.log(`YouTube: no upload of ${t.name} found; it plays through Spotify`);
  }
  writeFileSync(OUT, JSON.stringify(data, null, 1) + '\n');
}

// self-check: whatever the list is now, every entry is complete and its cover is on disk (and, with a YouTube key, every real track has its video)
if (!process.argv.includes('--auth')) {
  const { tracks } = JSON.parse(readFileSync(OUT, 'utf8'));
  if (!tracks.length) throw new Error('top-tracks.json has no tracks');
  for (const t of tracks) if (!t.name || !t.artists?.length || !existsSync(new URL(`../public/${t.cover}`, import.meta.url))) throw new Error(`incomplete entry: ${JSON.stringify(t)}`);
}
