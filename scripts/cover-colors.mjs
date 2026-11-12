// Adds each track's average cover colour (`avg`, hex) to public/assets/data/top-tracks.json: rack.js tints the record spines with it,
// so the 40 covers need not download before the room is up. Run after scripts/fetch-spotify.mjs:  node scripts/cover-colors.mjs
// Needs ImageMagick on the PATH: `magick` (v7), or `convert` (v6, as on GitHub's ubuntu runners).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const IM = (() => { try { execFileSync('magick', ['-version']); return 'magick'; } catch { return 'convert'; } })();
const OUT = new URL('../public/assets/data/top-tracks.json', import.meta.url), data = JSON.parse(readFileSync(OUT, 'utf8'));
for (const t of data.tracks) {
  const px = execFileSync(IM, [new URL(`../public/${t.cover}`, import.meta.url).pathname, '-resize', '1x1!', '-format', '%[hex:u.p{0,0}]', 'info:'], { encoding: 'utf8' });
  if (!/^[0-9A-F]{6}$/i.test(px)) throw new Error(`bad colour ${px} for ${t.cover}`);
  t.avg = `#${px.toLowerCase()}`;
}
writeFileSync(OUT, JSON.stringify(data, null, 1) + '\n');
