import * as THREE from 'three';

// the round rug in the floor's middle: a game's radar minimap, my own town on it (no game's map): a coast and a river, blocks between grey roads,
// parks, a few blips and you in the middle, under a black rim with the N. Drawn here, so it costs no download. Top-down, the N to +x (the caller turns it)
function paint(S) {
  const cv = Object.assign(document.createElement('canvas'), { width: S, height: S }), cx = cv.getContext('2d', { willReadFrequently: true });
  let seed = 7; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;   // the same town every load
  cx.fillStyle = '#c9c4b5'; cx.fillRect(0, 0, S, S);        // land
  cx.fillStyle = '#4f7fa8'; cx.beginPath(); cx.moveTo(S, 0);   // the sea along the right, and a river into it
  for (let y = 0; y <= S; y += 64) cx.lineTo(S * .78 + Math.sin(y / 120) * 40, y);
  cx.lineTo(S, S); cx.fill();
  cx.strokeStyle = '#4f7fa8'; cx.lineWidth = 34; cx.beginPath(); cx.moveTo(0, S * .7); cx.bezierCurveTo(S * .3, S * .62, S * .5, S * .85, S * .8, S * .75); cx.stroke();
  for (let i = 0; i < 9; i++) {                              // parks
    cx.fillStyle = i % 3 ? '#6f9a5a' : '#5d8a4b'; cx.fillRect(rnd() * S * .7, rnd() * S * .9, 50 + rnd() * 110, 40 + rnd() * 90);
  }
  cx.strokeStyle = '#efece4'; cx.lineCap = 'round';          // roads: a slightly crooked grid, a few avenues wider
  for (let k = 0; k < 2; k++) for (let v = 40; v < S; v += 90 + rnd() * 50) {
    cx.lineWidth = rnd() < .25 ? 16 : 8; cx.beginPath();
    if (k) { cx.moveTo(v, 0); cx.lineTo(v + (rnd() - .5) * 80, S); } else { cx.moveTo(0, v); cx.lineTo(S * .8, v + (rnd() - .5) * 80); }
    cx.stroke();
  }
  for (const [x, y, c] of [[.3, .32, '#FF2D78'], [.62, .28, '#FFD400'], [.24, .6, '#FFD400'], [.55, .62, '#ffffff'], [.42, .2, '#1f5bff']]) {   // blips
    cx.fillStyle = '#0d0d0d'; cx.fillRect(x * S - 17, y * S - 17, 34, 34); cx.fillStyle = c; cx.fillRect(x * S - 12, y * S - 12, 24, 24);
  }
  cx.fillStyle = '#ffffff'; cx.strokeStyle = '#0d0d0d'; cx.lineWidth = 6;   // you: an arrow in the middle, facing north
  cx.beginPath(); cx.moveTo(S / 2, S / 2 - 34); cx.lineTo(S / 2 + 24, S / 2 + 26); cx.lineTo(S / 2, S / 2 + 12); cx.lineTo(S / 2 - 24, S / 2 + 26); cx.closePath(); cx.fill(); cx.stroke();
  cx.strokeStyle = '#0d0d0d'; cx.lineWidth = 70; cx.beginPath(); cx.arc(S / 2, S / 2, S / 2 - 35, 0, Math.PI * 2); cx.stroke();   // the rim
  cx.fillStyle = '#0d0d0d'; cx.beginPath(); cx.arc(S / 2, 58, 52, 0, Math.PI * 2); cx.fill();
  cx.fillStyle = '#ffffff'; cx.font = '700 64px "Space Grotesk", sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('N', S / 2, 62);
  return cv;
}
// the pile's height: full everywhere, carved to half along every line where two colours meet (found from the painting itself, so every
// outline is carved without redrawing it), none past the hem
function carve(cv, rIn) {
  const S = cv.width, px = cv.getContext('2d').getImageData(0, 0, S, S).data, edge = new ImageData(S, S), e = edge.data;
  const diff = (a, b) => Math.abs(px[a] - px[b]) + Math.abs(px[a + 1] - px[b + 1]) + Math.abs(px[a + 2] - px[b + 2]);
  for (let y = 0; y < S - 1; y++) for (let x = 0; x < S - 1; x++) {
    const j = (y * S + x) * 4;
    if (diff(j, j + 4) > 40 || diff(j, j + S * 4) > 40) { e[j] = e[j + 1] = e[j + 2] = 128; e[j + 3] = 255; }
  }
  const mk = () => Object.assign(document.createElement('canvas'), { width: S, height: S });
  const one = mk(), wide = mk(), out = mk(), w = wide.getContext('2d'), o = out.getContext('2d');
  one.getContext('2d').putImageData(edge, 0, 0);
  for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) if (dx * dx + dy * dy <= 16) w.drawImage(one, dx, dy);   // the groove ~8 px wide
  o.fillStyle = '#fff'; o.fillRect(0, 0, S, S); o.filter = 'blur(1.5px)'; o.drawImage(wide, 0, 0); o.filter = 'none';   // soft walls, not a step
  o.fillStyle = '#000'; o.beginPath(); o.rect(0, 0, S, S); o.arc(S / 2, S / 2, rIn, 0, Math.PI * 2, true); o.fill();   // the hem
  return out;
}

// a hand-tufted rug: a black backing and bound hem, and the pile as shells, stacked discs that each keep only the tufts tall enough to reach
// them, so thousands of separate tufts show without a strand of geometry. Origin at its bottom centre; the N along +x
export function buildRug(phone) {
  const R = .95, RP = .93, H = .02, BASE = .004, N = phone ? 10 : 24, S = 1024, CELLS = 620;   // ~3 mm tufts over the 1.9 m map
  const cv = paint(S), map = new THREE.CanvasTexture(cv), pileMap = new THREE.CanvasTexture(carve(cv, S / 2 * RP / R));
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; pileMap.colorSpace = THREE.NoColorSpace;
  const black = new THREE.MeshStandardMaterial({ color: '#0d0d0d', roughness: .95, side: THREE.DoubleSide });
  const backing = new THREE.Mesh(new THREE.CylinderGeometry(R, R, BASE, 96).translate(0, BASE / 2, 0), black);
  const prof = []; for (let i = 0; i <= 12; i++) { const a = Math.PI * i / 12; prof.push(new THREE.Vector2(R - .0125 - .0125 * Math.cos(a), BASE + .009 * Math.sin(a))); }
  prof.push(new THREE.Vector2(R + .001, 0));                 // the binding: a rolled black strip over the pile's cut edge
  const hem = new THREE.Mesh(new THREE.LatheGeometry(prof, 160), black);

  const disc = new THREE.CircleGeometry(RP, 160).rotateX(-Math.PI / 2), p = disc.attributes.position, uv = disc.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getZ(i) / (2 * R) + .5, p.getX(i) / (2 * R) + .5);   // the cylinder cap's mapping, so the N sits where it did
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 1 });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { pileMap: { value: pileMap }, uH: { value: H }, uN: { value: N } });
    sh.vertexShader = 'uniform float uH;\nvarying float vT;\nvarying vec3 vU, vV;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vT = instanceMatrix[3].y / uH;                         // this shell's height, 0 at the backing to 1 at the tallest tips
      vU = normalize(mat3(modelViewMatrix) * vec3(0., 0., 1.)); vV = normalize(mat3(modelViewMatrix) * vec3(1., 0., 0.));`);   // the map's u and v across the floor, in view space
    sh.fragmentShader = 'uniform sampler2D pileMap;\nuniform float uN;\nvarying float vT;\nvarying vec3 vU, vV;\n'
      + 'float hash(vec2 p) { vec3 q = fract(p.xyx * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }\n'   // sin-free: a sin hash bands at ~600 cells
      + sh.fragmentShader.replace('#include <map_fragment>', `
      vec2 g = vMapUv * ${CELLS}.0, id = floor(g), f = fract(g) - .5;
      vec2 off = (vec2(hash(id), hash(id + 17.)) - .5) * .5;   // tufts not on a grid
      vec2 c = (id + .5 + off) / ${CELLS}.0;                   // one tuft, one yarn colour and one cut height
      float h = texture2D(pileMap, c).r * (.8 + .2 * hash(id + 41.)), k = vT / max(h, 1e-3);
      vec2 d = f - off; float r = length(d), far = clamp(length(fwidth(g)) - .6, 0., 1.);   // tufts under ~1.5 px: drop their shape, it only shimmers
      if (vT > 1.5 / uN && (k > 1. || r > .8 - .45 * k * k + far)) discard;   // the bottom shell stays whole so nothing shows through; tips taper
      vec2 jit = (vec2(hash(id + 3.1 + vT), hash(id + 5.7 - vT)) - .5) * 4. / ${S}.0;   // neighbouring yarns stray a few texels, blurring colour edges
      diffuseColor *= texture2D(map, c + jit);
      diffuseColor.rgb *= mix(.45, 1., vT) * (.9 + .2 * hash(id + 9.));   // the pile's base sits in its own shadow; each tuft a shade off`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      normal = normalize(normal + (vU * d.x + vV * d.y) * 2. * min(k, 1.) * (1. - far));`);   // round tips: the tuft's side leans away from its centre
  };
  const pile = new THREE.InstancedMesh(disc, mat, N), m = new THREE.Matrix4();
  for (let i = 0; i < N; i++) pile.setMatrixAt(i, m.makeTranslation(0, H * (i + 1) / N, 0));
  pile.position.y = BASE; pile.receiveShadow = backing.receiveShadow = hem.receiveShadow = true;
  return new THREE.Group().add(backing, hem, pile);
}
