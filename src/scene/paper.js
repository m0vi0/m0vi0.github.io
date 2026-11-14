import * as THREE from 'three';

// the paper-ball game: a wire wastebin on the floor and crumpled paper balls (spawn: up to MAX, from the notepad), shot at the bin with a
// slingshot pull (aim, launch; predict draws the arc first); they stay where they land. A sticky note keeps the tally. In metres, y up, every
// position in world space (the caller adds grp to the room root at the origin)
const R = .03, B0 = .10, B1 = .12, BH = .28, BASE = .004, RIM = .006, E = .35, G = 6, GF = 9.81;   // ball radius; bin bottom/top radius, height, base; G: a softened fall (floatier arcs), GF: real g for friction
export const MAX = 12;                                       // balls in all: the notepad's sheets
// friction (Coulomb, as a share of g) on the desk and the furniture, the floor, the rug; air drag on a 5 g, 6 cm ball (1/2 rho Cd A / m, per metre);
// the slingshot: the sling sits LIFT over where a ball lay, a pull reaches PULL at most and throws at VMAX then; a shorter one than SLACK is let go
const MU = { desk: .35, floor: .6, rug: .9 }, AIR = .17, LIFT = .12, PULL = .25, VMAX = 5, SLACK = .03;

export function buildPaper({ bin, desk, room, solids = [desk], rug = null, note = null }) {   // solids: boxes balls bounce off (the desk first); rug: { x, z, r };
  // note: where the tally sticky note goes, { at, face } (its centre, the way it faces)
  const grp = new THREE.Group(), top = bin.y + BH;
  const metal = new THREE.MeshStandardMaterial({ color: '#2a2a2a', metalness: .7, roughness: .4 });
  const wire = metal.clone(); wire.side = THREE.DoubleSide; wire.alphaTest = .5;
  if (typeof document !== 'undefined') {                   // headless (paperCheck under node) has no canvas; the physics doesn't need the mesh
    const cv = Object.assign(document.createElement('canvas'), { width: 256, height: 256 }), g = cv.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#fff'; g.lineWidth = 5;
    for (let k = -256; k <= 512; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 256, 256); g.moveTo(k, 0); g.lineTo(k - 256, 256); g.stroke(); }   // 45° both ways: tiles seamlessly
    const a = wire.alphaMap = new THREE.CanvasTexture(cv); a.wrapS = a.wrapT = THREE.RepeatWrapping; a.repeat.set(4, 2);   // whole repeats round, so the seam closes; ~2 cm diamonds
  }
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); grp.add(o); return o; };
  add(new THREE.CylinderGeometry(B1, B0, BH, 48, 1, true), wire, bin.x, bin.y + BH / 2, bin.z);   // the wall, flaring to the top
  add(new THREE.TorusGeometry(B1, .004, 8, 48), metal, bin.x, top, bin.z).rotation.x = Math.PI / 2;   // rim
  add(new THREE.CylinderGeometry(B0, B0, BASE, 48), metal, bin.x, bin.y + BASE / 2, bin.z);           // base
  // balls: an icosphere with each vertex pushed in or out, the same for every copy of a vertex (the faces don't share them), so it stays closed
  let seed = 7;
  const rnd = () => { seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const paper = new THREE.MeshStandardMaterial({ color: '#f2efe6', roughness: .9, flatShading: true });
  const crumple = () => {
    const geo = new THREE.IcosahedronGeometry(R, 2), a = geo.attributes.position, f = new Map();
    for (let i = 0; i < a.count; i++) {
      const id = [a.getX(i), a.getY(i), a.getZ(i)].map(v => Math.round(v * 1e5)).join();   // round: -0 and 0 are the same vertex
      if (!f.has(id)) f.set(id, .82 + rnd() * .3);
      a.setXYZ(i, a.getX(i) * f.get(id), a.getY(i) * f.get(id), a.getZ(i) * f.get(id));
    }
    geo.computeVertexNormals(); return geo;
  };
  const balls = [];
  // the tally: a yellow sticky note (where note says); strokes in fives, redrawn on each score
  let tally = null;
  if (typeof document !== 'undefined') {
    const cv = Object.assign(document.createElement('canvas'), { width: 256, height: 256 }), g = cv.getContext('2d'), map = new THREE.CanvasTexture(cv);
    map.colorSpace = THREE.SRGBColorSpace; map.userData.live = true;   // redrawn on each score
    tally = n => {
      g.fillStyle = '#ffd94a'; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(0, 0, 256, 34);   // the sticky strip
      g.fillStyle = '#1b1b1b'; g.font = '44px "Bebas Neue", Impact, sans-serif'; g.fillText('IN THE BIN', 20, 82);
      g.strokeStyle = '#1b1b1b'; g.lineWidth = 6; g.lineCap = 'round';
      for (let k = 0; k < n; k++) {                         // 4 down, the 5th across them; up to 15 fit, past that the count
        const gr = k / 5 | 0, i = k % 5, x = 24 + (gr % 3) * 76, y = 104 + (gr / 3 | 0) * 74;
        if (gr > 5) break;
        g.beginPath(); i < 4 ? (g.moveTo(x + i * 14, y), g.lineTo(x + i * 14 + 3, y + 56)) : (g.moveTo(x - 8, y + 46), g.lineTo(x + 58, y + 10)); g.stroke();
      }
      map.needsUpdate = true;
    };
    tally(0);
    if (note) { const m = add(new THREE.PlaneGeometry(.08, .08), new THREE.MeshStandardMaterial({ map, roughness: .85 }), ...note.at.toArray()); m.lookAt(note.at.clone().add(note.face)); m.rotateZ(.05); }   // a little askew
  }
  const n = new THREE.Vector3(), q = new THREE.Vector3(), t = new THREE.Vector3(), ax = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), spin = new THREE.Quaternion();
  let score = 0, h = 1 / 240;
  // push b out along n by depth; bounce its speed into n by E (slow ones die, so balls settle). On something under it, friction mu slows the
  // sliding part by mu g per second, down to a stop (walls and the bin are slippery: mu 0)
  const hit = (b, depth, mu = 0) => {
    b.p.addScaledVector(n, depth);
    const vn = b.v.dot(n);
    if (vn < 0) b.v.addScaledVector(n, -(vn < -.3 ? 1 + E : 1) * vn);
    if (n.y > .7) {
      b.sup = true;                                           // something under it: it may come to rest
      t.copy(b.v).addScaledVector(n, -b.v.dot(n)); const ts = t.length(), cut = mu * GF * n.y * h;
      if (ts > 1e-9) b.v.addScaledVector(t, -Math.min(cut, ts) / ts);
    }
  };
  // two balls touching (n from o to b, d deep). Equal masses: they split the overlap and trade the closing part of their speeds (E).
  // A resting ball touched gently stays put, so a pile holds; knocked, it wakes and goes
  const knock = (b, o, d) => {
    if (o.sleep && b.v.dot(n) > -.15) return hit(b, d);
    o.sleep = false; o.still = 0;
    b.p.addScaledVector(n, d / 2); o.p.addScaledVector(n, -d / 2);
    const rel = b.v.dot(n) - o.v.dot(n);
    if (rel < 0) { const j = -(1 + E) * rel / 2; b.v.addScaledVector(n, j); o.v.addScaledVector(n, -j); }
    if (n.y > .7) b.sup = true; else if (n.y < -.7) o.sup = true;
  };
  const onRug = p => rug && Math.hypot(p.x - rug.x, p.z - rug.z) < rug.r;
  const sub = b => {
    const p = b.p; b.v.y -= G * h; b.v.multiplyScalar(1 - Math.min(AIR * b.v.length() * h, 1)); p.addScaledVector(b.v, h); b.sup = false;   // gravity, air drag
    if (p.y < -3) { b.v.set(0, 0, 0); b.s = 'gone'; b.sleep = true; b.m.visible = false; return; }   // off the open edge of the floor: gone (hidden, and not grabbable) until the reset
    if (b.s === 'fly' && b.axis) {                            // a throw stays on its axis, in the upright plane through it, until it lands or settles
      const { o, d } = b.axis, side = (p.x - o.x) * -d.z + (p.z - o.z) * d.x, vs = b.v.x * -d.z + b.v.z * d.x;
      p.x += d.z * side; p.z -= d.x * side; b.v.x += d.z * vs; b.v.z -= d.x * vs;
    }
    const rx = p.x - bin.x, rz = p.z - bin.z, rho = Math.hypot(rx, rz);
    if (b.s === 'fly' && rho < B1 - R && p.y < top && b.v.y < 0) { b.s = 'in'; if (!b.ghost) { score++; tally?.(score); api.onScore?.(score); } }   // through the mouth, going down (a ghost: predict's stand-in)
    const F = room.floor;
    if (p.y < F + R && p.y > F - R && p.x >= room.x0 && p.x <= room.x1 && p.z >= room.z0 && p.z <= room.z1) n.set(0, 1, 0), hit(b, F + R - p.y, onRug(p) ? MU.rug : MU.floor);
    if (p.x < room.x0 + R) n.set(1, 0, 0), hit(b, room.x0 + R - p.x);
    if (p.z < room.z0 + R) n.set(0, 0, 1), hit(b, room.z0 + R - p.z);
    let l;
    for (const S of solids) {                                 // the desk and the furniture as solid boxes: out from the closest point
      q.copy(p).clamp(S.min, S.max); n.subVectors(p, q); l = n.length();
      if (l < R) l > 1e-6 ? (n.divideScalar(l), hit(b, R - l, MU.desk)) : (n.set(0, 1, 0), hit(b, S.max.y + R - p.y, MU.desk));
    }
    if (b.s === 'in') {                                       // inside: held by the tapered wall, down to the base
      const ri = B0 + (B1 - B0) * (p.y - bin.y) / BH - R;
      if (rho > ri) n.set(-rx / rho, 0, -rz / rho), hit(b, rho - ri);
      if (p.y < bin.y + BASE + R) n.set(0, 1, 0), hit(b, bin.y + BASE + R - p.y);
    } else if (p.y < top && p.y > bin.y - R && rho > B1 - R && rho < B1 + R) n.set(rx / rho, 0, rz / rho), hit(b, B1 + R - rho);   // outside: off the wall
    if (rho > 1e-6) {                                         // the rim: out from the closest point on its circle
      q.set(bin.x + rx / rho * B1, top, bin.z + rz / rho * B1); n.subVectors(p, q); l = n.length();
      if (l < R + RIM) n.divideScalar(l), hit(b, R + RIM - l);
    }
    if (!b.ghost) for (const o of balls) if (o !== b && o.s !== 'aim' && o.s !== 'gone') { n.subVectors(p, o.p); l = n.length(); if (l < 2 * R && l > 1e-6) n.divideScalar(l), knock(b, o, 2 * R - l); }
    if (b.sup && b.v.lengthSq() < .0025) { if ((b.still += h) > .15) { b.v.set(0, 0, 0); b.sleep = true; if (b.s === 'fly') b.s = 'rest'; } } else b.still = 0;
  };
  const api = {
    grp, balls, onScore: null,
    // a new ball at p, resting (m: its mesh, the notepad's crumpled sheet; headless, a plain crumple); null once MAX are out
    spawn(p, m = new THREE.Mesh(crumple(), paper)) {
      if (balls.length >= MAX) return null;
      const b = { m, p: p.clone(), v: new THREE.Vector3(), s: 'rest', sleep: true, still: 0, sup: false };
      m.position.copy(p); m.userData.ball = b; grp.add(m); balls.push(b);   // userData: a raycast hit finds its ball
      return b;
    },
    // the slingshot. The first aim lifts the ball into the sling, LIFT over where it lay, and sets its axis: the level line from there through
    // the bin's centre. Then p (where the pointer is, in the upright plane through that axis) pulls it from the sling by however far p has moved
    // since, up to PULL: back from the bin and down throws forward and up. Kept inside the room, over the floor and on top of the furniture.
    // b.shot: the throw this pull makes, the sling's pull back to its middle
    aim(b, p) {
      if (b.s !== 'aim') {
        b.v.set(0, 0, 0); Object.assign(b, { s: 'aim', sleep: true, still: 0 });
        b.axis = { o: b.p.clone().setY(0), d: new THREE.Vector3(bin.x - b.p.x, 0, bin.z - b.p.z) };
        if (b.axis.d.lengthSq() < 1e-6) b.axis.d.set(1, 0, 0); b.axis.d.normalize();
        b.anchor = b.p.clone(); b.anchor.y = Math.min(b.anchor.y + LIFT, room.floor + 2.4); b.from = p.clone(); b.shot = new THREE.Vector3();
      }
      const { d } = b.axis, A = b.anchor, k = (p.x - b.from.x) * d.x + (p.z - b.from.z) * d.z, dy = p.y - b.from.y, s = Math.min(1, PULL / (Math.hypot(k, dy) || 1));
      const T = b.p.set(A.x + d.x * k * s, A.y + dy * s, A.z + d.z * k * s);
      T.x = Math.min(Math.max(T.x, room.x0 + R), room.x1 - R); T.z = Math.min(Math.max(T.z, room.z0 + R), room.z1 - R); T.y = Math.max(T.y, room.floor + R);
      for (const S of solids) if (T.x > S.min.x - R && T.x < S.max.x + R && T.z > S.min.z - R && T.z < S.max.z + R && T.y < S.max.y + R) T.y = S.max.y + R;   // not into the desk
      b.m.position.copy(T); b.shot.subVectors(A, T).multiplyScalar(VMAX / PULL);
    },
    // the same from the pointer's ray: where it meets that upright plane (before the first aim: the plane to the bin through the ball). Seen
    // edge-on the plane says little, so then the ray meets the level plane at the ball's height instead
    aimRay(b, ray) {
      const o = b.axis && b.s === 'aim' ? b.axis.o : b.p, d = b.axis && b.s === 'aim' ? b.axis.d : t.set(bin.x - b.p.x, 0, bin.z - b.p.z).normalize();
      n.set(-d.z, 0, d.x);
      const den = ray.direction.dot(n), up = Math.abs(den) > .2;
      const tt = up ? q.subVectors(o, ray.origin).dot(n) / den : (b.p.y - ray.origin.y) / ray.direction.y;
      if (tt > 0 && Number.isFinite(tt)) this.aim(b, ray.at(tt, new THREE.Vector3()));
    },
    // let go: the sling throws it (v: a test's own throw). A pull under SLACK is no shot: it drops back from the sling
    launch(b, v = b.shot) {
      const slack = v === b.shot && b.anchor && b.p.distanceTo(b.anchor) < SLACK;
      b.v.copy(slack || !v ? new THREE.Vector3() : v).clampLength(0, VMAX); Object.assign(b, { s: 'fly', sleep: false, still: 0 });
    },
    // where a throw from b with v goes: a stand-in run through the same physics (no scoring, no knocks) to its first touch, into the bin, or off
    // the floor's edge, 3 s at most. points: every 5th step (48 a second)
    predict(b, v = b.shot) {
      const g = { p: b.p.clone(), v: v.clone(), s: 'fly', sleep: false, still: 0, sup: false, axis: b.axis, ghost: true, m: {} }, points = [];
      h = 1 / 240;
      for (let i = 0; i < 720; i++) { sub(g); if (i % 5 === 0) points.push(g.p.clone()); if (g.s !== 'fly' || g.sup || g.sleep) break; }
      return { points, end: g.p.clone(), inBin: g.s === 'in' };
    },
    flying: () => balls.some(b => !b.sleep),                  // true while a ball moves
    step(dt) {
      dt = Math.min(dt, .05);                                 // a stalled frame (tab away) shouldn't tunnel balls through things
      const k = Math.ceil(dt * 240); h = dt / k;
      for (const b of balls) if (!b.sleep) {
        q.copy(b.p);
        for (let i = 0; i < k && !b.sleep; i++) sub(b);
        t.subVectors(b.p, q); ax.crossVectors(Y, t);          // roll it by its travel, round the axis across its path
        const a = t.length() / R;
        if (a > 1e-6 && ax.lengthSq() > 1e-12) b.m.quaternion.premultiply(spin.setFromAxisAngle(ax.normalize(), a));
        b.m.position.copy(b.p);
      }
    },
  };
  return api;
}

// headless self-check: a ball dropped over the bin's centre lands in it and scores; one dropped .5 m off lands on the floor and stays there;
// the slingshot lifts, pulls at most PULL along its axis, and lets a slack pull go; predict lands where a real throw first touches, and knows a
// basket; spawn stops at MAX; a slid ball stops (sooner on the rug); a moving ball knocks a resting one; a box is solid
export function paperCheck() {
  const world = (o = {}) => buildPaper({ bin: new THREE.Vector3(0, -1, 0), desk: new THREE.Box3(new THREE.Vector3(5, -1, 5), new THREE.Vector3(6, -.25, 6)), room: { x0: -3, z0: -3, x1: 3, z1: 3, floor: -1 }, ...o });
  const run = (g, sec) => { for (let i = 0; i < sec * 60; i++) g.step(1 / 60); };
  const g = world(), got = []; g.onScore = t => got.push(t);
  const a = g.spawn(new THREE.Vector3(0, -.4, 0)), b = g.spawn(new THREE.Vector3(.5, -.4, 0));
  g.launch(a, new THREE.Vector3()); g.launch(b, new THREE.Vector3()); run(g, 5);
  // the sling: on the floor at (2, 2), its axis toward the bin at the origin; a pull 1 m back and .3 m down, past PULL; then a slack one
  const c = g.spawn(new THREE.Vector3(2, -1 + R, 2)), rest = c.p.clone(), d = new THREE.Vector3(-2, 0, -2).normalize(), p0 = new THREE.Vector3(2.1, 0, 2);
  g.aim(c, p0); const lifted = c.p.y - rest.y;
  g.aim(c, p0.clone().addScaledVector(d, -1).add(new THREE.Vector3(0, -.3, 0)));
  const pull = c.p.distanceTo(c.anchor), side = Math.abs((c.p.x - rest.x) * -d.z + (c.p.z - rest.z) * d.x), fwdUp = c.shot.dot(d) > 0 && c.shot.y > 0, speed = c.shot.length();
  g.aim(c, p0.clone().addScaledVector(d, -.01)); g.launch(c); const slack = c.v.length();
  run(g, 3); const back = Math.hypot(c.p.x - rest.x, c.p.z - rest.z);
  for (let i = 3; i < MAX; i++) g.spawn(new THREE.Vector3(5.2 + i * .06, -.25 + R, 5.2));
  // predict vs a real throw (first touch, stepped at predict's own 1/240 s): one onto the floor, and the first of a sweep that predicts a basket
  const touch = (o, v) => { const w = world(), x = w.spawn(o); const pr = w.predict(x, v); w.launch(x, v); for (let i = 0; i < 720 && !x.sup && x.s === 'fly'; i++) w.step(1 / 240); return { pr, at: x.p.clone(), s: x.s }; };
  const fl = touch(new THREE.Vector3(-2, -.5, -2), new THREE.Vector3(2, 1.5, .5));
  let bk = null; for (let sp = 1; sp < 4 && !bk; sp += .05) { const t = touch(new THREE.Vector3(-1.2, -.3, 0), new THREE.Vector3(sp, 1.2, 0)); if (t.pr.inBin) bk = t; }
  // slides: 2 m/s along the floor, and along the rug
  const slide = rug => { const w = world({ rug }), e = w.spawn(new THREE.Vector3(-2.5, -1 + R, 2)); e.v.set(2, 0, 0); e.sleep = false; run(w, 4); return e.sleep ? e.p.x + 2.5 : Infinity; };
  const onFloor = slide(null), onRug = slide({ x: -2, z: 2, r: 1 });
  // a knock: one rolling at 2 m/s into one at rest
  const w = world(), k0 = w.spawn(new THREE.Vector3(1.5, -1 + R, -1)), k1 = w.spawn(new THREE.Vector3(1.25, -1 + R, -1)); k1.v.set(2, 0, 0); k1.sleep = false; run(w, 3);
  // a box: thrown at it, it bounces off
  const box = new THREE.Box3(new THREE.Vector3(-1, -1, 1.5), new THREE.Vector3(-.5, 0, 2)), sw = world({ solids: [new THREE.Box3(new THREE.Vector3(5, -1, 5), new THREE.Vector3(6, -.25, 6)), box] });
  const sb = sw.spawn(new THREE.Vector3(-2, -.5, 1.75)); sb.v.set(3, .5, 0); sb.s = 'fly'; sb.sleep = false; run(sw, 3);
  const checks = [
    [a.s === 'in' && a.sleep && Math.abs(a.p.y - (-1 + BASE + R)) < .002, `dropped over the bin: in, on its base (${a.s}, y ${a.p.y.toFixed(4)})`],
    [got.join() === '1', `onScore fired once with 1 (${got})`],
    [b.s === 'rest' && Math.abs(b.p.y - (-1 + R)) < .002 && Math.abs(b.p.x - .5) < .05, `dropped .5 m off: stays on the floor (${b.s}, ${b.p.x.toFixed(2)}, y ${b.p.y.toFixed(4)})`],
    [Math.abs(lifted - LIFT) < 1e-6, `the sling lifts it ${LIFT} m (${lifted.toFixed(3)})`],
    [Math.abs(pull - PULL) < 1e-3 && side < 1e-3 && fwdUp && Math.abs(speed - VMAX) < 1e-3, `a long pull stops at PULL on its axis and shoots forward-up at VMAX (${pull.toFixed(3)}, ${side.toFixed(4)}, ${speed.toFixed(2)})`],
    [slack === 0 && back < .02, `a slack pull drops back where it lay (${slack}, ${back.toFixed(3)} m)`],
    [g.balls.length === MAX && g.spawn(new THREE.Vector3()) === null, `spawn stops at ${MAX} (${g.balls.length})`],
    [fl.pr.end.distanceTo(fl.at) < .02 && !fl.pr.inBin, `predict lands where a real throw first touches (${fl.pr.end.distanceTo(fl.at).toFixed(4)} m off)`],
    [!!bk && bk.s === 'in' && bk.pr.end.distanceTo(bk.at) < .02, `a predicted basket really goes in (${bk?.s}, ${bk && bk.pr.end.distanceTo(bk.at).toFixed(4)} m off)`],
    [onFloor > .2 && onFloor < 1.5, `slid at 2 m/s on the floor: stops in .2-1.5 m (${onFloor.toFixed(2)})`],
    [onRug < onFloor, `on the rug it stops sooner (${onRug.toFixed(2)} < ${onFloor.toFixed(2)})`],
    [k0.p.x > 1.55 && k0.sleep, `a knock moves the resting ball, which settles again (${k0.p.x.toFixed(2)})`],
    [box.distanceToPoint(sb.p) > R - 1e-3, `a box is solid (${box.distanceToPoint(sb.p).toFixed(3)} from it)`],
  ];
  for (const [ok, msg] of checks) console.assert(ok, msg);
  return checks.every(([ok]) => ok);
}
