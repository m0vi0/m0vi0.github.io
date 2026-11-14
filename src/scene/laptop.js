// A modern thin 14" laptop in space black, my own geometry, no marks. In metres, origin at the base's bottom centre, trackpad edge to +z, hinge at -z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const W = .312, H = .0155, D = .221, LT = .0065, BZ = .004, OPEN = 110 * Math.PI / 180;

const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };

// the top deck: speaker dots, keyboard well, 78 keys, trackpad, all on one canvas (3.4 px per mm: the deck at the desk's close-up is ~500 px across)
function deckTex() {
  const PX = 3400, [c, g] = canvas(W * PX | 0, D * PX | 0), mm = v => v * PX / 1000;
  g.fillStyle = '#1d1e20'; rr(g, 0, 0, c.width, c.height, mm(8));
  g.fillStyle = '#0c0c0d'; for (const sx of [mm(8), c.width - mm(27)]) for (let y = mm(10); y < mm(100); y += mm(2.4)) for (let x = sx; x < sx + mm(19); x += mm(2.4)) { g.beginPath(); g.arc(x, y, mm(.55), 0, 7); g.fill(); }   // speaker grilles
  const kw = mm(268), x0 = (c.width - kw) / 2, y0 = mm(10), U = kw / 15, P = mm(.7);
  g.fillStyle = '#08080a'; rr(g, x0 - mm(4), y0 - mm(3), kw + mm(8), mm(104), mm(3));   // the well, darker than the deck
  const rows = [[14, 'f'], [[1,1,1,1,1,1,1,1,1,1,1,1,1,2]], [[1.5,1,1,1,1,1,1,1,1,1,1,1,1,1.5]], [[1.75,1,1,1,1,1,1,1,1,1,1,1,2.25]], [[2.25,1,1,1,1,1,1,1,1,1,1,2.75]], [[1.25,1.25,1.25,1.25,4.5,1.25,1.25,3]]];
  let y = y0; g.fillStyle = '#2a2b2e';
  rows.forEach((r, i) => {
    const fn = i === 0, h = fn ? mm(8) : mm(16.5), ws = fn ? Array(14).fill(15 / 14) : r[0];
    let x = x0;
    ws.forEach((w, j) => {
      if (i === 5 && j === 7) { rr(g, x + P, y + h / 2 + P / 2, w * U / 3 - 2 * P, h / 2 - P, mm(1.5)); rr(g, x + w * U / 3 + P, y + P, w * U / 3 - 2 * P, h / 2 - P / 2, mm(1.5)); rr(g, x + w * U / 3 + P, y + h / 2 + P / 2, w * U / 3 - 2 * P, h / 2 - P, mm(1.5)); rr(g, x + 2 * w * U / 3 + P, y + h / 2 + P / 2, w * U / 3 - 2 * P, h / 2 - P, mm(1.5)); }   // inverted-T arrows, up on its own
      else rr(g, x + P, y + P, w * U - 2 * P, h - 2 * P, mm(1.8));
      x += w * U;
    });
    y += h;
  });
  g.fillStyle = '#26272a'; rr(g, (c.width - mm(150)) / 2, mm(117), mm(150), mm(90), mm(5));   // trackpad: a lighter rounded inset
  g.strokeStyle = '#3a3b3f'; g.lineWidth = mm(.4); g.beginPath(); g.roundRect((c.width - mm(150)) / 2, mm(117), mm(150), mm(90), mm(5)); g.stroke();
  return tex(c);
}

// the display: dark navy-to-purple wallpaper with a soft glow and a menu bar; the notch is painted black at the top centre
function screenTex() {
  const [c, g] = canvas(1200, 800), w = 1800, h = 1200; g.scale(c.width / w, c.height / h);   // drawn 1800 x 1200, stored at 2/3 of that
  const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#070b24'); bg.addColorStop(.55, '#1a1048'); bg.addColorStop(1, '#3a1060');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (const [x, y, r, col] of [[1250, 760, 650, 'rgba(150,80,255,.55)'], [500, 900, 520, 'rgba(40,120,255,.4)'], [900, 450, 420, 'rgba(255,90,170,.25)']]) {
    const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, w, h);
  }
  g.fillStyle = 'rgba(8,8,20,.55)'; g.fillRect(0, 0, w, 44);   // menu bar
  g.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 6; i++) g.fillRect(30 + i * 90, 16, i ? 60 : 24, 12);
  for (let i = 0; i < 4; i++) g.fillRect(w - 340 + i * 80, 16, 50, 12);
  g.fillStyle = '#000'; g.beginPath(); g.roundRect(w / 2 - 104, -20, 208, 64, [0, 0, 18, 18]); g.fill();   // camera notch
  return tex(c);
}

export function buildLaptop() {
  const mat = (color, roughness, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const alu = mat('#1d1e20', .45, .6), glass = mat('#050506', .15, .1);
  const grp = new THREE.Group();
  const add = (parent, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  const base = add(grp, new RoundedBoxGeometry(W, H, D, 4, .006), alu, 0, H / 2, 0);
  const deck = add(grp, new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: deckTex(), transparent: true, alphaTest: .5, roughness: .55, metalness: .3 }), 0, H + .0002, 0);
  deck.rotation.x = -Math.PI / 2;
  // the lid pivots on the back edge; closed it lies toward +z, so a negative turn about x stands it up and leans it back
  const lid = new THREE.Group(); lid.position.set(0, H, -D / 2); lid.rotation.x = -OPEN; grp.add(lid);
  add(lid, new RoundedBoxGeometry(W, LT, D, 4, .003), alu, 0, LT / 2, D / 2);
  add(lid, new RoundedBoxGeometry(W - .002, .0004, D - .002, 2, .0002), glass, 0, -.0001, D / 2);   // glossy bezel, a hair proud of the aluminium
  const screen = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#fff', emissiveMap: screenTex(), emissiveIntensity: .35, roughness: .2 });
  const pane = add(lid, new THREE.PlaneGeometry(W - 2 * BZ, D - 2 * BZ), screen, 0, -.0005, D / 2);
  pane.rotation.x = Math.PI / 2;   // faces down when closed, so out toward +z when open
  return { grp, screen, base, lid };                         // base, lid: their own boxes are what a paper ball bounces off
}
