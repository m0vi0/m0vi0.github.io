// Strip the baked servers and shelves, drop branded textures, recolour RAL 7035, face the bay to +z. Usage: node prep-rack.mjs in.glb out.glb
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup, textureCompress, weld } from '@gltf-transform/functions';
import sharp from 'sharp';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const [src, out] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), doc = await io.read(src);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const pos = prim.getAttribute('POSITION').getArray(), idx = prim.getIndices();
const a = idx.getArray();
// connected parts by shared position; keep only the biggest (the frame)
const n = pos.length/3, par = [...Array(n).keys()], f = x => par[x]===x?x:(par[x]=f(par[x]));
const seen = {};
for (let i=0;i<n;i++){const k=[0,1,2].map(j=>pos[i*3+j].toFixed(4)).join(); if(k in seen) par[f(i)]=f(seen[k]); else seen[k]=i;}
for (let t=0;t<a.length;t+=3){par[f(a[t+1])]=f(a[t]);par[f(a[t+2])]=f(a[t]);}
const count = {}; for (let t=0;t<a.length;t+=3) count[f(a[t])]=(count[f(a[t])]||0)+1;
const frame = +Object.entries(count).sort((x,y)=>y[1]-x[1])[0][0];
// also drop the fixed shelves and bars inside the bay (|x|<0.27, between top and bottom rails), keep the back door (z>0.28)
const c = (t,j) => (pos[a[t]*3+j]+pos[a[t+1]*3+j]+pos[a[t+2]*3+j])/3;
const inBay = t => Math.abs(c(t,0))<0.27 && c(t,1)>-0.78 && c(t,1)<0.78 && c(t,2)<0.28;
const keep = []; for (let t=0;t<a.length;t+=3) if (f(a[t])===frame && !inBay(t)) keep.push(a[t],a[t+1],a[t+2]);
idx.setArray(new Uint32Array(keep));
console.log('kept tris', keep.length/3, 'of', a.length/3);
const m = doc.getRoot().listMaterials()[0];
m.setBaseColorTexture(null).setBaseColorFactor([0.60, 0.63, 0.61, 1]) // ~#cbd0cc in sRGB, stored linear
 .setEmissiveTexture(null).setNormalTexture(null).setOcclusionTexture(null).setMetallicRoughnessTexture(null).setEmissiveFactor([0,0,0]).setRoughnessFactor(0.8).setMetallicFactor(0.15).setDoubleSided(true);
// open side faces -z in the source; turn it to face +z
doc.getRoot().listNodes().find(nd => nd.getMesh()).setRotation([0,1,0,0]); // parent rotations cancel out
await doc.transform(prune(), dedup(), weld(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }));
await io.write(out, doc);
