import * as THREE from 'three';

// a yellow legal pad on the desk: tear off its top sheet and it crumples into a paper ball (crumpleSheet), which paper.js then throws about.
// In metres: the pad lies on its back, its centre at the origin, its glued edge to -z
const W = .15, D = .21, BACK = .002, LEAF = .0008, GLUE = .012, R = .03;   // A5-ish; a sheet is drawn thicker than paper, so the stack reads

let lined = null;                                             // the sheet's face, shared by the pad's top and every torn sheet
function sheetTex() {
  if (lined) return lined;
  const c = Object.assign(document.createElement('canvas'), { width: 512, height: 717 }), g = c.getContext('2d');
  g.fillStyle = '#fbe97a'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#86a9d6'; g.lineWidth = 2;
  for (let y = 70; y < c.height; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke(); }   // the rules
  g.strokeStyle = '#df6a74'; for (const x of [62, 67]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke(); }   // the margin
  lined = new THREE.CanvasTexture(c); lined.colorSpace = THREE.SRGBColorSpace; lined.anisotropy = 8;
  return lined;
}

export function buildNotepad(sheets) {
  const grp = new THREE.Group(), paper = new THREE.MeshStandardMaterial({ color: '#f3e27a', roughness: .9 });
  const top = new THREE.MeshStandardMaterial({ map: sheetTex(), roughness: .9 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, BACK, D), new THREE.MeshStandardMaterial({ color: '#8a6b4a', roughness: .95 }));
  back.position.y = BACK / 2;
  const stack = new THREE.Mesh(new THREE.BoxGeometry(W, 1, D), [paper, paper, top, paper, paper, paper]);   // +y: the top sheet's rules
  const glue = new THREE.Mesh(new THREE.BoxGeometry(W + .001, 1, GLUE), new THREE.MeshStandardMaterial({ color: '#7a1f2b', roughness: .7 }));   // the gummed band
  glue.position.z = -D / 2 + GLUE / 2;
  grp.add(back, stack, glue);
  for (const o of grp.children) o.castShadow = o.receiveShadow = true;
  let left = sheets;
  const fit = () => {                                         // the stack as thick as the sheets left; empty, the bare cardboard (and the glue's stub)
    const h = Math.max(left, .3) * LEAF;
    stack.visible = left > 0; stack.scale.y = h; stack.position.y = BACK + h / 2;
    glue.scale.y = h + .001; glue.position.y = BACK + (h + .001) / 2;
  };
  fit();
  return {
    grp, W, D,
    get left() { return left; },
    topY: () => BACK + left * LEAF,                           // the top sheet's face, in the pad's frame
    take() { if (!left) return false; left--; fit(); return true; },
  };
}

// a sheet of the pad that crumples: set(k) eases its vertices from flat (0, lying where the top sheet was) to a closed ball of radius ~R (1)
// centred at the origin. The square maps onto the sphere octahedrally (its edges fold onto each other), so the ball closes with no seam;
// its dents are a function of the direction only, so the folded-together points dent alike
export function crumpleSheet(seed = 1) {
  const geo = new THREE.PlaneGeometry(W, D, 28, 40).rotateX(-Math.PI / 2), pos = geo.attributes.position, uv = geo.attributes.uv;
  const n = pos.count, flat = Float32Array.from(pos.array), ball = new Float32Array(n * 3), fold = new Float32Array(n * 3), v = new THREE.Vector3();
  const dent = (x, y, z) => .82 + .14 * Math.sin(seed * 3.1 + 9 * x + 5 * y) * Math.sin(7 * z - 4 * x + seed) + .1 * Math.abs(Math.sin(13 * y + 11 * z + seed * 1.7));
  for (let i = 0; i < n; i++) {
    let x = uv.getX(i) * 2 - 1, z = uv.getY(i) * 2 - 1, y = 1 - Math.abs(x) - Math.abs(z);
    if (y < 0) { const ox = x; x = (1 - Math.abs(z)) * Math.sign(ox || 1); z = (1 - Math.abs(ox)) * Math.sign(z || 1); }   // the lower half, folded over
    v.set(x, y, z).normalize();
    const f = dent(v.x, v.y, v.z) * R;
    ball[i * 3] = v.x * f; ball[i * 3 + 1] = v.y * f; ball[i * 3 + 2] = v.z * f;
    fold[i * 3] = Math.sin(v.y * 8 + seed) * .012; fold[i * 3 + 1] = Math.abs(Math.sin(v.x * 9 - v.z * 6 + seed)) * .02; fold[i * 3 + 2] = Math.sin(v.x * 7 + seed * 2) * .012;   // mid-crumple: creases, lifting
  }
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: sheetTex(), roughness: .9, side: THREE.DoubleSide, flatShading: true }));
  mesh.castShadow = mesh.receiveShadow = true;
  const set = k => {
    const e = k * k * (3 - 2 * k), w = Math.sin(Math.PI * k), a = pos.array;
    for (let i = 0; i < n * 3; i++) a[i] = flat[i] + (ball[i] - flat[i]) * e + fold[i] * w;
    pos.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
    mesh.position.y = e * R + w * .06;                       // it lifts off the pad as it crumples, and ends sitting on it
  };
  set(0);
  return { mesh, set };
}
