// Split the rack into frame + 9 server nodes (server_0 = top), face the bay to +z, shrink textures.
// Usage: node prep-rack.mjs in.glb out.glb  (needs @gltf-transform/core, functions, extensions, sharp)
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup, textureCompress } from '@gltf-transform/functions';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';

const [src, out] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), doc = await io.read(src);
const node = doc.getRoot().listNodes().find(n => n.getMesh());
const prim = node.getMesh().listPrimitives()[0];
const pos = prim.getAttribute('POSITION').getArray(), a = prim.getIndices().getArray();

// connected parts by shared position (the servers are separate parts of the one mesh)
const n = pos.length / 3, par = [...Array(n).keys()], f = x => par[x] === x ? x : (par[x] = f(par[x]));
const seen = {};
for (let i = 0; i < n; i++) { const k = [0, 1, 2].map(j => pos[i * 3 + j].toFixed(4)).join(); if (k in seen) par[f(i)] = f(seen[k]); else seen[k] = i; }
for (let t = 0; t < a.length; t += 3) { par[f(a[t + 1])] = f(a[t]); par[f(a[t + 2])] = f(a[t]); }
const parts = {};
for (let t = 0; t < a.length; t += 3) (parts[f(a[t])] ??= []).push(a[t], a[t + 1], a[t + 2]);
const topY = tris => Math.max(...tris.map(v => pos[v * 3 + 1]));
const list = Object.values(parts).sort((x, y) => y.length - x.length);
const [frame, ...servers] = list;
if (servers.length !== 9) throw new Error(`expected 9 servers, got ${servers.length}`);
servers.sort((x, y) => topY(y) - topY(x));

// one node per part, sharing the vertex buffers; prune drops nothing shared
const parent = node.getParentNode() ?? doc.getRoot().listScenes()[0];
const make = (name, tris) => {
  const p = prim.clone().setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(tris)));
  const nd = doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(p)).setRotation([0, 1, 0, 0]); // front was -z
  parent.addChild(nd);
};
make('frame', frame);
servers.forEach((s, i) => make(`server_${i}`, s));
node.getMesh().dispose(); node.dispose();

// colour maps are tiny, so keep 2048 for readable LCD text; lossy webp shifts roughness/metal and the servers turn shiny, so that map stays lossless
await doc.transform(prune(), dedup(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 90, slots: /baseColor|emissive/ }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 90, slots: /normal/ }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], lossless: true, slots: /metallicRoughness|occlusion/ }));
await io.write(out, doc);
console.log('frame', frame.length / 3, 'tris; servers', servers.map(s => s.length / 3).join(','));
