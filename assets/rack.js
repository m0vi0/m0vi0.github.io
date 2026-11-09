// 3D rack built from the HTML inventory (.rack > li). The inventory stays the source of truth and the fallback.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('rack3d');
if (canvas && !reduce) start().catch(err => { console.warn('rack: 3D off', err); document.documentElement.classList.remove('has-3d'); });

// Bay of assets/rack.glb after scripts/prep-rack.mjs (measured from the model).
const BAY = { top: 0.783, bottom: -0.784, front: 0.299, back: -0.265, half: 0.259 };
const UNITS = 20, U = (BAY.top - BAY.bottom) / UNITS;
const FACE_W = 0.6;                        // faceplate incl. rack ears
const PX = 1024 / FACE_W;                  // canvas px per world unit
const C = { powder: '#c9cec9', powderHi: '#d8dcd7', ink: '#151515', white: '#f3f3ee', yellow: '#f2c418', done: '#35c25f', wip: '#ff9d0a', vent: '#2a2d2b' };

async function start() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(1.5, 2.5, 3);
  scene.add(key);

  let portal = null;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 50);
  const look = new THREE.Vector3(0, 0.3, 0);

  await document.fonts.load('700 48px Archivo');
  const [gltf] = await Promise.all([new GLTFLoader().loadAsync(new URL('rack.glb', import.meta.url).href)]);
  const rackRoot = new THREE.Group();
  rackRoot.add(gltf.scene);
  scene.add(rackRoot);

  // ---- units from the inventory ----
  const items = [...document.querySelectorAll('.rack > li')];
  const units = [];
  let slot = UNITS - 1;                                    // start one U below the top: a blank vent panel goes there
  addBlank(UNITS, 1);
  for (const li of items) {
    const h = +li.dataset.u || 1;
    const topU = slot;                                     // U number of this unit's top row
    units.push(makeUnit(li, h, topU));
    slot -= h;
    if (li.dataset.kind === 'project' && li.nextElementSibling?.dataset.kind !== 'project') { addBlank(slot, 1); slot -= 1; }
  }
  while (slot >= 1) { const h = slot >= 2 ? 2 : 1; addBlank(slot, h); slot -= h; }

  function yOf(topU, h) { return BAY.bottom + (topU - h / 2) * U; } // centre y; U1 at the bottom, like a real rack

  function faceCanvas(h) {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = Math.round(h * U * PX);
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, c.height);
    grad.addColorStop(0, C.powderHi); grad.addColorStop(1, C.powder);
    g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(0, 0, c.width, 2);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, c.height - 2, c.width, 2);
    // rack ears with screws
    for (const x of [30, c.width - 30]) {
      for (const y of h > 1 ? [c.height * .25, c.height * .75] : [c.height / 2]) {
        g.fillStyle = '#8d938e'; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill();
        g.fillStyle = '#e4e6e1'; g.beginPath(); g.arc(x - 2, y - 2, 5, 0, 7); g.fill();
      }
    }
    return { c, g };
  }
  function vents(g, x0, x1, h) {
    g.fillStyle = C.vent;
    for (let x = x0; x < x1; x += 16) g.fillRect(x, h * .28, 7, h * .44);
  }
  function tape(g, text, x, cy, size, yellow) {
    g.font = `700 ${size}px Archivo`;
    if ('fontStretch' in g) g.fontStretch = 'condensed';
    const label = text.toUpperCase(), w = g.measureText(label).width, pad = size * .45, th = size * 1.35;
    g.fillStyle = yellow ? C.yellow : C.ink;
    g.beginPath(); g.roundRect(x, cy - th / 2, w + pad * 2, th, 3); g.fill();
    g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x + 2, cy - th / 2 + 1, w + pad * 2 - 4, 2);
    g.fillStyle = yellow ? C.ink : C.white; g.textBaseline = 'middle';
    g.fillText(label, x + pad, cy + size * .04);
    return x + w + pad * 2;
  }

  function makeUnit(li, h, topU) {
    const kind = li.dataset.kind;
    const { c, g } = faceCanvas(h);
    const H = c.height, ports = [];
    if (kind === 'ports' || kind === 'contact') {
      const links = [...li.querySelectorAll('.ports [data-tape]')];
      tape(g, li.dataset.tape, 70, kind === 'contact' ? H / 2 : H * .3, 30);
      const cols = kind === 'contact' ? links.length : 5, rows = Math.ceil(links.length / cols);
      const x0 = kind === 'contact' ? 290 : 70, x1 = 960, cw = (x1 - x0) / cols;
      links.forEach((a, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const cx = x0 + cw * col + cw / 2, cy = kind === 'contact' ? H / 2 : H * (.56 + row * .27);
        const pw = Math.min(cw - 16, kind === 'contact' ? 150 : 150), ph = kind === 'contact' ? H * .55 : H * .2;
        g.fillStyle = '#9aa09b'; g.fillRect(cx - pw / 2 - 3, cy - ph / 2 - 3, pw + 6, ph + 6);
        g.fillStyle = C.ink; g.fillRect(cx - pw / 2, cy - ph / 2, pw, ph);
        g.fillStyle = a.closest('li').dataset.status === 'wip' ? C.wip : C.done;
        g.beginPath(); g.arc(cx + pw / 2 - 10, cy - ph / 2 + 10, 5, 0, 7); g.fill();
        g.font = `700 ${kind === 'contact' ? 24 : 17}px Archivo`;
        if ('fontStretch' in g) g.fontStretch = 'condensed';
        g.fillStyle = C.white; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(a.dataset.tape.toUpperCase(), cx, cy + 1, pw - 12);
        g.textAlign = 'left';
        ports.push({ el: a, x0: (cx - pw / 2) / 1024, x1: (cx + pw / 2) / 1024, y0: 1 - (cy + ph / 2) / H, y1: 1 - (cy - ph / 2) / H, label: a.dataset.tape });
      });
    } else {
      const end = tape(g, li.dataset.tape, 70, H / 2, h > 1 ? 44 : 30, kind === 'resume');
      vents(g, Math.max(end + 50, 560), 900, H);
      if (h > 1) { // two drive bays
        g.fillStyle = '#b4bab5'; g.fillRect(70, H * .78, 220, 10); g.fillRect(310, H * .78, 220, 10);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const unit = rackBox(h, topU, tex);
    const led = li.dataset.status === 'wip' ? C.wip : C.done;
    if (kind !== 'ports' && kind !== 'contact') {
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0075, 20), new THREE.MeshBasicMaterial({ color: led, toneMapped: false }));
      dot.position.set(0.24, h > 1 ? U * .5 : 0, 0.0045);
      unit.add(dot);
    }
    const link = li.querySelector('h3 a');
    const u = { mesh: unit, li, kind, href: link?.getAttribute('href'), link, ports, label: li.dataset.tape, out: 0, target: 0, baseZ: unit.position.z };
    unit.userData.unit = u;
    return u;
  }
  function addBlank(topU, h) {
    const { c, g } = faceCanvas(h);
    vents(g, 120, 904, c.height);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    rackBox(h, topU, tex);
  }
  function rackBox(h, topU, tex) {
    const body = new THREE.MeshStandardMaterial({ color: 0xb9beb9, roughness: .7, metalness: .2 });
    const front = new THREE.MeshStandardMaterial({ map: tex, roughness: .62, metalness: .1 });
    const group = new THREE.Group();
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(BAY.half * 2 - .006, h * U - .003, BAY.front - BAY.back - .02), body);
    chassis.position.z = -(BAY.front - BAY.back) / 2;
    const face = new THREE.Mesh(new THREE.BoxGeometry(FACE_W, h * U - .003, 0.008), [body, body, body, body, front, body]);
    group.add(chassis, face);
    group.position.set(0, yOf(topU, h), BAY.front + 0.004);
    rackRoot.add(group);
    return group;
  }

  // ---- layout / camera ----
  const stage = canvas.parentElement;
  let aspect = 1;
  const cam = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0 };
  function frame() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    aspect = w / h; camera.aspect = aspect; camera.updateProjectionMatrix();
  }
  function placeCamera() {
    if (portal) return;
    const dist = aspect < 1 ? 3 / Math.max(aspect, .55) : 4.2;
    const yaw = -0.42 + cam.yaw, pitch = 0.08 + cam.pitch;
    camera.position.set(Math.sin(-yaw) * dist, look.y + Math.sin(pitch) * dist, Math.cos(yaw) * dist);
    camera.lookAt(look);
  }
  document.documentElement.classList.add('has-3d');
  new ResizeObserver(() => { frame(); placeCamera(); render(); }).observe(stage);
  frame();

  // ---- picking ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const tip = stage.querySelector('.rack-tip');
  const faces = units.map(u => u.mesh.children[1]);
  let hot = null, hotPort = null;
  function pick(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(faces, false)[0];
    if (!hit) return { u: null, port: null };
    const u = hit.object.parent.userData.unit;
    const uv = hit.uv; // BoxGeometry front face uv spans the faceplate
    const port = u.ports.find(p => uv && uv.x >= p.x0 && uv.x <= p.x1 && uv.y >= p.y0 && uv.y <= p.y1) || null;
    return { u, port, x: ev.clientX - r.left, y: ev.clientY - r.top };
  }
  function setHot(u, port, x, y) {
    if (hot && hot !== u) { hot.target = 0; hot.li.classList.remove('is-hot'); }
    hot = u; hotPort = port;
    if (u) { u.target = 0.035; u.li.classList.add('is-hot'); }
    const clickable = u && (u.href || port);
    canvas.style.cursor = clickable ? 'pointer' : 'default';
    if (u && x != null) {
      const st = port ? (port.el.closest('li').dataset.status === 'wip' ? 'in progress' : 'running') : (u.kind === 'project' ? 'open writeup' : u.kind === 'resume' ? 'download PDF' : 'point at a port');
      tip.innerHTML = `${port ? port.label : u.label}<small>${st}</small>`;
      tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.hidden = false;
    } else tip.hidden = true;
    wake();
  }
  canvas.addEventListener('pointermove', ev => {
    if (portal) return;
    const p = pick(ev);
    setHot(p.u, p.port, p.x, p.y);
    const r = canvas.getBoundingClientRect();
    cam.tYaw = ((ev.clientX - r.left) / r.width - .5) * 0.14;
    cam.tPitch = ((ev.clientY - r.top) / r.height - .5) * 0.06;
  });
  canvas.addEventListener('pointerleave', () => { setHot(null); cam.tYaw = cam.tPitch = 0; });
  canvas.addEventListener('click', ev => {
    if (portal) return;
    const { u, port } = pick(ev);
    if (!u) return;
    if (port) return port.el.click();                      // ports open straight away (keeps the user gesture)
    if (u.kind === 'project') return enter(u);
    if (u.link) u.link.click();
  });
  // keyboard / inventory: mirror focus onto the 3D unit, and portal project links too
  for (const u of units) {
    u.li.addEventListener('focusin', () => setHot(u));
    u.li.addEventListener('focusout', () => setHot(null));
    if (u.kind === 'project') u.link.addEventListener('click', ev => {
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return;
      ev.preventDefault();
      stage.scrollIntoView({ behavior: 'instant', block: 'center' });
      enter(u);
    });
  }

  // ---- portal: slide out, tilt to face the viewer, pass through the faceplate ----
  const veil = Object.assign(document.createElement('div'), { className: 'portal-veil' });
  document.body.append(veil);
  function enter(u) {
    setHot(null);
    tip.hidden = true;
    portal = { u, t0: performance.now(), from: camera.position.clone(), look0: look.clone() };
    wake();
  }
  const ease = t => 1 - Math.pow(1 - t, 3), inOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function stepPortal(now) {
    const { u, t0, from, look0 } = portal, t = (now - t0) / 1000;
    const slide = ease(Math.min(t / .38, 1));               // 0–380ms: out on its rails
    const tilt = ease(Math.min(Math.max((t - .25) / .3, 0), 1)); // 250–550ms: turn to the viewer
    const dive = inOut(Math.min(Math.max((t - .4) / .55, 0), 1)); // 400–950ms: camera through the plate
    u.mesh.position.z = u.baseZ + slide * 0.42;
    const toCam = Math.atan2(from.x - u.mesh.position.x, from.z - u.mesh.position.z);
    u.mesh.rotation.y = tilt * toCam;
    u.mesh.rotation.x = -tilt * 0.21;                       // ~12°
    const faceWorld = new THREE.Vector3(0, 0, 0.01);
    u.mesh.localToWorld(faceWorld);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(u.mesh.quaternion);
    const dest = faceWorld.clone().addScaledVector(normal, -0.02);   // just behind the faceplate
    camera.position.lerpVectors(from, dest, dive);
    const lk = look0.clone().lerp(faceWorld.clone().addScaledVector(normal, -1), dive);
    camera.lookAt(lk);
    if (t > .78 && !veil.classList.contains('on')) veil.classList.add('on');
    if (t > 1.0 && !portal.gone) { portal.gone = true; location.href = u.href; }
  }
  addEventListener('pageshow', e => {                       // back button from a writeup: put the rack back
    if (!e.persisted) return;
    portal = null; veil.classList.remove('on');
    for (const u of units) { u.mesh.position.z = u.baseZ; u.mesh.rotation.set(0, 0, 0); u.out = u.target = 0; }
    placeCamera(); wake();
  });

  // ---- loop: runs only while something moves and the stage is on screen ----
  let running = false, visible = true, last = performance.now();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); }).observe(stage);
  document.addEventListener('visibilitychange', wake);
  function wake() { if (!running && visible && !document.hidden) { running = true; last = performance.now(); renderer.setAnimationLoop(tick); } }
  function tick(now) {
    const dt = Math.min((now - last) / 1000, .05); last = now;
    let moving = false;
    const k = 1 - Math.exp(-dt * 10);
    cam.yaw += (cam.tYaw - cam.yaw) * k; cam.pitch += (cam.tPitch - cam.pitch) * k;
    if (Math.abs(cam.tYaw - cam.yaw) > 1e-4 || Math.abs(cam.tPitch - cam.pitch) > 1e-4) moving = true;
    if (portal) { stepPortal(now); moving = true; }
    else {
      placeCamera();
      for (const u of units) {
        u.out += (u.target - u.out) * k;
        u.mesh.position.z = u.baseZ + u.out;
        if (Math.abs(u.target - u.out) > 1e-4) moving = true;
      }
    }
    render();
    if (!moving || !visible || document.hidden) { running = false; renderer.setAnimationLoop(null); }
  }
  function render() { renderer.render(scene, camera); }
  placeCamera(); render();
}
