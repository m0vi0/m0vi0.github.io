// Hero rack: the original black model; its 9 servers map to .rack > li (top to bottom).
// Scrolling flies the camera in to the top server, then down the rack one server per stop; each server wears its own label.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

// a refresh lands on the hero, not wherever the scan was left (a #section link still jumps)
history.scrollRestoration = 'manual';
if (!location.hash) scrollTo(0, 0);

const nav = document.querySelector('.nav');
const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 40);
addEventListener('scroll', onScroll, { passive: true }); onScroll();

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('rack3d');

// measured from assets/rack.glb (scripts/prep-rack.mjs): server fronts at z .299, name panel above the top server
const SERVER_FRONT = 0.299;
const PLATE = { w: 0.56, h: 0.16, y: 0.883, z: 0.3245 };
const VOLT = { pink: '#FF2D78', lime: '#BFFF00', blue: '#0057FF' };
const INK = '#F5F0E8', YELLOW = '#FFD400', LIME = '#BFFF00';
const CREASE = THREE.MathUtils.degToRad(40);
const STOPS = 11;                                            // hero, 9 servers, pull-back (= .stop count)
const JUMP = { '#top': 0, '#projects': 2, '#skills': 5, '#contact': 8 };
if (canvas) start().catch(err => { console.warn('rack: 3D off', err); document.documentElement.classList.remove('has-3d', 'scan-on'); });

async function start() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .9;

  // dim neutral room with soft grey panels: edges read without white studio highlights or a colour cast
  const scene = new THREE.Scene();
  scene.environment = softRoom(renderer);
  scene.environmentIntensity = 2;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 50);
  const look = new THREE.Vector3(0, 0, 0);
  let portal = null;
  const pages = new Map();                                   // project unit -> preloaded writeup <iframe>
  let mx = 0, my = 0, mxT = 0, myT = 0, focus = 0, focusT = 0;   // pointer depth (see stepDepth)

  await Promise.all(['500 64px "Space Grotesk"', '600 64px "Space Grotesk"', '64px "Bebas Neue"'].map(f => document.fonts.load(f)));
  const gltf = await new GLTFLoader().loadAsync(new URL('rack.glb', import.meta.url).href);
  const rackRoot = new THREE.Group();
  rackRoot.add(gltf.scene);
  scene.add(rackRoot);
  rackRoot.updateMatrixWorld(true);
  // clean matte charcoal (light enough to show its shape): drop the grimy colour, glow (fake LCD text) and AO/roughness maps, keep the normal map for shape
  const frameMesh = gltf.scene.getObjectByName('frame'), frameMat = frameMesh.material;
  frameMesh.geometry = toCreasedNormals(frameMesh.geometry, CREASE); // smooth the 2–3 facet bevels, keep flat faces flat
  Object.assign(frameMat, { map: null, emissiveMap: null, roughnessMap: null, metalnessMap: null, aoMap: null, roughness: .7, metalness: .2 });
  frameMat.color.set('#2a2a2a'); frameMat.emissive.set(0); frameMat.needsUpdate = true;
  const serverMat = frameMat.clone();
  serverMat.color.set('#333333');
  rackRoot.add(namePlate());

  // ---- servers: each gets a pivot at its centre so it can slide and turn in place, and a label on its face ----
  const items = [...document.querySelectorAll('.rack > li')];
  const units = items.map((li, i) => {
    const mesh = gltf.scene.getObjectByName(`server_${i}`);
    mesh.material = serverMat;
    const box = indexedBox(mesh);
    mesh.geometry = toCreasedNormals(mesh.geometry, CREASE);   // after indexedBox: this drops the index
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const pivot = new THREE.Group();
    pivot.position.copy(c);
    rackRoot.add(pivot);
    pivot.attach(mesh);
    const links = [...li.querySelectorAll('a')];
    const u = { i, li, mesh, pivot, links, link: links[0], w: size.x, h: size.y, d: size.z, frontZ: SERVER_FRONT - c.z, baseZ: c.z, out: 0, target: 0,
      project: !!li.dataset.volt, volt: VOLT[li.dataset.volt] };
    u.plate = faceLabel(u);
    pivot.add(u.plate);
    mesh.userData.unit = u;
    return u;
  });

  // the servers share one vertex buffer (scripts/prep-rack.mjs), so bound only the vertices each one indexes
  function indexedBox(mesh) {
    const pos = mesh.geometry.attributes.position, v = new THREE.Vector3(), box = new THREE.Box3();
    for (const k of mesh.geometry.index.array) box.expandByPoint(v.fromBufferAttribute(pos, k));
    return box.applyMatrix4(mesh.matrixWorld);
  }

  // covers the modelled maker's logo
  function namePlate() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = Math.round(1024 * PLATE.h / PLATE.w);
    const g = c.getContext('2d');
    g.fillStyle = '#151515'; g.fillRect(0, 0, c.width, c.height);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(PLATE.w, PLATE.h),
      new THREE.MeshStandardMaterial({ map: tex, roughness: .55, metalness: .3 }));
    plate.position.set(0, PLATE.y, PLATE.z);
    return plate;
  }

  // label strip printed over a server's front: LED, number, title, CTA / one line / chips (or a skills grid, or two link halves)
  function faceLabel(u) {
    const pw = u.w * .9, ph = u.h * .84, d = u.li.dataset;
    const c = document.createElement('canvas'), W = c.width = 2048, H = c.height = Math.round(W * ph / pw);
    const g = c.getContext('2d'), pad = 72, accent = u.volt ?? YELLOW;
    const font = (spec, size, text, max) => {                 // shrink until the text fits
      do g.font = spec.replace('#', size + 'px'); while (g.measureText(text).width > max && (size -= 2) > 20);
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
        space('0px'); g.fillStyle = '#cfcabf'; font('500 # "Space Grotesk"', 64, a.dataset.line, half - 2 * pad); g.fillText(a.dataset.line, x, row2 + 20);
      });
      g.fillStyle = 'rgba(245,240,232,.14)'; g.fillRect(half - 2, 40, 4, H - 80);
    } else {
      dot(pad + 14, row1, 16, accent);
      space('4px'); g.font = '600 40px "Space Grotesk"'; g.fillStyle = 'rgba(245,240,232,.5)'; g.textAlign = 'left';
      g.fillText(String(u.i + 1).padStart(2, '0'), pad + 52, row1);
      head(pad + 140, W - 2 * pad - 140, d.title, u.link && d.cta);
      if (d.items) {                                            // skills: 3 + 2 grid, dot colour = status
        const items = d.items.split('|').map(s => s.split(':')), colW = (W - 2 * pad) / 3;
        items.forEach(([name, status], k) => {
          const x = pad + (k % 3) * colW, y = k < 3 ? row2 : row3;
          dot(x + 12, y, 13, status === 'in progress' ? YELLOW : LIME);
          space('0px'); g.fillStyle = INK; g.textAlign = 'left';
          font('500 # "Space Grotesk"', 54, name, colW - 70); g.fillText(name, x + 42, y);
        });
        space('3px'); g.font = '600 32px "Space Grotesk"'; g.textAlign = 'left'; g.fillStyle = 'rgba(245,240,232,.6)';
        let lx = W - pad;                                       // legend, right of the title
        for (const [txt, col] of [['IN PROGRESS', YELLOW], ['RUNNING / DONE', LIME]]) {
          lx -= g.measureText(txt).width; g.fillText(txt, lx, row1); dot(lx - 26, row1, 11, col); lx -= 90;
        }
      } else {
        space('0px'); g.fillStyle = '#cfcabf'; g.textAlign = 'left';
        font('500 # "Space Grotesk"', 70, d.line, W - 2 * pad); g.fillText(d.line, pad, row2);
        let x = pad;
        space('5px'); g.font = '600 36px "Space Grotesk"'; g.strokeStyle = accent; g.lineWidth = 4;
        for (const tag of (d.tags ?? '').split('|').filter(Boolean)) {
          const t = tag.toUpperCase(), w = g.measureText(t).width + 48;
          g.strokeRect(x, row3 - 34, w, 68); g.fillStyle = INK; g.fillText(t, x + 24, row3 + 2); x += w + 20;
        }
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    m.position.z = u.frontZ + 0.002;
    return m;
  }

  // ---- scan mode: the page scroll picks a pose between stops (see .stops in index.html) ----
  const scan = document.querySelector('.scan'), hero = scan?.querySelector('.hero');
  const scanOn = !reduce && !!scan;
  document.documentElement.classList.add('has-3d');
  if (scanOn) {
    document.documentElement.classList.add('scan-on');
    document.querySelector('.hint').textContent = 'Scroll to scan the rack. Click a server to open it.';
  }
  let sTarget = 0, sCur = 0;
  const span = () => scan.offsetHeight - hero.offsetHeight;
  function readScroll() { sTarget = span() > 0 ? Math.min(Math.max(-scan.getBoundingClientRect().top / span(), 0), 1) * (STOPS - 1) : 0; }
  const goStop = n => scrollTo({ top: scan.getBoundingClientRect().top + scrollY + n * span() / (STOPS - 1) });

  // ---- layout / camera ----
  const stage = canvas.parentElement;
  let W = 1, H = 1, aspect = 1, poses = [];
  function frame() {
    W = stage.clientWidth; H = stage.clientHeight;
    renderer.setSize(W, H, false);
    aspect = W / H; camera.aspect = aspect; camera.updateProjectionMatrix();
    buildPoses();
  }
  function buildPoses() {
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    let far = Math.max(1.15 / t, 0.55 / (t * aspect)), heroFar = far, shift = [scanOn && aspect > 1.2 ? .2 : 0, 0]; // wide: rack right of the copy
    if (scanOn && aspect < 1) {                             // portrait: fit the rack between the first name and the copy
      const top = stage.getBoundingClientRect().top;
      const y0 = hero.querySelector('.wordmark .first').getBoundingClientRect().bottom - top;
      const y1 = hero.querySelector('.hero-copy').getBoundingClientRect().top - top;
      heroFar = Math.max(1.15 / (t * Math.max(y1 - y0, H * .3) / H), far);
      shift = [0, ((y0 + y1) / 2 - H / 2) / H];
    }
    const yaw = 0.46, pitch = 0.1;                         // shows the side with the hazard labels
    const heroPose = { pos: new THREE.Vector3(Math.sin(yaw) * heroFar, Math.sin(pitch) * heroFar, Math.cos(yaw) * heroFar), look: new THREE.Vector3(), shift };
    if (!scanOn) return poses = [heroPose];
    // head-on, far enough back that the cabinet sides and the yellow behind show
    const at = (y, w, h) => {
      const l = new THREE.Vector3(0, y, SERVER_FRONT);
      return { look: l, pos: l.clone().setZ(SERVER_FRONT + (aspect < 1 ? 1.4 : 1.8) * Math.max(w / (.92 * 2 * t * aspect), h / (.5 * 2 * t))), shift: [0, 0] };
    };
    poses = [heroPose, ...units.map(u => at(u.pivot.position.y, u.w, u.h)),
      { pos: new THREE.Vector3(0, 0, far), look: new THREE.Vector3(), shift: [0, 0] }];
  }
  function placeCamera() {
    if (portal) return;
    let a = poses[0], b = a, k = 0;
    if (poses.length > 1) {                                 // hold near each stop, move between them
      const i = Math.min(Math.max(Math.floor(sCur), 0), poses.length - 2), f = Math.min(Math.max((sCur - i - .2) / .6, 0), 1);
      a = poses[i]; b = poses[i + 1]; k = f * f * (3 - 2 * f);
    }
    camera.position.lerpVectors(a.pos, b.pos, k);
    look.lerpVectors(a.look, b.look, k);
    camera.lookAt(look);
    const q = 1 - Math.min(sCur, 1);                       // parallax fades out as the scan zooms in
    const sx = a.shift[0] + (b.shift[0] - a.shift[0]) * k - mx * .006 * q, sy = a.shift[1] + (b.shift[1] - a.shift[1]) * k - my * .006 * q;
    if (sx || sy) camera.setViewOffset(W, H, -sx * W, -sy * H, W, H); else if (camera.view?.enabled) camera.clearViewOffset();
  }
  let shown = -1;
  function updateScan() {
    hero.style.setProperty('--p', Math.min(sCur, 1).toFixed(3));
    hero.classList.toggle('is-close', sCur > .5);
    const n = Math.round(sCur) - 1;
    if (n !== shown) { shown = n; readout(units[n] ?? null); page(units[n]); }
  }
  new ResizeObserver(() => { frame(); placeCamera(); render(); }).observe(stage);
  frame();

  if (scanOn) {
    addEventListener('scroll', () => { readScroll(); wake(); }, { passive: true });
    document.addEventListener('click', e => {               // section links fly to their server instead of the hidden sections
      const a = e.target.closest('a[href^="#"]');
      if (a && a.hash in JUMP) { e.preventDefault(); goStop(JUMP[a.hash]); }
    });
    document.addEventListener('focusin', e => {             // keyboard on the hidden content: show its server
      const n = e.target.closest?.('[data-unit]')?.dataset.unit;
      if (n != null) goStop(+n + 1);
    });
  }

  // ---- picking ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const tip = stage.querySelector('.rack-tip');
  const count = document.getElementById('count'), countLabel = document.getElementById('count-label');
  const meshes = units.map(u => u.mesh);
  let hot = null;
  function pick(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(meshes, false)[0];
    return { u: hit?.object.userData.unit ?? null, hit, x: ev.clientX - r.left, y: ev.clientY - r.top };
  }
  function readout(u) {
    count.textContent = String(u ? u.i + 1 : 9).padStart(2, '0');
    countLabel.textContent = u ? u.li.dataset.label : 'servers';
  }
  function setHot(u, x, y) {
    if (hot && hot !== u) hot.target = 0;
    hot = u;
    if (u) { u.target = 0.035; page(u); }
    canvas.style.cursor = u?.link ? 'pointer' : 'default';
    if (!scanOn) readout(u);
    if (u && x != null && !scanOn) {                        // scan mode prints this on the faceplate instead
      tip.innerHTML = `${u.li.dataset.label}<small>${u.li.dataset.line ?? ''}</small>`;
      tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.hidden = false;
    } else tip.hidden = true;
    wake();
  }
  // ---- depth: the text moves more than the rack as the pointer moves, and focus follows the pointer ----
  const heroEl = canvas.closest('.hero'), depthOn = !!heroEl && matchMedia('(hover: hover) and (pointer: fine)').matches;
  const rackMeshes = [...meshes, frameMesh];
  if (depthOn) {
    heroEl.addEventListener('pointermove', ev => {
      const r = heroEl.getBoundingClientRect();
      if (!reduce) { mxT = ((ev.clientX - r.left) / r.width) * 2 - 1; myT = ((ev.clientY - r.top) / r.height) * 2 - 1; }
      pick(ev); focusT = ray.intersectObjects(rackMeshes, false).length ? 1 : 0;
      wake();
    });
    heroEl.addEventListener('pointerleave', () => { mxT = myT = focusT = 0; wake(); });
  }
  function stepDepth(dt) {
    const kd = 1 - Math.exp(-dt * 6);
    mx += (mxT - mx) * kd; my += (myT - my) * kd; focus += (focusT - focus) * (reduce ? 1 : kd);
    const q = 1 - Math.min(sCur, 1), sharp = Math.max(1 - sCur * 20, 0);   // depth of field only at the hero pose
    heroEl.style.setProperty('--mx', (-mx * q).toFixed(3)); heroEl.style.setProperty('--my', (-my * q).toFixed(3));
    heroEl.style.setProperty('--blur-rack', ((1 - focus) * 2.5 * sharp).toFixed(2) + 'px');
    heroEl.style.setProperty('--blur-text', (focus * 2 * sharp).toFixed(2) + 'px');
    return Math.abs(mxT - mx) + Math.abs(myT - my) + Math.abs(focusT - focus) > 1e-3;
  }

  canvas.addEventListener('pointermove', ev => { if (!portal) { const p = pick(ev); setHot(p.u, p.x, p.y); } });
  canvas.addEventListener('pointerleave', () => setHot(null));
  canvas.addEventListener('click', ev => {
    if (portal) return;
    const { u, hit } = pick(ev);
    if (!u?.link) return;                                  // the skills servers are labels only
    if (u.project && !reduce) return enter(u);
    // the bottom server holds two links: left half, right half
    (u.links.length > 1 && u.pivot.worldToLocal(hit.point.clone()).x >= 0 ? u.links[1] : u.link).click();
  });

  // ---- portal: pull the server out, tilt it down so its lid faces you, and fly into the page on the lid ----
  // the real writeup waits full-screen in an <iframe> behind the canvas; the lid is a window cut into the canvas, so the last frame is the page itself
  // (a screenshot stands in on the lid until the iframe loads)
  const shotOf = u => new URL(`portal-${u.link.pathname.split('/').pop().replace('.html', '')}.webp`, import.meta.url).href;
  const shots = new Map(units.filter(u => u.project).map(u => [u, Object.assign(new Image(), { src: shotOf(u) })]));
  function page(u) {                                        // preload when its server is in view or hovered
    if (!u?.project || reduce) return null;
    let f = pages.get(u);
    if (!f) {
      f = Object.assign(document.createElement('iframe'), { src: u.link.href, tabIndex: -1, title: '', className: 'portal-page' });
      f.setAttribute('aria-hidden', 'true');
      f.addEventListener('load', () => { f.dataset.ready = ''; }, { once: true });
      stage.insertBefore(f, canvas); pages.set(u, f);
    }
    return f;
  }
  function lid(u) {
    const pw = Math.min(u.w * .86, u.d * .82 * aspect), ph = pw / aspect, b = pw * .035; // the page's own aspect, so it ends exactly full-screen
    const cv = document.createElement('canvas'), g = cv.getContext('2d'), img = shots.get(u);
    cv.width = 2048; cv.height = Math.round(2048 / aspect);
    g.fillStyle = '#0D0D0D'; g.fillRect(0, 0, cv.width, cv.height);
    if (img.complete && img.naturalWidth) { const k = cv.width / img.naturalWidth; g.drawImage(img, 0, 0, cv.width, img.naturalHeight * k); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const grp = new THREE.Group();
    const shot = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    const rim = new THREE.Mesh(new THREE.PlaneGeometry(pw + 2 * b, ph + 2 * b), new THREE.MeshBasicMaterial({ color: u.volt, toneMapped: false }));
    // clear pixels where the lid is, so the page behind the canvas shows through (and the rack still covers it)
    const hole = new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0, blending: THREE.NoBlending });
    const f = page(u);
    f.style.visibility = 'visible'; f.style.clipPath = 'inset(50%)';
    shot.position.z = .001;
    grp.add(rim, shot);
    grp.rotation.x = -Math.PI / 2; grp.position.set(0, u.h / 2 + .002, u.frontZ - u.d / 2);
    u.pivot.add(grp);
    const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([x, y]) => new THREE.Vector3(x * pw / 2, y * ph / 2, 0));
    const clip = k => {                                     // the page shows only inside the lid's outline on screen (all of it once the lid fills it)
      if (k >= 1) return void (f.style.clipPath = 'none');
      const r = stage.getBoundingClientRect();
      f.style.clipPath = `polygon(${corners.map(c => { const p = c.clone().applyMatrix4(shot.matrixWorld).project(camera);
        return `${r.left + (p.x + 1) / 2 * W}px ${r.top + (1 - p.y) / 2 * H}px`; }).join(',')})`;
    };
    return { grp, pw, ph, clip, swap: () => { if (shot.material !== hole && 'ready' in f.dataset) { shot.material.dispose(); tex.dispose(); shot.material = hole; } } };
  }
  function enter(u) {
    setHot(null);
    const off = camera.view?.enabled ? [camera.view.offsetX, camera.view.offsetY] : [0, 0]; // glide the hero's side shift away, no jump
    document.documentElement.classList.add('portal-on');
    portal = { u, t0: performance.now(), from: camera.position.clone(), look0: look.clone(), lid: lid(u), out: u.d + .04, off };
    wake();
  }
  const ease = t => 1 - Math.pow(1 - t, 3), inOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const phase = (t, a, b) => Math.min(Math.max((t - a) / (b - a), 0), 1);
  function stepPortal(now) {
    const { u, t0, from, look0, lid, out, off } = portal, t = (now - t0) / 1000;
    lid.swap();
    u.pivot.position.z = u.baseZ + ease(phase(t, 0, .38)) * out;          // 0–380ms: fully out of the rack
    u.pivot.rotation.x = ease(phase(t, .3, .7)) * THREE.MathUtils.degToRad(80); // 300–700ms: front tips down, lid up to you
    u.pivot.updateMatrixWorld();
    const c = lid.grp.getWorldPosition(new THREE.Vector3());
    const n = new THREE.Vector3(0, 1, 0).applyQuaternion(u.pivot.quaternion);
    const tn = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const k = inOut(phase(t, .55, 1.15));                                // 550–1150ms: until the page exactly fills the screen
    camera.position.lerpVectors(from, c.clone().addScaledVector(n, lid.ph / (2 * tn)), k);
    camera.lookAt(look0.clone().lerp(c, k));
    if (k < 1) camera.setViewOffset(W, H, off[0] * (1 - k), off[1] * (1 - k), W, H); else camera.clearViewOffset();
    camera.updateMatrixWorld(); lid.clip(k);
    if (t > 1.2 && !portal.gone) { portal.gone = true; location.href = u.link.href; }
  }
  addEventListener('pageshow', e => {                       // back button from a writeup: put the rack back
    if (!e.persisted || !portal) return;
    const { u, lid } = portal; portal = null;
    u.pivot.remove(lid.grp); lid.grp.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); });
    for (const f of pages.values()) f.remove(); pages.clear();
    document.documentElement.classList.remove('portal-on');
    for (const v of units) { v.pivot.position.z = v.baseZ; v.pivot.rotation.set(0, 0, 0); v.out = v.target = 0; }
    if (scanOn) { readScroll(); sCur = sTarget; updateScan(); }
    placeCamera(); wake();
  });

  // ---- loop: runs only while something moves and the stage is on screen ----
  let running = false, visible = true, last = performance.now();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); }).observe(stage);
  document.addEventListener('visibilitychange', wake);
  function wake() { if (!running && visible && !document.hidden) { running = true; last = performance.now(); renderer.setAnimationLoop(tick); } }
  function tick(now) {
    const dt = Math.min(Math.max((now - last) / 1000, 0), .05); last = now;   // rAF time can trail performance.now()
    let moving = false;
    const k = reduce ? 1 : 1 - Math.exp(-dt * 10);
    if (portal) { stepPortal(now); moving = true; }
    else {
      if (scanOn) {                                         // ease toward the scroll position so wheel steps glide
        sCur += (sTarget - sCur) * (1 - Math.exp(-dt * 8));
        if (Math.abs(sTarget - sCur) > 1e-3) moving = true; else sCur = sTarget;
        updateScan();
      }
      if (depthOn && stepDepth(dt)) moving = true;
      placeCamera();
      for (const u of units) {
        u.out += (u.target - u.out) * k;
        u.pivot.position.z = u.baseZ + u.out;
        if (Math.abs(u.target - u.out) > 1e-4) moving = true;
      }
    }
    render();
    if (!moving || !visible || document.hidden) { running = false; renderer.setAnimationLoop(null); }
  }
  function render() { renderer.render(scene, camera); }
  if (scanOn) { readScroll(); sCur = sTarget; updateScan(); }
  if (depthOn) stepDepth(1);
  placeCamera(); render();
}

function softRoom(renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ color: '#111111', side: THREE.BackSide })));
  for (const [w, h, pos, col, k] of [[8, 5, [0, 1.5, 6], '#c8c8c8', 1], [4, 6, [-6, 1, 2], '#8a8a8a', 1], [6, 3, [0, 7, 0], '#5a5a5a', 1]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m);
  }
  return new THREE.PMREMGenerator(renderer).fromScene(s, 0.04).texture;
}
