// The rack itself: the model, clean materials, patch panel, side panels, rails and one labelled faceplate per list item.
// Built by rack.js; kept apart so the rack code reads on its own (the room around it is rack.js's buildRoom).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

// measured from assets/rack.glb (scripts/prep-rack.mjs): server fronts at z .299, name panel above the top server
export const SERVER_FRONT = 0.299;
// a standard 42U rack: the model's front bezel (a ring round each of its 9 drawer bays) goes, leaving the front open between the posts, and its
// 1.6 m opening (OPEN, the model's own y, from the plinth to the top cap) becomes 42U; its 20 cm plinth and top cap shrink to 6 cm each.
// It still stands on the floor (y -1), about 2 m tall. The servers are 4U each, under a 1U patch panel; the rest of the rack stays empty
const OPEN = [-.795, .795], U = .04445, RACK_U = 42, SERVER_U = 4, END = .06, BOTTOM = -1 + END, TOP = BOTTOM + RACK_U * U;
const PLATE = { w: 0.56, h: U - .0008, y: TOP - U / 2, z: 0.3245 };   // the patch panel, the top 1U
const VOLT = { pink: '#FF2D78', lime: '#BFFF00', blue: '#0057FF' };
const INK = '#F5F0E8', YELLOW = '#FFD400', LIME = '#BFFF00';
const CREASE = THREE.MathUtils.degToRad(40);

// items: the .rack > li elements, top server first. scanOn: label lines start blank and type in later (u.type)
export async function buildRack(items, scanOn) {
  await Promise.all(['500 64px "Space Grotesk"', '600 64px "Space Grotesk"', '64px "Bebas Neue"'].map(f => document.fonts.load(f)));
  const url = new URL(`${import.meta.env.BASE_URL}assets/rack.glb`, location.href).href;   // a static file in public/assets
  const early = await window.rackGlb;                        // index.html's head started it; a failed one is fetched again here
  const gltf = early ? await new GLTFLoader().parseAsync(early, url.replace(/[^/]*$/, '')) : await new GLTFLoader().loadAsync(url);
  const rackRoot = new THREE.Group();
  rackRoot.add(gltf.scene);
  rackRoot.updateMatrixWorld(true);
  // clean matte charcoal (light enough to show its shape): drop the grimy colour, glow (fake LCD text) and AO/roughness maps, keep the normal map for shape
  const frameMesh = gltf.scene.getObjectByName('frame'), frameMat = frameMesh.material;
  {                                                          // the bezel: every face between the posts' inner sides, inside the opening, but the back panel and the posts themselves
    const g = frameMesh.geometry, pos = g.attributes.position, idx = g.index.array, keep = [], v = new THREE.Vector3(), E = .0015;
    for (let t = 0; t < idx.length; t += 3) {
      let within = true, rim = true, open = true, back = true, sides = 0;
      for (let k = 0; k < 3; k++) {
        v.fromBufferAttribute(pos, idx[t + k]);
        within &&= Math.abs(v.x) < .293 + E; rim &&= Math.abs(v.x) > .293 - E; sides |= v.x > 0 ? 1 : 2;
        open &&= v.y > OPEN[0] - E && v.y < OPEN[1] + E; back &&= v.z > .293 - E;   // the model's own z: + is the back
      }
      if (!within || !open || back || (rim && sides !== 3)) keep.push(idx[t], idx[t + 1], idx[t + 2]);   // rim on one side: a post's inner face
    }
    g.setIndex(keep);
  }
  frameMesh.geometry = toCreasedNormals(frameMesh.geometry, CREASE); // smooth the 2–3 facet bevels, keep flat faces flat; its own vertices from here (the servers share the model's)
  {                                                          // 10U: plinth, opening and top cap each squashed to its new height
    const p = frameMesh.geometry.attributes.position, k = (TOP - BOTTOM) / (OPEN[1] - OPEN[0]), ke = END / (OPEN[0] + 1);
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setY(i, y >= OPEN[1] ? TOP + (y - OPEN[1]) * ke : y > OPEN[0] ? BOTTOM + (y - OPEN[0]) * k : -1 + (y + 1) * ke); }
    frameMesh.geometry.computeBoundingBox(); frameMesh.geometry.computeBoundingSphere();
  }
  const fb = new THREE.Box3().setFromObject(frameMesh), FRAME_FRONT = fb.max.z, RAIL = { w: .03, x: fb.max.x - .025 }; // rails sit flush on the front posts
  Object.assign(frameMat, { map: null, emissiveMap: null, roughnessMap: null, metalnessMap: null, aoMap: null, roughness: .7, metalness: .2 });
  frameMat.color.set('#2a2a2a'); frameMat.emissive.set(0); frameMat.needsUpdate = true;
  const serverMat = frameMat.clone();
  serverMat.color.set('#333333');
  const metal = new THREE.MeshStandardMaterial({ color: '#3a3a3a', roughness: .45, metalness: .6 });
  const screwMat = new THREE.MeshStandardMaterial({ color: '#8a8a8a', roughness: .35, metalness: .9 });
  const blink = [];                                          // drive and port LEDs, lit by quads so they blink without redrawing textures
  const texOf = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const glow = (g, x, y, r, col, k = 1.5) => { g.save(); g.fillStyle = col; g.shadowColor = col; g.shadowBlur = r * k; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.restore(); };
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
  const ledGeo = new THREE.CircleGeometry(1, 12);
  const ke = END / (OPEN[0] + 1), plain = new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: .7, metalness: .2 });
  const cap = box(fb.max.x * 2 - .062, .152 * ke, .001, plain, 0, TOP + .099 * ke, FRAME_FRONT + .0005);   // the top cap's front, plain: it covers the model's maker logo
  // the rack's floor: the bezel cut took the model's plinth top with it, which left the base hollow, the room's floor showing through
  const base = box(fb.max.x * 2 - .062, .006, fb.max.z - fb.min.z - .01, plain, 0, BOTTOM - .003, (fb.max.z + fb.min.z) / 2);
  rackRoot.add(patchPanel(), sidePanels(), cap, base);

  // ---- servers: each gets a pivot at its centre so it can slide and turn in place, and a label on its face ----
  const units = items.map((li, i) => {
    const mesh = gltf.scene.getObjectByName(`server_${i}`), y = TOP - U - (i + .5) * SERVER_U * U;   // 4U each, straight down from the patch panel
    mesh.material = serverMat;
    const b0 = indexedBox(mesh), c0 = b0.getCenter(new THREE.Vector3()).y, k = (SERVER_U * U - .0008) / (b0.max.y - b0.min.y);
    mesh.geometry = toCreasedNormals(mesh.geometry, CREASE);   // after indexedBox: this drops the index, and gives it its own vertices
    const p = mesh.geometry.attributes.position;              // the model's 2.5U drawer, made 4U at its place
    for (let n = 0; n < p.count; n++) p.setY(n, y + (p.getY(n) - c0) * k);
    mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere();
    const box = new THREE.Box3().setFromObject(mesh), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const pivot = new THREE.Group();
    pivot.position.copy(c);
    rackRoot.add(pivot);
    pivot.attach(mesh);
    const links = [...li.querySelectorAll('a')];
    const u = { i, li, mesh, pivot, links, link: links[0], w: size.x, h: size.y, d: size.z, frontZ: SERVER_FRONT - c.z, baseZ: c.z, out: 0, target: 0,
      project: !!li.dataset.volt, volt: VOLT[li.dataset.volt], chars: Math.max(...[li, ...links].map(e => e.dataset.line?.length ?? 0)) };
    u.plate = faceLabel(u);
    pivot.add(u.plate, hardware(u));
    mesh.userData.unit = u;
    return u;
  });
  for (let i = items.length, m; (m = gltf.scene.getObjectByName(`server_${i}`)); i++) m.visible = false;   // the rest of the rack stays empty (17U)

  // rails: punched square holes (3 per U) with U numbers on the outer edge, down both front posts, the whole 42U
  {
    const bottom = BOTTOM, n = RACK_U, rh = n * U;
    for (const s of [-1, 1]) {
      const c = document.createElement('canvas'), W = c.width = 128, H = c.height = Math.round(W * rh / RAIL.w), g = c.getContext('2d');
      const num = s < 0 ? W * .26 : W * .74, hole = s < 0 ? W * .68 : W * .32, pxU = H / n;
      g.fillStyle = '#383838'; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(0, 0, 3, H); g.fillRect(W - 3, 0, 3, H);
      g.textBaseline = 'middle'; g.textAlign = 'center';
      for (let k = 0; k < n; k++) {
        const y0 = H - (k + 1) * pxU, sz = Math.min(pxU * .17, 30);
        g.fillStyle = '#050505'; for (const f of [.17, .5, .83]) g.fillRect(hole - sz / 2, y0 + f * pxU - sz / 2, sz, sz);
        g.fillStyle = 'rgba(245,240,232,.7)'; g.font = `600 ${Math.min(pxU * .24, 34)}px "Space Grotesk"`; g.fillText(String(k + 1), num, y0 + pxU / 2);
        g.fillStyle = 'rgba(245,240,232,.18)'; g.fillRect(s < 0 ? 0 : W * .55, y0, W * .45, 3);
      }
      const r = new THREE.Mesh(new THREE.PlaneGeometry(RAIL.w, rh), new THREE.MeshStandardMaterial({ map: texOf(c), roughness: .5, metalness: .5 }));
      r.position.set(s * RAIL.x, bottom + rh / 2, FRAME_FRONT + .0012);
      rackRoot.add(r);
    }
  }

  // the servers share one vertex buffer (scripts/prep-rack.mjs), so bound only the vertices each one indexes
  function indexedBox(mesh) {
    const pos = mesh.geometry.attributes.position, v = new THREE.Vector3(), box = new THREE.Box3();
    for (const k of mesh.geometry.index.array) box.expandByPoint(v.fromBufferAttribute(pos, k));
    return box.applyMatrix4(mesh.matrixWorld);
  }

  function led(parent, x, y, r, u) {                         // x, y in the parent plane's local units; u: its server (none on the patch panel)
    const m = new THREE.Mesh(ledGeo, new THREE.MeshBasicMaterial({ color: LIME, toneMapped: false }));
    m.scale.setScalar(r); m.position.set(x, y, .0005); parent.add(m);
    blink.push({ m, u, rate: 1.8 + Math.random() * 7, phase: Math.random() * 6 });
  }

  // 24-port 1U patch panel in the top slot: one row of ports in fours of six, their numbers above
  function patchPanel() {
    const c = document.createElement('canvas'), W = c.width = 3072, H = c.height = Math.round(W * PLATE.h / PLATE.w), g = c.getContext('2d');
    g.fillStyle = '#1b1b1b'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 4; g.strokeRect(2, 2, W - 4, H - 4);
    g.textBaseline = 'middle'; g.textAlign = 'center';
    const lit = [], pw = 76, ph = H * .42, pitch = 100, x0 = 420, y = H * .6 - ph / 2;
    for (let k = 0; k < 24; k++) {
      const x = x0 + k * pitch + Math.floor(k / 6) * 90;
      g.fillStyle = '#060606'; g.fillRect(x, y, pw, ph); g.fillRect(x + pw * .3, y + ph, pw * .4, H * .05);   // RJ45 socket and clip notch
      g.fillStyle = '#2a2a2a'; for (let p = 0; p < 8; p++) g.fillRect(x + 10 + p * 7.5, y + 6, 4, ph * .3);
      if ((k * 7) % 5) lit.push([x + pw - 8, y - H * .1]); else glow(g, x + pw - 8, y - H * .1, 6, '#1f2a12', 0);   // link LED (unlit)
      g.fillStyle = 'rgba(245,240,232,.45)'; g.font = `600 ${H * .16}px "Space Grotesk"`; g.fillText(String(k + 1), x + pw * .35, y - H * .1);
    }
    if ('letterSpacing' in g) g.letterSpacing = '5px';
    g.textAlign = 'left'; g.font = `600 ${H * .24}px "Space Grotesk"`; g.fillStyle = 'rgba(245,240,232,.5)'; g.fillText('PATCH 24', 90, H * .52);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(PLATE.w, PLATE.h), new THREE.MeshBasicMaterial({ map: texOf(c), toneMapped: false }));
    m.position.set(0, PLATE.y, PLATE.z + .001);
    for (const [x, y] of lit) led(m, (x / W - .5) * PLATE.w, (.5 - y / H) * PLATE.h, .0012);
    return m;
  }

  // perforated steel side panels
  function sidePanels() {
    const s = fb.getSize(new THREE.Vector3()), ctr = fb.getCenter(new THREE.Vector3()), grp = new THREE.Group();
    const c = document.createElement('canvas'), W = c.width = 512, H = c.height = Math.round(W * s.y / s.z), g = c.getContext('2d');
    g.fillStyle = '#3a3a3a'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#080808';
    for (let r = 0, y = 30; y < H - 30; y += 16, r++)
      for (let x = 30 + (r % 2 ? 8 : 0); x < W - 30; x += 16) { g.beginPath(); g.arc(x, y, 5.5, 0, 7); g.fill(); }
    const t = texOf(c), mat = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: .35, roughness: .6, metalness: .4 });
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(s.z * .92, s.y * .94), mat);
      p.rotation.y = sx * Math.PI / 2; p.position.set(ctr.x + sx * (s.x / 2 + .0015), ctr.y, ctr.z); grp.add(p);
    }
    return grp;
  }

  // rack ears bridge from the recessed server out to the rail, with screws and a pull handle
  function hardware(u) {
    const grp = new THREE.Group(), eh = u.h * .9, z = u.frontZ + (FRAME_FRONT - SERVER_FRONT) + .003;
    const x0 = u.w / 2 - .006, ew = RAIL.x + .002 - x0;      // ear covers the hole side of the rail; the U numbers stay visible
    for (const s of [-1, 1]) {
      const x = s * (x0 + ew / 2);
      grp.add(box(ew, eh, .004, metal, x, 0, z), box(.004, eh, z - u.frontZ, metal, s * (u.w / 2 - .002), 0, (z + u.frontZ) / 2));
      for (const sy of [-1, 1]) {
        const sc = new THREE.Mesh(new THREE.CylinderGeometry(.0045, .0045, .003, 16), screwMat);
        sc.rotation.x = Math.PI / 2; sc.position.set(s * (RAIL.x - .005), sy * eh * .32, z + .0035); grp.add(sc);
      }
      const hx = s * (x0 + .014), hh = eh * .62;              // C-shaped pull handle
      grp.add(box(.007, hh, .007, metal, hx, 0, z + .02));
      for (const sy of [-1, 1]) grp.add(box(.007, .007, .02, metal, hx, sy * (hh / 2 - .0035), z + .01));
    }
    return grp;
  }

  // server front: bezel with the label in an LCD panel, a vent strip, 4 x 2 drive bays and a power button
  function faceLabel(u) {
    const fw = u.w * .985, fh = u.h * .9, accent = u.volt ?? YELLOW;
    const c = document.createElement('canvas'), W = c.width = 2048, H = c.height = Math.round(W * fh / fw), g = c.getContext('2d');
    g.fillStyle = '#1b1b1b'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 3) { g.fillStyle = `rgba(255,255,255,${.012 + Math.random() * .018})`; g.fillRect(0, y, W, 1); } // brushing
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 4; g.strokeRect(2, 2, W - 4, H - 4);
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, H - 10, W, 10);
    const lx = 44, ly = 34, lw = Math.round(W * .7), lh = H - 68;
    g.fillStyle = '#0a0a0a'; g.fillRect(lx - 6, ly - 6, lw + 12, lh + 12);
    g.drawImage(lcd(u, lw, lh, scanOn ? 0 : Infinity), lx, ly);   // scan mode: the line stays blank until the camera rests on its server, then types
    u.split = ((lx + lw / 2) / W - .5) * fw;                  // two-link server: left/right half of the LCD
    const vx = lx + lw + 30, vw = 66;
    g.fillStyle = '#050505';
    for (let r = 0, y = ly + 14; y < ly + lh - 8; y += 22, r++)
      for (let x = vx + (r % 2 ? 11 : 0); x < vx + vw; x += 22) { g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); }
    const bx = vx + vw + 22, bw = W - 170 - bx, gap = 10, sw = (bw - gap * 3) / 4, sh = (lh - gap) / 2, lit = [];
    for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) {
      const x = bx + k * (sw + gap), y = ly + r * (sh + gap);
      g.fillStyle = '#0c0c0c'; g.fillRect(x, y, sw, sh);
      g.fillStyle = '#242424'; g.fillRect(x + 6, y + 6, sw - 12, sh - 12);
      g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x + 6, y + 6, sw - 12, 3);
      for (let s = x + 32; s < x + sw - 14; s += 12) { g.fillStyle = '#121212'; g.fillRect(s, y + 18, 5, sh - 36); }
      const amber = (u.i + r * 4 + k) % 5 === 0;
      if (amber) glow(g, x + 19, y + sh / 2, 6, '#FFB000', 2); else { glow(g, x + 19, y + sh / 2, 6, '#1f2a12', 0); lit.push([x + 19, y + sh / 2]); }
    }
    const px = W - 85, py = H * .42;
    g.fillStyle = '#0c0c0c'; g.beginPath(); g.arc(px, py, 44, 0, 7); g.fill();
    g.save(); g.strokeStyle = accent; g.shadowColor = accent; g.shadowBlur = 18; g.lineWidth = 6; g.beginPath(); g.arc(px, py, 36, 0, 7); g.stroke(); g.restore();
    g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(px, py, 28, 0, 7); g.fill();
    g.strokeStyle = 'rgba(245,240,232,.55)'; g.lineWidth = 4; g.beginPath(); g.arc(px, py, 13, -1.1, 4.25); g.stroke();
    g.beginPath(); g.moveTo(px, py - 18); g.lineTo(px, py - 4); g.stroke();
    if ('letterSpacing' in g) g.letterSpacing = '3px';
    g.font = '600 22px "Space Grotesk"'; g.fillStyle = 'rgba(245,240,232,.35)'; g.textAlign = 'center';
    g.fillText(`SRV-${String(u.i + 1).padStart(2, '0')}`, px, H - 58);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), new THREE.MeshBasicMaterial({ map: texOf(c), toneMapped: false }));
    m.position.z = u.frontZ + 0.002;
    u.type = n => { g.drawImage(lcd(u, lw, lh, u.typed = n), lx, ly); m.material.map.needsUpdate = true; };   // redraw only the LCD, n chars of its line
    for (const [x, y] of lit) led(m, (x / W - .5) * fw, (.5 - y / H) * fh, .0024, u);
    return m;
  }

  // LCD contents: LED, number, title, CTA / one line / chips (or two link halves)
  function lcd(u, W, H, n = Infinity) {
    const d = u.li.dataset, c = u.lcd ??= document.createElement('canvas');   // reused while the line types out
    c.width = W; c.height = H;
    const g = c.getContext('2d'), pad = 56, accent = u.volt ?? YELLOW;
    const font = (spec, size, text, max) => {                 // shrink until the text fits
      do g.font = spec.replace('#', size + 'px'); while (g.measureText(text).width > max && (size -= 2) > 20);
      return size;
    };
    const type = (text, x, y, size) => {                      // the first n chars, then a block caret while it is still typing (none on a blank line)
      const s = text.slice(0, n); g.fillText(s, x, y);
      if (n && s.length < text.length) g.fillRect(x + g.measureText(s).width + size * .08, y - size * .42, size * .42, size * .84);
    };
    const space = px => { if ('letterSpacing' in g) g.letterSpacing = px; };
    const dot = (x, y, r, col) => { g.save(); g.fillStyle = col; g.shadowColor = col; g.shadowBlur = r * 1.5; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.restore(); };
    g.fillStyle = '#121212'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(245,240,232,.14)'; g.lineWidth = 4; g.strokeRect(2, 2, W - 4, H - 4);
    g.textBaseline = 'middle';
    const row1 = H * .25, row2 = H * .56, row3 = H * .82;

    function head(x, max, title, cta) {
      if (cta) { space('5px'); g.font = '600 38px "Space Grotesk"'; g.fillStyle = accent; g.textAlign = 'right'; g.fillText(cta.toUpperCase(), x + max, row1); max -= g.measureText(cta).width + 80; }
      g.textAlign = 'left'; space('0px'); g.fillStyle = INK;
      font('# "Bebas Neue"', 132, title.toUpperCase(), max); g.fillText(title.toUpperCase(), x, row1 + 6);
    }

    if (u.links.length > 1) {                                   // two halves, one per link
      const half = W / 2;
      u.links.forEach((a, k) => {
        const x = k * half + pad;
        dot(x + 14, row1, 16, accent);
        head(x + 56, half - 2 * pad - 56, a.textContent, 'Open →');
        space('0px'); g.fillStyle = '#cfcabf'; type(a.dataset.line, x, row2 + 20, font('500 # "Space Grotesk"', 64, a.dataset.line, half - 2 * pad));
      });
      g.fillStyle = 'rgba(245,240,232,.14)'; g.fillRect(half - 2, 40, 4, H - 80);
    } else {
      dot(pad + 14, row1, 16, accent);
      space('4px'); g.font = '600 40px "Space Grotesk"'; g.fillStyle = 'rgba(245,240,232,.5)'; g.textAlign = 'left';
      g.fillText(String(u.i + 1).padStart(2, '0'), pad + 52, row1);
      head(pad + 140, W - 2 * pad - 140, d.title, u.link && d.cta);
      space('0px'); g.fillStyle = '#cfcabf'; g.textAlign = 'left';
      type(d.line, pad, row2, font('500 # "Space Grotesk"', 70, d.line, W - 2 * pad));
      let x = pad;
      const tags = (d.tags ?? '').split('|').filter(Boolean).map(t => t.toUpperCase());
      space('5px'); g.font = '600 36px "Space Grotesk"';
      const k = Math.min(1, (W - 2 * pad) / tags.reduce((sum, t) => sum + g.measureText(t).width + 68, 0)); // shrink the row to fit the LCD
      g.font = `600 ${36 * k}px "Space Grotesk"`; g.strokeStyle = accent; g.lineWidth = 4;
      for (const t of tags) {
        const w = g.measureText(t).width + 48 * k;
        g.strokeRect(x, row3 - 34 * k, w, 68 * k); g.fillStyle = INK; g.fillText(t, x + 24 * k, row3 + 2); x += w + 20 * k;
      }
    }
    return c;
  }

  return { rackRoot, units, frameMesh, blink, top: fb.max.y };
}
