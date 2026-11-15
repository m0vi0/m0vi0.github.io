// Slims the room's downloads in place, no dependencies (2026-11-15 audit). Usage: node scripts/slim-textures.mjs, once, on the files as committed
// before that date (a second run would halve them again)
// 1. rack.glb: rack-build.js keeps only the normal map (the rest it nulls for a clean charcoal), so the other maps leave the file, and the
//    normal map loses its top mip level
// 2. tex/*.ktx2: a texture whose detail never reaches the screen loses its top mip levels (each halves it), straight from the KTX2
//    container: the levels are stored whole and zstd-compressed, so this needs no re-encode
import fs from 'node:fs';

const A = new URL('../public/assets/', import.meta.url);
const DROP = { 'brick-diff': 2, 'brick-nor': 2, 'brick-rough': 2, 'paint-nor': 1, 'marble-rough': 1 };   // brick shows only on the walls' cut edges

function dropLevels(b, k) {
  const u32 = o => b.readUInt32LE(o), u64 = o => Number(b.readBigUInt64LE(o));
  const [w, h, n, scheme] = [u32(20), u32(24), u32(40), u32(44)];
  if (scheme !== 2 || u64(72)) throw new Error('expected zstd and no SGD');   // BasisLZ would need its global data split too
  const levels = Array.from({ length: n }, (_, i) => b.subarray(u64(80 + i * 24), u64(80 + i * 24) + u64(88 + i * 24)));
  const raw = Array.from({ length: n }, (_, i) => u64(96 + i * 24));
  const dfd = b.subarray(u32(48), u32(48) + u32(52)), kvd = b.subarray(u32(56), u32(56) + u32(60)), m = n - k;
  const pad = x => (x + 3) & ~3;
  const dfdAt = 80 + m * 24, kvdAt = pad(dfdAt + dfd.length);
  let at = pad(kvdAt + kvd.length);
  const out = Buffer.alloc(at + levels.slice(k).reduce((s, l) => s + l.length, 0));
  b.copy(out, 0, 0, 80);
  out.writeUInt32LE(Math.max(w >> k, 1), 20); out.writeUInt32LE(Math.max(h >> k, 1), 24); out.writeUInt32LE(m, 40);
  out.writeUInt32LE(dfdAt, 48); out.writeUInt32LE(kvdAt, 56);
  dfd.copy(out, dfdAt); kvd.copy(out, kvdAt);
  for (let i = m - 1; i >= 0; i--) {                         // smallest level first, as the spec stores them
    const l = levels[i + k];
    l.copy(out, at);
    out.writeBigUInt64LE(BigInt(at), 80 + i * 24); out.writeBigUInt64LE(BigInt(l.length), 88 + i * 24); out.writeBigUInt64LE(BigInt(raw[i + k]), 96 + i * 24);
    at += l.length;
  }
  return out;
}

function slimRack(file) {
  const b = fs.readFileSync(file), jl = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + jl)), bin = b.subarray(28 + jl);
  for (const m of j.materials) {
    delete m.pbrMetallicRoughness?.baseColorTexture; delete m.pbrMetallicRoughness?.metallicRoughnessTexture;
    delete m.emissiveTexture; delete m.occlusionTexture; delete m.emissiveFactor;
  }
  // keep only the textures, images and buffer views something still uses, renumbered
  const keepTex = [...new Set(j.materials.map(m => m.normalTexture?.index).filter(i => i != null))];
  const texMap = new Map(keepTex.map((t, i) => [t, i]));
  for (const m of j.materials) if (m.normalTexture) m.normalTexture.index = texMap.get(m.normalTexture.index);
  const src = t => t.extensions?.KHR_texture_basisu?.source ?? t.source;
  j.textures = keepTex.map(t => j.textures[t]);
  const keepImg = [...new Set(j.textures.map(src))], imgMap = new Map(keepImg.map((s, i) => [s, i]));
  for (const t of j.textures) t.extensions?.KHR_texture_basisu ? t.extensions.KHR_texture_basisu.source = imgMap.get(src(t)) : t.source = imgMap.get(t.source);
  j.images = keepImg.map(s => j.images[s]);
  const used = new Set([...j.accessors.map(a => a.bufferView), ...j.images.map(i => i.bufferView)].filter(v => v != null));
  const viewMap = new Map(), views = [], parts = [];
  let off = 0;
  j.bufferViews.forEach((v, i) => {
    if (!used.has(i)) return;
    let data = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
    if (j.images.some(im => im.bufferView === i) && data.readUInt32LE(20) > 512) data = dropLevels(data, 1);   // the normal map: 1024 -> 512, its bevels read the same at the rack's size on screen
    viewMap.set(i, views.length); views.push({ ...v, byteOffset: off }); parts.push(data, Buffer.alloc((4 - data.length % 4) % 4)); off += (data.length + 3) & ~3;
  });
  for (const a of j.accessors) if (a.bufferView != null) a.bufferView = viewMap.get(a.bufferView);
  for (const im of j.images) im.bufferView = viewMap.get(im.bufferView);
  j.bufferViews = views; j.buffers[0].byteLength = off;
  let json = Buffer.from(JSON.stringify(j)); json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
  const body = Buffer.concat(parts), head = Buffer.alloc(12);
  head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + json.length + 8 + body.length, 8);
  const chunk = (data, type) => { const c = Buffer.alloc(8); c.writeUInt32LE(data.length, 0); c.write(type, 4); return Buffer.concat([c, data]); };
  fs.writeFileSync(file, Buffer.concat([head, chunk(json, 'JSON'), chunk(body, 'BIN\0')]));
  return [b.length, 12 + 8 + json.length + 8 + body.length];
}

const kb = ([a, b]) => `${a >> 10} -> ${b >> 10} KB`;
console.log('rack.glb', kb(slimRack(new URL('rack.glb', A))));
for (const [f, k] of Object.entries(DROP)) {
  const file = new URL(`tex/${f}.ktx2`, A), b = fs.readFileSync(file), out = dropLevels(b, k);
  fs.writeFileSync(file, out); console.log(`${f}.ktx2`, kb([b.length, out.length]));
}
