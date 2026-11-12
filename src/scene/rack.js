// Hero rack: the original black model; its servers map to .rack > li (top to bottom), the slots past the list stay blank.
// Scrolling flies the camera in to the top server, then down the rack one server per stop; each server wears its own label.
import * as THREE from 'three';
import { buildRack, SERVER_FRONT } from './rack-build.js';   // the rack itself
// the models, textures and data are static files in public/assets (they keep their URLs; Vite only bundles the code)
const ASSETS = new URL(`${import.meta.env.BASE_URL}assets/`, location.href);

// a refresh always lands on the hero, even with a #section left in the URL; arriving via a #section link still jumps
history.scrollRestoration = 'manual';
if (performance.getEntriesByType('navigation')[0]?.type === 'reload' && location.hash) history.replaceState(null, '', location.pathname + location.search);
if (!location.hash) scrollTo(0, 0);

const nav = document.querySelector('.nav');
const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 40);
addEventListener('scroll', onScroll, { passive: true }); onScroll();

// phones' loading screen (index.html .loader): the share of the room's files that are in, gone once the room is drawn
// shortcut: ROOM_FILES is counted by hand (the rack, the loader libs, 3 JSON + 3 models, 9 textures); recount when the room's files change
const ROOM_FILES = 17, loader = document.querySelector('.loader'), pct = loader?.querySelector('.loader-pct');
let filesIn = 0;
const track = p => { const up = () => { if (pct) pct.textContent = `${Math.min(99, Math.round(++filesIn / ROOM_FILES * 100))}%`; }; p.then(up, up); return p; };
const loaded = () => { if (!loader) return; if (pct) pct.textContent = '100%'; loader.addEventListener('transitionend', () => loader.remove(), { once: true }); loader.classList.add('done'); };

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hoverable = matchMedia('(hover: hover) and (pointer: fine)').matches;   // a mouse: the room's labels become the cursor's tooltip
const canvas = document.getElementById('rack3d');

const SLOW = 1;                                              // a multiplier on the room's animation times (raise it to slow them for screen capture)
const FIRST = 2;                                             // the top server's stop: the room has a close-up stop before it
const SERVERS = document.querySelectorAll('.rack > li').length;   // the labelled servers, top down
const BOX = FIRST + SERVERS;                                 // the room's box showcase, after the servers
const STOPS = BOX + 2;                                       // hero, close-up, the servers, the box, the end close-up: the .stop count
const ROOM_ZOOM = 1.25;                                     // the room's size on screen on wide screens, at the landing and the close-ups (phones: as wide as fits)
const FOV = 28, EYE_FOV = 50;                                // the room's close-up widens the lens for its one-point perspective
const JUMP = { '#top': 0, '#projects': FIRST + 1, '#contact': FIRST + 4 };
// the projects section is hidden in the 3D layout, so its video's poster is fetched only where the page itself shows (no 3D, or 3D gave up)
const poster = () => { if (!document.documentElement.classList.contains('scan-on')) for (const v of document.querySelectorAll('video[data-poster]')) v.poster = v.dataset.poster; };
poster();
if (canvas) start().catch(err => { console.warn('rack: 3D off', err); document.documentElement.classList.remove('has-3d', 'scan-on', 'room-on'); poster(); loaded(); });

async function start() {
  // antialias only below 2x: on a Retina screen the pixels are fine enough, and 4x MSAA buffers there cost ~160 MB of GPU memory at a laptop's size
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: devicePixelRatio < 2, alpha: true, stencil: true })   // stencil: the sky shows only through the window's glass;
  renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.5 : 2));   // phones: ~half the pixels to light at 3x
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .9;

  // dim neutral room with soft grey panels: edges read without white studio highlights or a colour cast
  const scene = new THREE.Scene();
  scene.environment = softRoom(renderer);
  scene.environmentIntensity = 2;

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 60);
  const look = new THREE.Vector3(0, 0, 0);
  let portal = null;
  const pages = new Map();                                   // project unit -> preloaded writeup <iframe>
  let mx = 0, my = 0, mxT = 0, myT = 0;   // pointer parallax on the text (see stepDepth)

  const scan = document.querySelector('.scan'), hero = scan?.querySelector('.hero');
  const scanOn = !reduce && !!scan;                          // the faceplates draw differently in scan mode
  const files = roomFiles();                                 // the room's downloads start now, alongside the rack's
  track(window.rackGlb);
  const { rackRoot, units, frameMesh, blink, top: rackTopY } = await buildRack([...document.querySelectorAll('.rack > li')], scanOn);
  const room = await buildRoom(renderer, new THREE.Box3().setFromObject(rackRoot), files);
  // the room and the rack ride one lift: on load it rises from below, turning, and settles past its mark (stepRise).
  // lift turns about the room's middle; inner puts the rack back at the origin, so poses and picking are untouched once it settles
  const lift = new THREE.Group(), inner = new THREE.Group().add(rackRoot);
  lift.add(inner); scene.add(lift);
  let rise = 0, hop = 0, fly = null, powered = reduce;   // powered: the rack has booted; fly: a click's straight camera flight (flyTo)
  const tips = {};                                           // the room's labels (index.html .room-tip), by data-at
  if (room) {
    inner.add(room.root);
    const c = room.shell.getCenter(new THREE.Vector3()); lift.position.copy(c); inner.position.copy(c).negate();
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;   // shadows redraw on animated frames only (tick), not on the clock's idle ticks
    document.documentElement.classList.add('room-on');
    if (new URLSearchParams(location.search).has('probe')) window.probe = { camera, room, renderer, scene, player: () => ({ ...V }) };   // test hook for the scripted checks
    for (const el of document.querySelectorAll('.room-tip')) tips[el.dataset.at] = el;
    tips.now = document.querySelector('[data-at="now"]');   // what's playing
    // with a mouse, the labels show as the cursor's tooltip on hover (src/components/room-tooltip.tsx): in the scene they stay for the keyboard
    // (shown while focused) and for phones, which have no hover. The now-playing label stays, since it holds a link
    if (hoverable) for (const [at, el] of Object.entries(tips)) if (at !== 'now') el.classList.add('quiet');
    for (const at of ['rack', 'box', 'vinyl']) tips[at].addEventListener('click', () => choose(at));
    if (!hoverable) {                                       // phones: short "Tap" labels, and the shelf's covers as a row of buttons (style.css .phone-ui)
      const short = { rack: 'Tap to power on', box: 'Tap to open', vinyl: 'Tap to pick a record', window: 'Tap for day / night' };
      for (const [at, s] of Object.entries(short)) tips[at].querySelector('small').textContent = s;
      const star = tips.star.querySelector('small'); star.textContent = star.textContent.replace('Click', 'Tap');
      const ui = document.querySelector('.phone-ui'), covers = ui.querySelector('.covers');
      covers.append(...room.tracks.map((t, i) => Object.assign(document.createElement('button'), { type: 'button', ariaLabel: `${t.name}, ${t.artists.join(', ')}`, style: `background-image: url(${t.cover})`, onclick: () => play(i) })));
      ui.querySelector('.phone-back').onclick = () => leave();
      ui.querySelector('.phone-stop').onclick = () => stop();
      tips.now.classList.replace('sr-only', 'now-line'); ui.querySelector('.phone-back').after(tips.now);
    }
    // the room follows the site's theme (assets/theme.js): light is day, dark is night
    const n = room.night, night = () => document.documentElement.dataset.theme !== 'light';
    n.at = n.to = night() ? 1 : 0; n.set(n.at);
    new MutationObserver(() => { n.to = night() ? 1 : 0; wake(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (!reduce) rise = -1;                                 // starts on the first frame drawn (stepRise)
  } else document.documentElement.classList.remove('room-on');   // set early by index.html's head script

  // ---- scan mode: the page scroll picks a pose between stops (see .stops in index.html) ----
  document.documentElement.classList.add('has-3d');
  if (scanOn) document.documentElement.classList.add('scan-on');   // index.html's head script already set it, before the first paint
  else document.querySelector('.hint').textContent = 'Projects and contact are below.';
  let sTarget = 0, sCur = 0;
  // phones: the rack or the box opens in place, like the shelf: the page holds still and a vertical swipe steps between its stops (inside.lo..hi; the box's step is the brush)
  let inside = null;
  const brush = { to: 0, k: 0 };                             // the box's close look at the SmashBid brush, eased like zoom.k
  const span = () => scan.offsetHeight - hero.offsetHeight;
  function readScroll() { if (inside) return; sTarget = span() > 0 ? Math.min(Math.max(-scan.getBoundingClientRect().top / span(), 0), 1) * (STOPS - 1) : 0; }
  const stopTop = n => scan.getBoundingClientRect().top + scrollY + n * span() / (STOPS - 1);
  const goStop = n => scrollTo({ top: stopTop(n) });
  // a click on the rack, the box or the background: the page moves to that stop at once, and the camera flies straight from where it is to
  // there (placeCamera), past nothing in between, while the labels are already at the stop
  function takeOff() {
    const css = ['--p', '--dof'].map(k => parseFloat(hero.style.getPropertyValue(k)) || 0);   // the page's fade where it was: it follows the flight too (updateScan)
    fly = { pos: camera.position.clone(), look: look.clone(), fov: camera.fov, shift: [...shiftNow], t0: performance.now(), css, e: 0 };
  }
  function flyTo(n) { takeOff(); scrollTo({ top: stopTop(n), behavior: 'instant' }); readScroll(); sCur = sTarget; updateScan(); wake(); }
  function openIn(n, range) {                               // phones: fly to stop n without moving the page, and hold it there
    takeOff(); inside = range; stage.dataset.inside = ''; document.documentElement.style.overflow = 'hidden';
    sTarget = sCur = n; updateScan(); wake();
  }
  function closeIn() {                                      // back to where the page is (the room's close-up)
    takeOff(); inside = null; brush.to = brush.k = 0; delete stage.dataset.inside; document.documentElement.style.overflow = '';
    readScroll(); sCur = sTarget; updateScan(); wake();
  }
  function step(d) {                                        // a swipe while open: the next (1) or previous (-1) stop
    if (inside.box) { if (room.star && !starPose) buildPoses(); brush.to = d > 0 && room.star ? 1 : 0; }   // the brush arrives late (loadProps)
    else sTarget = Math.min(Math.max(Math.round(sTarget) + d, inside.lo), inside.hi);
    wake();
  }
  // the room's track: hero, close-up (click the rack or the box), the servers, the box, the whole room
  if (scanOn) document.querySelector('.stops').replaceChildren(...Array.from({ length: STOPS }, () => Object.assign(document.createElement('span'), { className: 'stop' })));

  // ---- layout / camera ----
  const stage = canvas.parentElement;
  let W = 1, H = 1, aspect = 1, poses = [], zoomPose = null, starPose = null;   // the record shelf, close (see zoom)
  function frame() {
    W = stage.clientWidth; H = stage.clientHeight;
    renderer.setSize(W, H, false);
    aspect = W / H; camera.aspect = aspect; camera.updateProjectionMatrix();
    buildPoses();
  }
  function buildPoses() {
    const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    let far = Math.max(1.15 / t, 0.55 / (t * aspect)), heroFar = far, shift = [scanOn && aspect > 1.2 ? .2 : 0, 0]; // wide: rack right of the copy
    if (scanOn && aspect < 1) {                             // portrait: fit the rack between the whole name and the copy
      const top = stage.getBoundingClientRect().top;
      const y0 = hero.querySelector('.wordmark').getBoundingClientRect().bottom - top + H * .02;
      const y1 = hero.querySelector('.hero-copy').getBoundingClientRect().top - top;
      heroFar = Math.max(1.15 / (t * Math.max(y1 - y0, H * .3) / H), far);
      shift = [0, ((y0 + y1) / 2 - H / 2) / H];
    }
    const yaw = 0.46, pitch = 0.1;                         // shows the side with the hazard labels
    let heroPose = { pos: new THREE.Vector3(Math.sin(yaw) * heroFar, Math.sin(pitch) * heroFar, Math.cos(yaw) * heroFar), look: new THREE.Vector3(), shift };
    // stand back along dir from a box until its bounding sphere fits fw x fh of the screen
    const view = (b, dir, fw, fh, sh = [0, 0]) => {
      const s = b.getBoundingSphere(new THREE.Sphere()), d = Math.max(s.radius / (fw * t * aspect), s.radius / (fh * t));
      return { look: s.center, pos: new THREE.Vector3(...dir).normalize().multiplyScalar(d).add(s.center), shift: sh };
    };
    const open = [1, .6, 1];                               // the room's open corner: both walls, the floor and the stalk under it show
    if (room) {                                             // the whole room on its stalk: overlapping the end of the name (wide), or between the name and the copy (portrait)
      const box = stage.getBoundingClientRect(), name = hero.querySelector('.wordmark .last').getBoundingClientRect();
      if (aspect < 1) {
        const y0 = name.bottom - box.top + H * .02, y1 = hero.querySelector('.hero-copy').getBoundingClientRect().top - box.top;
        heroPose = view(room.shell, open, 1.05, Math.max(y1 - y0, H * .3) / H * 1.1, [0, ((y0 + y1) / 2 - H / 2) / H]);
      } else {
        const x1 = W * .99, x0 = x1 - ROOM_ZOOM * (x1 - Math.min(name.right - box.left - W * .06, x1 - W * .4));   // the room itself fits here, its right edge kept; its stalk hangs below
        heroPose = view(room.shell, open, (x1 - x0) / W, .74 * ROOM_ZOOM, [((x0 + x1) / 2 - W / 2) / W, -.07]);
      }
    }
    if (!scanOn) return poses = [heroPose];
    // head-on, far enough back that the cabinet sides and the yellow behind show
    const at = (y, w, h) => {
      const l = new THREE.Vector3(0, y, SERVER_FRONT);
      return { look: l, pos: l.clone().setZ(SERVER_FRONT + (aspect < 1 ? 1.4 : 1.8) * Math.max(w / (.92 * 2 * t * aspect), h / (.5 * 2 * t))), shift: [0, 0] };
    };
    const servers = units.map(u => at(u.pivot.position.y, u.w, u.h));
    // one-point perspective: level with a standing visitor's eyes (1.6 m up), square to the back wall; a lens shift, not a tilt, centres the room's front face in fw x fh
    const eye = (fw, fh) => {
      const b = room.shell, tv = Math.tan(THREE.MathUtils.degToRad(EYE_FOV / 2)), y = -1 + 1.6, x = (b.min.x + b.max.x) / 2;
      const d = Math.max((b.max.x - b.min.x) / 2 / (fw * tv * aspect), (b.max.y - b.min.y) / 2 / (fh * tv));
      return { pos: new THREE.Vector3(x, y, b.max.z + d), look: new THREE.Vector3(x, y, b.min.z), fov: EYE_FOV, shift: [0, ((b.min.y + b.max.y) / 2 - y) / (d * tv) / 2] };
    };
    zoomPose = view(room.vinyl.box, [0, .5, 1], .95, .9);
    // shortcut: only the SmashBid brush has a stop, add a tool here when it gets a project
    if (room.star) starPose = view(new THREE.Box3().setFromObject(room.star), [0, 3, .6], .5, .5);
    const Z = aspect < 1 ? 1 : ROOM_ZOOM;                 // phones: the room already spans the screen
    poses = [heroPose, eye(.86 * Z, .8 * Z), ...servers,   // close-up: both labels show
      view(room.box, [0, 3, .6], aspect < 1 ? .95 : 1.32, 1.3),   // the showcase: close, almost straight down into the box (phones: back a bit, so the brush fits)
      eye(.86 * Z, .8 * Z)];                // the end: back to the room's close-up, to play with
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
    let fov = (a.fov ?? FOV) + ((b.fov ?? FOV) - (a.fov ?? FOV)) * k;
    let sx = a.shift[0] + (b.shift[0] - a.shift[0]) * k, sy = a.shift[1] + (b.shift[1] - a.shift[1]) * k;   // no pointer parallax on the rack; only the text drifts
    if (fly) {                                             // a click's flight: from where the camera was, eased, to the stop's pose (1.1 s)
      const f = reduce ? 1 : Math.min((performance.now() - fly.t0) / 1100, 1), e = f * f * (3 - 2 * f);
      camera.position.lerpVectors(fly.pos, camera.position, e); look.lerpVectors(fly.look, look, e);
      fov = fly.fov + (fov - fly.fov) * e; sx = fly.shift[0] + (sx - fly.shift[0]) * e; sy = fly.shift[1] + (sy - fly.shift[1]) * e;
      fly.e = e; if (f >= 1) fly = null;
      updateScan();
    }
    if (zoom.k) {                                           // the whole shelf: its four cubes of records and the turntable
      const e = zoom.k * zoom.k * (3 - 2 * zoom.k);
      camera.position.lerp(zoomPose.pos, e); look.lerp(zoomPose.look, e); fov += (FOV - fov) * e; sx -= sx * e; sy -= sy * e; }
    if (brush.k && starPose) {                              // phones, the box open: close on the SmashBid brush
      const e = brush.k * brush.k * (3 - 2 * brush.k);
      camera.position.lerp(starPose.pos, e); look.lerp(starPose.look, e); sx -= sx * e; sy -= sy * e; }
    if (fov !== camera.fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    if (orb.y || orb.p) orbit();
    camera.lookAt(look);
    if (sx || sy) camera.setViewOffset(W, H, -sx * W, -sy * H, W, H); else if (camera.view?.enabled) camera.clearViewOffset();
    shiftNow[0] = sx; shiftNow[1] = sy;
  }
  let shown = -1, focus = null, end = 0;
  const shiftNow = [0, 0];
  // the room: hold and drag to turn the camera around what it looks at, up to 60° either way, never behind a wall or under the floor.
  // It stays until the scroll moves on to another stop, then eases back (tick)
  const orb = { y: 0, p: 0, stop: 0, back: false }, orbV = new THREE.Vector3();
  // the room's close look at one object (the record shelf): k eases 0..1 toward at; Esc, a click beside it, or scrolling on goes back
  const zoom = { at: null, k: 0 };
  function orbit() {
    orbV.subVectors(camera.position, look);
    const len = orbV.length(), e0 = Math.asin(orbV.y / len), az = Math.atan2(orbV.x, orbV.z);
    const e = Math.min(Math.max(e0 + orb.p, Math.min(e0, .03)), Math.max(e0, 1.22));   // from level (or where the stop has it) to 70° down
    const minX = room.shell.min.x + T + .05, minZ = room.shell.min.z + T + .05;   // the walls' inner faces
    for (let yaw = orb.y, i = 0; i < 12; i++, yaw *= .7) {   // less turn until it is clear of the walls
      orbV.set(Math.cos(e) * Math.sin(az + yaw), Math.sin(e), Math.cos(e) * Math.cos(az + yaw)).multiplyScalar(len).add(look);
      if (orbV.x > minX && orbV.z > minZ && orbV.y > -.95) { camera.position.copy(orbV); return; }
    }
  }
  const rackBox = new THREE.Box3(), corner = new THREE.Vector3();
  function updateScan() {
    let p = Math.min(sCur, 1), dof = Math.max(Math.min(sCur, 1, (STOPS - 1.2 - sCur) / .6), 0);
    if (fly) { p = fly.css[0] + (p - fly.css[0]) * fly.e; dof = fly.css[1] + (dof - fly.css[1]) * fly.e; }   // a click's flight: the name and the blur ease with the camera, no snap
    hero.style.setProperty('--p', p.toFixed(3));
    hero.style.setProperty('--end', (end = Math.min(Math.max((sCur - STOPS + 1.6) / .5, 0), 1)).toFixed(3));   // the contact line over the pull-back (render dims the faceplates under it)
    hero.classList.toggle('is-end', !!end && sCur > STOPS - 1.3);
    hero.style.setProperty('--dof', dof.toFixed(3));   // backdrop blur: on while the rack is close, off again at the pull-back
    hero.classList.toggle('is-close', p > .5);
    const n = Math.round(sCur) - FIRST;                    // the server at this stop, if any
    const at = n === SERVERS ? 'star' : n;         // or the showcase
    if (sCur > 1.5 && sCur < BOX - .5) toRack();   // scrolled on to the servers: the rack powers on
    if (at !== shown) {
      if (at === 'star' && !reduce) hop = performance.now();   // arriving at the box: its tools hop
      shown = at; page(units[n]);
      if (at !== 'star') readout(units[n] ?? null);
    }
    const near = Math.abs(sCur - n - FIRST) < .2 ? units[n] ?? null : null;   // the camera holds still within .2 of a stop
    if (near !== focus && (!near || Math.abs(sTarget - sCur) < .05)) setFocus(near);   // take a server only once the scroll settles
  }
  function setFocus(u) {                                    // the server the camera rests on types its line and blinks faster
    if (focus?.chars) focus.type(0);                        // its line goes blank again, so every visit types it fresh
    focus = u;
    if (u?.chars) { u.t0 = performance.now(); u.type(0); wake(); }
  }
  new ResizeObserver(() => { frame(); placeCamera(); render(); }).observe(stage);
  frame();
  const toRack = () => { if (!powered && !boot) boot = performance.now(); };

  if (scanOn) {
    addEventListener('scroll', () => { readScroll(); wake(); }, { passive: true });
    document.addEventListener('click', e => {               // section links fly to their server instead of the hidden sections
      const a = e.target.closest('a[href^="#"]');
      if (a && a.hash in JUMP) { e.preventDefault(); if (JUMP[a.hash]) toRack(); goStop(JUMP[a.hash]); }
    });
    document.addEventListener('focusin', e => {             // keyboard on the hidden content: show its server
      const n = e.target.closest?.('[data-unit]')?.dataset.unit;
      if (n == null) return;
      toRack(); goStop(+n + FIRST);
      // the focused link itself is clipped away, so name it on screen (WCAG 2.4.7)
      tip.innerHTML = `${units[n].li.dataset.label}<small></small>`;
      const text = e.target.textContent.trim();
      if (text !== units[n].li.dataset.label) tip.lastChild.textContent = text;
      tip.classList.add('is-focus'); tip.hidden = false;
    });
    document.addEventListener('focusout', () => { tip.classList.remove('is-focus'); tip.hidden = true; });
  }

  // ---- picking ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const tip = stage.querySelector('.rack-tip');
  const meshes = units.map(u => u.mesh), rackMeshes = [...meshes, frameMesh], local = new THREE.Vector3();
  let hot = null;
  function pick(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(rackMeshes, false)[0];
    let u = hit?.object.userData.unit ?? null;
    // the unit's face counts across its whole height (1U units touch) but not its sides, which belong to the rack (a unit that is out keeps its whole face, or sliding out from under the pointer would un-hover it)
    if (u && u !== picked) { u.pivot.worldToLocal(local.copy(hit.point)); if (Math.abs(local.y) > u.h * .5 || Math.abs(local.x) > u.w * .45) u = null; }
    // rack: the unit nearest the pointer's height, for clicks on the cabinet between units
    const rack = hit ? units.reduce((a, b) => Math.abs(b.pivot.getWorldPosition(local).y - hit.point.y) < Math.abs(a.pivot.getWorldPosition(local).y - hit.point.y) ? b : a) : null;
    return { u, rack, hit, x: ev.clientX - r.left, y: ev.clientY - r.top };
  }
  function readout(u) {
  }
  function setHot(u, x, y) {
    hot = u;                                                // render() lifts the hovered faceplate from near-black to grey
    if (u) page(u);                                         // preload its page; the full pull-out waits for a click
    canvas.style.cursor = u?.link ? 'pointer' : 'grab';
    if (!scanOn) readout(u);
    if (u && x != null && !scanOn) {                        // scan mode prints this on the faceplate instead
      tip.innerHTML = `${u.li.dataset.label}<small>${u.li.dataset.line ?? ''}</small>`;
      tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.hidden = false;
    } else tip.hidden = true;
    wake();
  }
  // ---- depth: the name and copy drift against the pointer; the rack stays put ----
  const heroEl = canvas.closest('.hero'), depthOn = !!heroEl && matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (depthOn) {
    heroEl.addEventListener('pointermove', ev => {
      const r = heroEl.getBoundingClientRect();
      if (!reduce) { mxT = ((ev.clientX - r.left) / r.width) * 2 - 1; myT = ((ev.clientY - r.top) / r.height) * 2 - 1; }
      wake();
    });
    heroEl.addEventListener('pointerleave', () => { mxT = myT = 0; wake(); });
  }
  function stepDepth(dt) {
    const kd = 1 - Math.exp(-dt * 6);
    mx += (mxT - mx) * kd; my += (myT - my) * kd;
    const q = 1 - Math.min(sCur, 1);
    heroEl.style.setProperty('--mx', (-mx * q).toFixed(3)); heroEl.style.setProperty('--my', (-my * q).toFixed(3));
    return Math.abs(mxT - mx) + Math.abs(myT - my) > 1e-3;
  }

  // a mouse hover slides a server out; a click on a server that is out opens it (drawer sound).
  // touch has no hover (and fires pointerleave before click), so there the first tap slides it out (click sound) and the second opens it
  const hovers = ev => !reduce && ev.pointerType === 'mouse';
  // the room: up to its close-up the pointer chooses the rack or the box; at the showcase it hovers the Badminton brush
  const closeUp = () => sCur < 1.5 || sCur > STOPS - 1.5;   // the hero and close-up at the start, or the close-up at the end
  const choosing = () => closeUp() && !zoom.at;
  let homeStop = FIRST - 1;                                // the close-up a click left from, to step back to
  let starHot = false, winHot = false, hoverAt = null, toolHot = null, recHot = null;   // recHot: the record under the pointer (shelf)
  const boxHit = new THREE.Vector3();
  function hoverLabel(at, tip) {                           // tell the cursor's tooltip what is under the pointer (its label's text, or tip), or nothing
    if (!hoverable || at === hoverAt) return;
    hoverAt = at; const el = at && tips[at];
    dispatchEvent(new CustomEvent('room-hover', { detail: tip ?? (el ? { title: el.firstChild.textContent.trim(), sub: el.querySelector('small')?.textContent ?? '' } : null) }));
  }
  const tb = new THREE.Box3(), tc = new THREE.Vector3();
  function scr(box, ev) {                                  // pixels from the pointer to a box's centre as the camera sees it
    const r = canvas.getBoundingClientRect(); box.getCenter(tc).project(camera);
    return Math.hypot((tc.x + 1) / 2 * r.width + r.left - ev.clientX, (1 - tc.y) / 2 * r.height + r.top - ev.clientY);
  }
  function which(ev) {                                     // 'rack', 'box', 'vinyl', 'window' or null under the pointer: the nearest of their own meshes it touches, as on the shelf (what you see is what you tap)
    pick(ev); let best = null, bd = Infinity;
    for (const [k, o] of [['rack', rackMeshes], ['box', [room.art]], ['window', [room.win]]]) { const d = ray.intersectObjects(o, true)[0]?.distance ?? Infinity; if (d < bd) { bd = d; best = k; } }
    const v = shelfHit(ev); if (v.any && v.d < bd) best = 'vinyl';
    return best;
  }
  canvas.addEventListener('pointermove', ev => {
    if (portal) return;
    if (drag) return;
    if (!zoom.at && !choosing() && !(Math.abs(sCur - BOX) < .5)) hoverLabel(null);
    if (zoom.at) {                                          // the shelf: the record whose spine or cover is under the pointer (exactly; a board in front hides it)
      const h = shelfHit(ev), t = h.sleeve && room.tracks[h.sleeve.userData.i], k = h.sleeve ? h.sleeve.userData.c : cubeAt(ev);
      flips.forEach((F, i) => { if (F.on !== (i === k)) { F.on = i === k; wake(); } });   // that cube displays its records
      if (recHot !== h.sleeve) { recHot = h.sleeve; wake(); }
      hoverLabel(t ? `rec${h.sleeve.userData.i}` : null, t && { title: t.name, sub: t.artists.join(', ') });
      canvas.style.cursor = h.sleeve || (h.player && (V.to || V.p)) ? 'pointer' : 'grab'; return;
    }
    if (choosing()) { const w = which(ev); canvas.style.cursor = w ? 'pointer' : 'grab'; hoverLabel(w); if (winHot !== (w === 'window')) { winHot = !winHot; wake(); } return; }
    if (Math.abs(sCur - BOX) < .5) {                       // the showcase: the tool under the pointer lifts and brightens; the Badminton brush also says what it is
      pick(ev); const h = ray.intersectObjects(room.tools, true)[0]?.object;
      toolHot = h ? room.tools.find(o => o === h || o.getObjectById(h.id)) : null; starHot = toolHot === room.star;
      canvas.style.cursor = toolHot ? 'pointer' : 'grab'; hoverLabel(starHot ? 'star' : null); wake(); return;
    }
    const p = pick(ev); setHot(p.u, p.x, p.y); if (hovers(ev)) pickServer(p.u); if (!p.u && p.rack && scanOn) canvas.style.cursor = 'zoom-in';
  });
  // the drag: a mouse held down, one finger moving sideways (up/down still scrolls the page), or two fingers (which also tilt). Past 5 px (mouse) or 10 px (touch) it is a drag, and the tap/click it ends in is dropped
  // a tap is the browser's own click (it knows a tap from a scroll); only a drag that turned the view drops the click it ends in
  let drag = null, dragged = false;
  const touches = new Map(), mid = () => { let x = 0, y = 0; for (const t of touches.values()) { x += t.x / touches.size; y += t.y / touches.size; } return { x, y }; };
  if (room) {
    canvas.addEventListener('pointerdown', ev => {
      if (portal || rise) return;
      dragged = false;                                      // a swipe that ended without a click must not eat the next tap
      if (ev.pointerType === 'touch') { if (ev.isPrimary) touches.clear(); touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); drag = touches.size === 2 ? { ...mid(), on: true } : touches.size === 1 ? { x: ev.clientX, y: ev.clientY, on: false, one: true } : null; return; }
      if (ev.button === 0) { drag = { x: ev.clientX, y: ev.clientY, on: false }; canvas.setPointerCapture(ev.pointerId); }
    });
    canvas.addEventListener('pointermove', ev => {
      if (ev.pointerType === 'touch') { if (!touches.has(ev.pointerId)) return; touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); if (!drag) return; }
      if (!drag) return;
      const at = ev.pointerType === 'touch' ? mid() : { x: ev.clientX, y: ev.clientY }, dx = at.x - drag.x, dy = at.y - drag.y;
      if (!drag.on && Math.hypot(dx, dy) < (drag.one ? 10 : 5)) return;
      if (drag.one && !drag.on && Math.abs(dx) <= Math.abs(dy)) return;   // a mostly vertical swipe belongs to the page scroll, and is no tap
      drag.on = true; drag.x = at.x; drag.y = at.y; canvas.style.cursor = 'grabbing';
      orb.y = Math.min(Math.max(orb.y - dx * .005, -Math.PI / 3), Math.PI / 3); if (!drag.one) orb.p = Math.min(Math.max(orb.p + dy * .005, -1.4), 1.4);
      orb.back = false; wake();
    });
    const release = ev => {
      if (ev.pointerType === 'touch') {
        if (inside && drag?.one && !drag.on) {           // open on a phone: a vertical swipe steps between the stops
          const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
          if (Math.abs(dy) > 40 && Math.abs(dy) > Math.abs(dx)) { step(dy < 0 ? 1 : -1); dragged = true; }
        }
        if (drag?.on) dragged = true;   // a first finger lands with a fresh map (pointerdown), so a lost pointerup cannot leave a finger stuck
        touches.delete(ev.pointerId); if (touches.size < 2) drag = null; return;
      }
      if (drag?.on) { dragged = true; canvas.style.cursor = 'grab'; }
      drag = null;
    };
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(t, release);
    canvas.addEventListener('click', ev => { if (dragged) { dragged = false; ev.stopImmediatePropagation(); } }, true);
  }
  canvas.addEventListener('pointerleave', ev => { setHot(null); starHot = winHot = false; toolHot = recHot = null; hoverLabel(null); for (const F of flips) F.on = false; if (hovers(ev)) pickServer(null); });
  // every zoom in the room has a way out: a click on the background, or Esc, goes back to the close-up of the whole room
  const inRoomZoom = () => scanOn && sCur > FIRST - .5 && sCur < BOX + .5;
  function leave() {
    if (showing) showing = null;
    else if (zoom.at) zoom.at = null;
    else if (brush.to) brush.to = 0;
    else if (inside) closeIn();
    else { pickServer(null); flyTo(homeStop); }
    wake();
  }
  function choose(w) {                                     // rack: it powers on, then the camera goes in to the top server. box: straight to the showcase, where the tools hop
    sfx('click');
    if (w !== 'window' && w !== 'vinyl') homeStop = sCur > STOPS - 1.5 ? STOPS - 1 : FIRST - 1;
    if (w === 'window') return void document.querySelector('[data-theme-toggle]')?.click();   // the window: the site's theme toggle, day or night for the room and the page
    if (w === 'rack') { const was = powered; toRack(); if (!hoverable) openIn(FIRST, { lo: FIRST, hi: BOX - 1 }); else setTimeout(() => flyTo(FIRST), was || reduce ? 0 : 700 * SLOW); }   // phones: no waiting for the power-on
    else if (w === 'vinyl') { zoom.at = 'vinyl'; loadSpotify(); room.vinyl.loadCovers(wake); }
    else { room.loadProps(); if (!hoverable) openIn(BOX, { lo: BOX, hi: BOX, box: true }); else flyTo(BOX); }
    wake();
  }
  const SLIDE = .035;
  let picked = null, audio = null;
  function pickServer(u) {
    if (picked) picked.target = 0;
    picked = u;
    if (u) u.target = SLIDE;
    wake();
  }
  function ripple(x, y) {
    if (reduce) return;
    const r = Object.assign(document.createElement('span'), { className: 'ripple' });
    r.style.left = x + 'px'; r.style.top = y + 'px';
    r.addEventListener('animationend', () => r.remove());
    stage.append(r);
  }
  function noise(ac, sec) {
    const b = ac.createBuffer(1, ac.sampleRate * sec | 0, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return Object.assign(ac.createBufferSource(), { buffer: b });
  }
  function env(ac, t, peak, attack, decay) {               // a gain that rises fast and falls off exponentially
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(ac.destination); return g;
  }
  function unlock() {                                     // browsers only start audio inside a user gesture, so open it on the first touch of the page
    try { audio ??= new AudioContext(); if (audio.state !== 'running') audio.resume(); } catch {}
    return audio;
  }
  ['pointerdown', 'keydown'].forEach(e => addEventListener(e, unlock, { once: true, capture: true }));
  function sfx(kind) {
    const ac = unlock(); if (!ac) return;
    const t = ac.currentTime;
    if (kind === 'click') {                                 // latch tick: a short bright noise burst plus a 2 kHz blip
      const n = noise(ac, .04), hp = new BiquadFilterNode(ac, { type: 'highpass', frequency: 3000 });
      n.connect(hp).connect(env(ac, t, .15, .001, .03)); n.start(t);
      const o = new OscillatorNode(ac, { frequency: 2000 }); o.connect(env(ac, t, .06, .001, .025)); o.start(t); o.stop(t + .04);
    } else {                                                // drawer: rail slide (swept band-passed noise), then a low thump as it stops
      const n = noise(ac, .5), bp = new BiquadFilterNode(ac, { type: 'bandpass', frequency: 600, Q: 1.2 });
      bp.frequency.exponentialRampToValueAtTime(1600, t + .45);
      n.connect(bp).connect(env(ac, t, .12, .06, .4)); n.start(t);
      const o = new OscillatorNode(ac, { frequency: 90 }); o.frequency.exponentialRampToValueAtTime(50, t + .6);
      o.connect(env(ac, t + .45, .25, .005, .15)); o.start(t + .45); o.stop(t + .65);
    }
  }
  canvas.addEventListener('click', tap);
  function tap(ev) {
    if (portal) return;
    if (zoom.at) {                                          // the shelf: a click shows the record under it, a click on the shown cover plays it,
      const touch = ev.pointerType !== 'mouse', k = cubeAt(ev);   // the turntable stops it, a click anywhere else puts the shown one back (or steps out)
      if (touch && k >= 0 && !showing && flips[k].d < .5) { flips.forEach((F, i) => { F.touch = i === k; }); wake(); return; }   // phones: a first tap displays the cube
      const h = shelfHit(ev), rec = h.sleeve ?? (touch && !h.player ? nearRecord(ev) : null);   // the turntable wins over a nearby spine
      flips.forEach(F => { F.touch = false; });
      if (showing && rec === showing) { sfx('click'); const i = showing.userData.i; showing = null; play(i); }
      else if (rec) { sfx('click'); showing = rec; }
      else if (h.player && (V.to || V.p)) { sfx('click'); stop(); }
      else if (showing) showing = null;
      else if (!h.any) zoom.at = null;
      wake(); return;
    }
    if (choosing()) { const w = which(ev); if (w) choose(w); else if (sCur > .5 && !ray.intersectObject(room.root, true)[0]) flyTo(0); return; }   // the page behind the room: back to the landing
    if (Math.abs(sCur - BOX) < .5) {                       // the showcase: the Badminton brush opens SmashBid (its label is the link); the background steps back
      pick(ev); const h = ray.intersectObjects(room.tools, true)[0]?.object;   // a tool: under the tap, or else the nearest within 24 px of it
      let t = h && room.tools.find(o => o === h || o.getObjectById(h.id)), d = 24;
      if (!t) for (const o of room.tools) { const e = scr(tb.setFromObject(o), ev); if (e < d) { d = e; t = o; } }
      if (t) { toolHot = t; wake(); if (!hoverable) setTimeout(() => { if (toolHot === t) { toolHot = null; wake(); } }, 1000); if (t === room.star) tips.star.click(); }   // it hops (the hover lift, ~1 s on touch)
      else if (!ray.intersectObject(room.art, true)[0]) leave();   // as on the shelf: anything that isn't the box steps back
      return;
    }
    const { u, rack, hit, x, y } = pick(ev);
    if (!u) { pickServer(null); if (inside) { if (!hit) leave(); return; } if (rack && scanOn) goStop(rack.i + 1); else if (inRoomZoom()) leave(); return; }   // the cabinet: close up on the nearest unit; empty space: slide back in
    ripple(x, y);
    if (u !== picked) { sfx('click'); return pickServer(u); }
    if (!u.link) return;                                   // the About server is a label only
    sfx('drawer');
    if (u.project && !reduce) return enter(u);
    // the bottom server holds two links: left half, right half
    (u.links.length > 1 && u.pivot.worldToLocal(hit.point.clone()).x >= u.split ? u.links[1] : u.link).click();
  }

  // ---- the record player: one timeline, V.p seconds into putting a record on (0 in its sleeve, PLAYING spinning with the arm down).
  // The disc slides out of its sleeve's open side (out), rises in front of the shelf (rise), crosses over and lands flat on the platter (land);
  // the platter spins up (spin), the arm lifts, swings over and lowers (lift, swing, drop). Stop runs it backward
  const VT = { out: [.1, .9], rise: [.9, 1.5], cross: [1.5, 2], land: [2, 2.3], spin: [2.3, 3], lift: [2.4, 2.6], swing: [2.6, 3.4], drop: [3.4, 3.7] }, PLAYING = 3.7;
  const RPM = 33.3 / 60 * Math.PI * 2, SPRING = { k: 40, c: 10 }, PART_S = .8, PULL_S = 1.1;   // the shelf's pace: the parting spring, parting and pulling a record out (s)
  const V = { i: -1, next: -1, p: 0, to: 0, spin: 0, arm: 0 }, C = new THREE.Vector3(), D = new THREE.Vector3(), Q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), RX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  // the flip's state, one per cube: c is the spring's place across it (0 first record .. last), to its target (the pointer's place, or the
  // shown record's), e how far the records have parted. showing: the one record in the shelf pulled out to show its cover (a click), or null
  const flips = [0, 1, 2, 3].map(() => ({ c: 2, v: 0, to: 2, on: false, touch: false, e: 0, d: 0 }));   // d: how far into the hover display
  const DISPLAY_S = .6;
  let showing = null;
  const FP = new THREE.Vector3(), FR = new THREE.Quaternion(), SIDE = new THREE.Quaternion().setFromAxisAngle(Y, Math.PI / 2);
  const CA = new THREE.Vector3(), CB = new THREE.Vector3();
  function cubeAt(ev) {                                    // the cube whose front the pointer is over, or -1
    pick(ev);
    return room.vinyl.cubes.findIndex(c => {
      if (!c.recs.length) return false;
      const a = room.vinyl.top.localToWorld(CA.set(c.x0, c.y0, c.z1)).project(camera), b = room.vinyl.top.localToWorld(CB.set(c.x1, c.y1, c.z1)).project(camera);
      return ndc.x > a.x && ndc.x < b.x && ndc.y > a.y && ndc.y < b.y;
    });
  }
  function nearRecord(ev) {                                // a finger is wider than a spine: the record whose spine is nearest the tap on screen (24 px at most)
    pick(ev); const r = canvas.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
    let best = null, bd = 24;
    for (const s of room.vinyl.sleeves) {
      const a = s.localToWorld(CA.set(-.157, 0, -.002)).project(camera), b = s.localToWorld(CB.set(-.157, .314, -.002)).project(camera);   // the spine's ends
      const ya = (1 - a.y) / 2 * r.height, yb = (1 - b.y) / 2 * r.height, f = Math.min(Math.max((y - ya) / (yb - ya || 1), 0), 1);
      const d = Math.hypot((a.x + (b.x - a.x) * f + 1) / 2 * r.width - x, ya + (yb - ya) * f - y);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
  // Spotify's own embed, driven from code (its iFrame API) and kept off screen: whole songs for listeners logged in to Spotify in that browser,
  // 30 s previews for everyone else and in Safari (which keeps the embed from seeing the login). Loaded when the shelf close-up opens
  let spotify = null, spotifyAsked = false, sounding = false, spotAt = 0, played = '';   // spotAt: how far through its song Spotify's player is (0..1)
  function loadSpotify() {
    if (spotifyAsked) return; spotifyAsked = true;
    window.onSpotifyIframeApiReady = api => api.createController(stage.querySelector('.spotify-host > div'), {   // the inner div: the API replaces it with its iframe, inside the off-screen host
       uri: `spotify:track:${room.tracks[0].id}`, width: 300, height: 80 }, c => {
      spotify = c;
      c.addListener('playback_update', ({ data }) => {
        sounding = !data.isPaused && !data.isBuffering && data.playingURI === `spotify:track:${room.tracks[V.i]?.id}`; wake();   // the record spins only while Spotify is actually playing it
        if (!data.isPaused && !data.isBuffering) played = data.playingURI;
        // phones: Spotify's own bar is the only control, so its pause puts the record back
        else if (!hoverable && data.isPaused && !data.isBuffering && V.to && played === data.playingURI && data.playingURI === `spotify:track:${room.tracks[V.i]?.id}`) stop();
        const now = room.tracks[V.i];
        if (now && data.playingURI === `spotify:track:${now.id}` && data.duration) spotAt = data.position / data.duration;                       // the song on the turntable ended (not a late word about the one before): the record goes back
        if (now && V.to && data.playingURI === `spotify:track:${now.id}` && data.duration && data.position >= data.duration - 400) stop();
      });
    });
    document.head.append(Object.assign(document.createElement('script'), { src: 'https://open.spotify.com/embed/iframe-api/v1', async: true }));
  }
  addEventListener('keydown', e => { if (e.key === 'Escape' && (zoom.at || inRoomZoom())) leave(); });
  function shelfHit(ev) {
    pick(ev);
    const i = ray.intersectObject(room.vinyl.grp, true).find(i => { for (let o = i.object; o; o = o.parent) if (o === room.vinyl.lamp) return false; return true; }), h = i?.object;   // the desk lamp is no part of the shelf: tapping it leaves
    return { sleeve: room.vinyl.sleeves.includes(h) ? h : null, player: !!h && (h.parent === room.vinyl.player || h.parent?.parent === room.vinyl.player || h.parent === room.vinyl.disc), any: !!h, d: i?.distance ?? Infinity };
  }
  function play(i) {                                        // from a click: the song starts in it, since browsers let sound start only inside one
    if (V.i === i && V.to) return;
    if (V.i < 0) { V.i = i; V.to = PLAYING; } else { V.next = i; V.to = 0; }   // another one is on: it goes back first
    sing(room.tracks[i]); wake();
  }
  function stop() { V.next = -1; V.to = 0; silence(); wake(); }
  function silence() { sounding = false; spotify?.pause(); tips.now.hidden = true; }
  function sing(t) {
    sounding = false;
    tips.now.firstChild.data = `${t.name}, `; tips.now.querySelector('small').textContent = t.artists.join(', '); tips.now.hidden = false;
    // started (silently) inside your click, which is what lets it play with sound later: the song itself waits for the needle (drop())
    if (spotify && t.id) spotify.loadUri(`spotify:track:${t.id}`);
  }
  const songAt = () => room.tracks[V.i] ? spotAt : 0;   // how far through the song on the turntable (0..1)
  function drop(t) {                                        // the needle is down: the song, from its start
    if (!spotify || !t.id) return;
    spotAt = 0; spotify.play();   // Safari refuses this outside a tap: the visitor presses ▶ on the visible Spotify bar (style.css) and the record starts spinning then
  }
  function stepVinyl(dt) {                                  // true while something on the shelf moves
    const v = room.vinyl, ps = v.sleeves[V.i]?.userData, was = V.p;
    if (V.p !== V.to) {                                      // the disc leaves and comes home only through its sleeve out front, facing you
      let p = reduce ? V.to : V.p + Math.sign(V.to - V.p) * Math.min(dt, Math.abs(V.to - V.p));
      if (ps && ps.p < 1) {                                  // waits at the two hand-overs: before the disc leaves, and before it lifts off on the way back
        if (V.to > V.p && V.p <= VT.out[0]) p = Math.min(p, VT.out[0]);
        if (V.to < V.p && V.p >= VT.land[1]) p = Math.max(p, VT.land[1]);
      }
      V.p = p;
    }
    if (was < PLAYING && V.p >= PLAYING) drop(room.tracks[V.i]);   // the arm has landed
    if (V.p === 0 && !V.to && V.i >= 0) { V.i = V.next; V.next = -1; if (V.i >= 0) V.to = PLAYING; }
    const speed = reduce || !sounding ? 0 : RPM * ease(phase(V.p, ...VT.spin));
    V.spin += speed * dt;
    let moving = V.p !== V.to || speed > 0;
    // the disc's sleeve is out while the disc is off the platter, or on its way back; the one waiting its turn too. Otherwise in the shelf
    const needed = s => { const i = s.userData.i; return (i === V.i && (V.p || V.to) && (V.p < VT.land[1] || V.to < V.p)) || i === V.next; };
    // the flip (the motion of Animorio's print rack, rebuilt), per cube: the pointer's place across it pulls a spring, and the records part around
    // that place: bottoms spread along the cube's floor in order, the ones before leaning left and the ones after leaning right, each about its own
    // bottom edge. A record shown (a click) or needed by the player is then pulled (p 0..1): it stands straight (.15), slides out on its side,
    // spine first, until its back edge is clear of the cube (.6), then turns about a vertical axis to face you, rising 3 cm and swaying with the
    // spring. Nothing turns inside the cube, only one record per cube is ever turned, and the parting holds until every record is back in
    for (const [k, F] of flips.entries()) {
      const cb = v.cubes[k], recs = cb.recs, last = recs.length - 1;
      if (!recs.length) continue;
      const chosen = recs.find(needed) ?? (recs.includes(showing) ? showing : null);
      if (chosen) F.to = chosen.userData.j;
      const on = chosen || recs.some(s => s.userData.p > 0) ? 1 : 0;   // squared up for a record being shown or played
      F.e = reduce ? on : Math.min(Math.max(F.e + Math.sign(on - F.e) * dt / PART_S, 0), 1);
      const show = (F.on || F.touch) && !on ? 1 : 0;      // the display while the pointer is over the cube (a tap on phones), unless one is chosen
      F.d = reduce ? show : Math.min(Math.max((F.d ?? 0) + Math.sign(show - (F.d ?? 0)) * dt / DISPLAY_S, 0), 1);
      if (F.d !== show) moving = true;
      if (reduce) { F.c = F.to; F.v = 0; } else for (let n = 0; n < 2; n++) { F.v += (SPRING.k * (F.to - F.c) - SPRING.c * F.v) * dt / 2; F.c += F.v * dt / 2; }
      if (F.e !== on || Math.abs(F.to - F.c) + Math.abs(F.v) > 1e-3) moving = true;
      const e = inOut(F.e), dd = inOut(F.d), mx = (cb.x0 + cb.x1) / 2, outZ = cb.z1 + .17;
      FR.setFromAxisAngle(Y, Math.min(Math.max(-F.v * .06, -.2), .2));   // the one out front: facing you, swaying
      for (const s of recs) {
        const u = s.userData, d = u.j - F.c, side = Math.min(Math.max(d * 2, -1), 1);
        const turned = recs.some(o => o !== s && o.userData.p > .6), to = s === chosen && F.e === 1 ? (turned ? .6 : 1) : 0;   // it waits half out while another turns back
        if (u.p !== to) { u.p = reduce ? to : u.p + Math.sign(to - u.p) * Math.min(dt / PULL_S, Math.abs(to - u.p)); moving = true; }
        const up = inOut(phase(u.p, 0, .15)), slide = inOut(phase(u.p, .15, .6)), turn = inOut(phase(u.p, .6, 1));
        FP.set(cb.x0 + .075 + u.j * .012 + (side + 1) * .045, cb.y0, u.p0.z);   // squared up: upright, side-on, in order, 4.5 cm clear each side of the chosen one
        s.position.lerpVectors(u.p0, cb.display.at[u.j], dd).lerp(FP, e);   // rest -> display (hover) -> squared up (a choice)
        s.quaternion.slerpQuaternions(u.q0, cb.display.q, dd).slerp(SIDE, e);
        s.position.z += (outZ - s.position.z) * slide;
        s.position.x += (mx - s.position.x) * turn; s.position.y += .03 * turn;
        s.quaternion.slerp(FR, turn);
        if (u.p < .6) {                                     // in the cube it stands on the floor: turning from its lean, a bottom corner would dip through
          let low = Infinity;
          for (const x of [-.157, .157]) for (const z of [-.004, 0]) low = Math.min(low, C.set(x, 0, z).applyQuaternion(s.quaternion).y);
          s.position.y = Math.max(s.position.y, cb.y0 - low);
        }
        u.art.color.setScalar(1 - .1 * Math.min(Math.abs(d), 3) * e * (1 - u.p));
        // hover: the record under the pointer rises 2.5 cm in its own plane (clear of its neighbours) and brightens, where it stands
        const hot = s === recHot && !chosen && !F.e ? 1 : 0;
        u.lift = (u.lift ?? 0) + (hot - (u.lift ?? 0)) * (reduce ? 1 : 1 - Math.exp(-dt * 16));
        if (Math.abs(hot - u.lift) > 1e-3) moving = true;
        s.position.addScaledVector(C.set(0, 1, 0).applyQuaternion(s.quaternion), .025 * u.lift);
        u.art.emissive.setScalar(.14 * u.lift); u.edge.emissive.setScalar(.14 * u.lift);
      }
    }
    v.disc.visible = V.i >= 0 && V.p > VT.out[0];
    if (v.disc.visible) {                                    // never through a face: inside the closed sleeve it is hidden, out of it only in the air
      const s = v.sleeves[V.i], o = inOut(phase(V.p, ...VT.out)), r = inOut(phase(V.p, ...VT.rise)), c = inOut(phase(V.p, ...VT.cross)), l = inOut(phase(V.p, ...VT.land));
      if (v.label.material.map !== s.userData.map) { v.label.material.map = s.userData.map; v.label.material.needsUpdate = true; }
      C.set(.32 * o, .157, -.002).applyQuaternion(s.quaternion).add(s.position);   // along the sleeve's width, out of its open side
      C.y += (v.on.y + .06 - C.y) * r;                        // up in front of the shelf, turning flat, to 6 cm over the platter: clear of the deck and
      v.disc.position.copy(C).lerp(D.set(v.on.x, C.y, v.on.z), c);   // the resting arm (its top 4.7 cm up), then across and down onto it
      v.disc.position.y += (v.on.y - v.disc.position.y) * l;
      v.disc.quaternion.copy(s.quaternion).multiply(RX).slerp(Q.setFromAxisAngle(Y, V.spin), r);
    }
    v.platter.rotation.y = V.spin;
    if (V.p >= PLAYING && V.to) V.arm = v.swing + (v.inner - v.swing) * Math.min(Math.max(songAt(), 0), 1);   // tracking in with the song
    else if (!V.p) V.arm = v.swing;                         // at rest: the next record starts at the outer groove
    v.arm.rotation.y = V.arm * inOut(phase(V.p, ...VT.swing));   // lifting off, it swings home from wherever it got to
    v.arm.rotation.x = -.08 * (ease(phase(V.p, ...VT.lift)) - ease(phase(V.p, ...VT.drop)));
    return moving;
  }

  // ---- portal: pull the server out, tilt it down so its lid faces you, and fly into the page on the lid ----
  // the real writeup waits full-screen in an <iframe> behind the canvas; the lid is a window cut into the canvas, so the last frame is the page itself
  // (a screenshot stands in on the lid until the iframe loads)
  const shotOf = u => new URL(`portal-${u.link.pathname.split('/').pop().replace('.html', '')}.webp`, ASSETS).href;
  const shots = new Map();                                  // project unit -> its screenshot, fetched when its page first opens (page)
  function page(u) {                                        // preload when its server is in view or hovered
    if (!u?.project || reduce) return null;
    if (!shots.has(u)) shots.set(u, Object.assign(new Image(), { src: shotOf(u) }));
    let f = pages.get(u);
    if (!f) {
      for (const [v, g] of pages) if (v !== portal?.u) { g.remove(); pages.delete(v); }   // one at a time: each is a whole page, images and all, in memory
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
    if (img?.complete && img.naturalWidth) { const k = cv.width / img.naturalWidth; g.drawImage(img, 0, 0, cv.width, img.naturalHeight * k); }
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
    if (t > 1.2 && !portal.gone) { portal.gone = true; live(pages.get(u)); }
  }
  // the writeup stays in its iframe instead of loading as its own page, so a record on the turntable keeps playing through it:
  // the address bar and the title follow, Back (or its "Back to the rack" link) brings the rack back. Reloading gives the plain writeup page
  const homePage = { title: document.title, path: location.pathname.replace(/index\.html$/, '') }, isHome = path => path.replace(/index\.html$/, '') === homePage.path;
  function live(f) {
    const d = f.contentDocument, at = f.contentWindow.location.href;
    if (at !== location.href) history.pushState({ portal: 1 }, '', at);   // not when Back or Forward brought it here
    document.title = f.title = d.title;
    f.tabIndex = 0; f.removeAttribute('aria-hidden'); stage.removeAttribute('aria-hidden');
    document.documentElement.classList.add('portal-live');
    f.style.display = 'none'; f.offsetWidth; f.style.display = '';   // Chrome keeps the wheel routing from its pointer-events: none days until a relayout
    f.focus();
    if (f.dataset.hooked === undefined) { f.dataset.hooked = ''; f.addEventListener('load', () => { if (portal) live(f); }); }
    d.addEventListener('click', e => {
      const a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const to = new URL(a.href);
      if (to.origin !== location.origin) { a.target = '_blank'; a.rel = 'noopener'; return; }   // out of the site: a new tab, the music stays here
      if (to.pathname === at.replace(/[?#].*/, '').replace(location.origin, '')) return;      // a heading on this page
      e.preventDefault();
      if (isHome(to.pathname)) history.back();                                       // home: Back, to the rack
      else f.contentWindow.location.replace(to.href);                                      // another writeup, in the same frame (its load pushes the address)
    });
  }
  addEventListener('popstate', () => {
    const f = portal && pages.get(portal.u);
    if (!f) { if (!isHome(location.pathname)) location.reload(); return; }          // Forward into a writeup after leaving it: load it properly
    if (isHome(location.pathname)) { document.title = homePage.title; stage.setAttribute('aria-hidden', 'true'); leavePortal(); }
    else if (f.contentWindow.location.href !== location.href) f.contentWindow.location.replace(location.href);   // Back from one writeup to the one before
  });
  addEventListener('pageshow', e => {                       // back button from a writeup opened as its own page: put the rack back
    if (e.persisted && picked) pickServer(null);
    if (e.persisted && portal) leavePortal();
  });
  function leavePortal() {
    const { u, lid } = portal; portal = null;
    document.documentElement.classList.remove('portal-live');
    u.pivot.remove(lid.grp); lid.grp.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); });
    for (const f of pages.values()) f.remove(); pages.clear();
    document.documentElement.classList.remove('portal-on');
    for (const v of units) { v.pivot.position.z = v.baseZ; v.pivot.rotation.set(0, 0, 0); v.out = v.target = 0; }
    if (scanOn) { readScroll(); sCur = sTarget; updateScan(); }
    placeCamera(); wake();
  }

  // ---- loop: runs only while something moves and the stage is on screen ----
  let running = false, visible = true, last = performance.now(), boot = 0;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); }).observe(stage);
  document.addEventListener('visibilitychange', wake);
  let shMoved = true;
  function wake() { if (!running && visible && !document.hidden) { running = true; shMoved = true; last = performance.now(); renderer.setAnimationLoop(tick); } }
  if (room) room.arrived = wake;                             // a late prop: one more frame, with its shadow
  function tick(now) {
    const dt = Math.min(Math.max((now - last) / 1000, 0), .05) / SLOW; last = now;   // rAF time can trail performance.now()
    let moving = false, lit = false;
    const k = reduce ? 1 : 1 - Math.exp(-dt * 10);
    if (portal) { stepPortal(now); moving = !portal.gone; }   // once the writeup is the page, the room behind it stops drawing
    else {
      if (scanOn) {                                         // ease toward the scroll position so wheel steps glide
        sCur += (sTarget - sCur) * (1 - Math.exp(-dt * 8));
        if (Math.abs(sTarget - sCur) > 1e-3) moving = true; else sCur = sTarget;
        updateScan();
      }
      if (depthOn && stepDepth(dt)) moving = true;
      placeCamera();
      const on = bootStep();
      for (const u of units) {
        const to = Math.max(u.target, boot && on > u.i && on < u.i + 2 ? SLIDE : 0);   // power-on: each server slides out as it lights, then back in
        u.out += (to - u.out) * k;
        u.pivot.position.z = u.baseZ + u.out;
        if (Math.abs(to - u.out) > 1e-4) moving = true;
      }
      if (room) {
        if (rise && stepRise(now)) moving = true;
        if (fly) moving = true;
        const st = Math.round(sTarget);                     // a new stop: the dragged view eases back to its framing
        if (st !== orb.stop) { orb.stop = st; orb.back = !drag; zoom.at = null; showing = null; }
        const zk = zoom.at ? 1 : 0;                         // .8 s in or out
        hero.classList.toggle('is-zoomed', !!zoom.at);     // the shelf close-up: the name and hero text go, as in any close-up
        zoom.k = reduce ? zk : Math.min(Math.max(zoom.k + Math.sign(zk - zoom.k) * dt / .8, 0), 1);
        if (zoom.k !== zk) moving = true;
        brush.k = reduce ? brush.to : Math.min(Math.max(brush.k + Math.sign(brush.to - brush.k) * dt / .8, 0), 1);
        if (brush.k !== brush.to) moving = true;
        if (stepVinyl(dt)) moving = true;
        const n = room.night;                               // the light: 3 s between day and night, a sunset or a sunrise
        if (n.at !== n.to) { n.at = reduce ? n.to : Math.min(Math.max(n.at + Math.sign(n.to - n.at) * dt / 3, 0), 1); n.set(n.at, n.to); moving = true; }
        if (!reduce && closeUp()) { if (n.at > 0) n.lights(now / 1000); lit = true; }   // the racing clock (and at night the shelf's lights) run smoothly while the room is in view, without redrawing the sun's shadow
        if (orb.back) { orb.y -= orb.y * k; orb.p -= orb.p * k; if (Math.abs(orb.y) + Math.abs(orb.p) < 1e-4) { orb.y = orb.p = 0; orb.back = false; } else moving = true; }
        // the tools hop one after another (90 ms apart, 3 cm, 350 ms each); the Badminton brush stands 4 cm up at its stop; the tool under the
        // pointer lifts 2 cm more along its own lean and brightens a little, like a server under it
        const th = hop ? (now - hop) / 1000 / SLOW : 0, atBox = Math.abs(sCur - BOX) < .3;
        const kt = 1 - Math.exp(-dt * 14);                  // ~.25 s
        room.tools.forEach((o, i) => {
          const u = o.userData, up = (o === room.star && atBox ? .04 : 0) + (o === toolHot ? .02 : 0), glow = o === toolHot ? 1 : 0;
          u.out = (u.out ?? 0) + (up - (u.out ?? 0)) * kt; u.glow = (u.glow ?? 0) + (glow - (u.glow ?? 0)) * kt;
          if (Math.abs(up - u.out) + Math.abs(glow - u.glow) > 1e-3) moving = true;
          for (const m of u.mats) m.emissive.setScalar(.14 * u.glow);
          const p = Math.min(Math.max((th - i * .09) / .35, 0), 1);
          o.position.copy(u.p0).addScaledVector(u.up, u.out).y += hop ? .03 * Math.sin(Math.PI * p) : 0;
        });
        if (hop) { moving = true; if (th > room.tools.length * .09 + .35) hop = 0; }
      }
    }
    if (focus?.typed < focus?.chars) { const n = Math.min((performance.now() - focus.t0) / 25 | 0, focus.chars); if (n > focus.typed) focus.type(n); moving = true; }   // 25ms a char
    if (boot) moving = true;
    if (moving || shMoved) renderer.shadowMap.needsUpdate = true;   // the sun's shadow only redraws when something moved (this frame or the one before, for its last step)
    shMoved = moving;
    render();
    if (!(moving || lit) || !visible || document.hidden) { running = false; renderer.setAnimationLoop(null); }
  }
  const bootStep = () => boot ? (performance.now() - boot) / 130 / SLOW : powered ? 99 : -1;   // power-on: one server every 130ms, top to bottom (-1: dark until it is chosen)
  // the lift's ride in: straight up from below (6 m at the old 2.6 m room, scaled with it), fast and then settling (ease-out quart) over 1.8 s
  const RISE = { ms: 1800, drop: 6 * ROOM / 2.6 };
  const home = lift.position.clone();
  function stepRise(now) {                                  // true while it rides
    if (rise < 0) rise = now;
    const x = Math.min((now - rise) / (RISE.ms * SLOW), 1), e = 1 - (1 - x) ** 4;
    lift.position.y = home.y - RISE.drop * (1 - e);
    if (x >= 1) rise = 0;
    return !!rise;
  }
  if (rise) stepRise(performance.now());
  function render() {
    const t = performance.now() / 1000, on = bootStep();
    if (room) {                                             // the clock: the real time at load, then racing; every hand glides
      const d = new Date(CLOCK0 + (performance.now() - PERF0) * CLOCK_SPEED), sec = d.getSeconds() + d.getMilliseconds() / 1000, min = d.getMinutes() + sec / 60;
      room.hands.s.rotation.z = -sec / 60 * Math.PI * 2; room.hands.m.rotation.z = -min / 60 * Math.PI * 2; room.hands.h.rotation.z = -(d.getHours() % 12 + min / 60) / 12 * Math.PI * 2;
    }
    if (boot) { if (on > units.length + 2) { boot = 0; powered = true; } }   // 2 steps past the last server, so it slides back in
    for (const u of units) u.plate.material.color.setScalar((u === hot ? 3.2 : 1) * (.1 + .9 * ease(Math.min(Math.max(on - u.i, 0), 1))) * (1 - .8 * end));
    for (const b of blink) b.m.visible = on > (b.u?.i ?? 0) + .5 && (reduce || Math.sin(t * b.rate * (b.u && b.u === focus ? 3 : 1) + b.phase) > -.2);
    renderer.render(scene, camera);
    if (room) {                                             // the labels: rack and box at the close-up, Badminton auction at the showcase (or under the pointer there)
      const near = s => Math.abs(sCur - s) < .3 && !rise && !portal && !zoom.k;
      placed.length = 0;
      const atClose = near(1) || near(STOPS - 1);
      label(tips.rack, atClose, rackTop); label(tips.box, atClose, room.boxFoot); label(tips.vinyl, atClose, room.vinyl.tipAt);
      const starOn = near(BOX) || starHot;
      if (starOn && room.star) {                            // above the brush as the camera sees it (from overhead, that is its far side, not its highest point)
        rackBox.setFromObject(room.star).getCenter(starTop).project(camera); starTop.y = -1;
        for (let i = 0; i < 8; i++) starTop.y = Math.max(starTop.y, corner.set(rackBox[i & 1 ? 'max' : 'min'].x, rackBox[i & 2 ? 'max' : 'min'].y, rackBox[i & 4 ? 'max' : 'min'].z).project(camera).y);
        starTop.unproject(camera);
      }
      label(tips.star, starOn && !!room.star, starTop);
      label(tips.window, winHot && choosing() && !rise && !portal, room.winTop);   // last, so it moves below a label it would cover
      const view = zoom.at === 'vinyl' && !portal ? 'shelf' : starOn && !starHot ? 'box' : !portal && !zoom.at && Math.abs(sCur - Math.round(sCur)) < .2 && Math.round(sCur) >= FIRST && Math.round(sCur) < BOX ? 'server' : '';   // (the Spotify bar shows at the shelf on desktop too)
      if (stage.dataset.view !== view) stage.dataset.view = view;
      if (!hoverable) {                                     // phones: the cover strip at the shelf, Back at the box; the playing cover outlined
        const ui = document.querySelector('.phone-ui .covers');
        for (const [i, b] of [...ui.children].entries()) b.classList.toggle('on', i === (V.to ? V.i : V.next));
      }
    }
  }
  const rackTop = new THREE.Vector3(0, rackTopY + .05, 0), starTop = new THREE.Vector3(), tipAt = new THREE.Vector3();
  function label(el, on, p) {                               // show el at world point p (projected this frame), kept inside the stage
    el.hidden = !on;
    if (!on) return;
    tipAt.copy(p).project(camera);
    const half = el.offsetWidth / 2 + 8, tall = el.offsetHeight + 22;   // 14 px off its point (style.css) + 8
    el.style.left = `${Math.min(Math.max((tipAt.x + 1) / 2 * W, half), W - half)}px`; el.style.top = `${Math.min(Math.max((1 - tipAt.y) / 2 * H, tall), H - tall)}px`;
    for (const r of placed) {                               // narrow screens: a label that would cover one placed before it is left out
      const b = el.getBoundingClientRect();
      if (b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top) { el.hidden = true; return; }   // moving it down would cover another target, so the later label gives way
    }
    placed.push(el.getBoundingClientRect());
  }
  const placed = [];
  // shortcut: idle redraw is 1x/s (clock hands, LED blink steps); the LEDs blink smoothly only while the loop runs
  setInterval(() => { if (!running && visible && !document.hidden && !portal) render(); }, 1000);   // the room's clock ticks (once a second) even with reduced motion: telling time is its job
  if (scanOn) { readScroll(); sCur = sTarget; updateScan(); }
  if (depthOn) stepDepth(1);
  wake();
  placeCamera(); render(); loaded();
  if (room) requestAnimationFrame(() => 'requestIdleCallback' in window ? requestIdleCallback(room.loadProps, { timeout: 1500 }) : setTimeout(room.loadProps, 1500));   // the box's props, after the first frame
}

// the room around the rack, in metres (the rack is 2 m tall, centred on the origin, front to +z).
// Two walls and a floor, open on +x and +z: floor x XL..XL+ROOM, z Z0..Z0+ROOM, top at y -1 (the rack's base); the rack stands in the back-left corner
const ROOM = 4.2, WALL_H = 3.4, Z0 = -.34;
// the walls are built like a house's, outward from the room: plaster and paint inside, a half brick, render and paint outside (depths in m)
const WALL = [[0, .015, 'paint'], [.015, .13, 'brick'], [.13, .15, 'paint']], T = .15;
const CLOCK_SPEED = 720, CLOCK0 = Date.now(), PERF0 = performance.now();   // the wall clock races from the real time at load: 12 hours a minute (the hour hand laps in 60 s, the minute hand in 5 s)
const ROOM_LIGHT = .3;                                       // brightness of the room's own studio light (the rack keeps its dim one)
const SUN = 13;                                               // sunlight through the window (illuminance across the beam)
// the sun's direction of travel: 36 degrees up, in through the left wall, slanting 20 degrees toward the open front, so the window's four panes land
// on the open floor. Higher, and with no ceiling it would clear the 3.4 m wall and light a strip along the floor's far edge too
const SUN_DIR = ((up, side) => new THREE.Vector3(Math.cos(up) * Math.cos(side), -Math.sin(up), Math.cos(up) * Math.sin(side)))(36 * Math.PI / 180, 20 * Math.PI / 180);
const ALBEDO = .8;                                           // the white marble floor's: how much of the light on it bounces back into the room
const BOX_SCALE = .65;                                       // the art box at 65% so the tools fill it (scripts/settle-art.py uses the same)
const DISPLAY = { gap: .02, margin: .005 };                  // the record shelf's hover display: the clear space between records, and off the side walls (m)
// dark mode: night you can see in. The studio light's share (tinted cool by a moon-blue hemisphere light), the moon through the window, the shelf's
// Christmas lights (their glow's radiance) and the desk lamp's candela
const NIGHT = { room: .12, hemi: .6, moon: 1.4, led: 9, desk: 3 };
// the moon's direction of travel: 32 degrees up, in through the left wall like the sun but slanting further toward the open front
const MOON_DIR = ((up, side) => new THREE.Vector3(Math.cos(up) * Math.cos(side), -Math.sin(up), Math.cos(up) * Math.sin(side)))(32 * Math.PI / 180, 35 * Math.PI / 180);
const MARBLE = 1.2;                                          // ambientCG Marble 021 (CC0, assets/tex/marble-*.jpg): tile size in metres, the floor
const TILE = { paint: 2, brick: .75 };                       // ambientCG PaintedPlaster017 and Bricks104 (CC0, assets/tex/paint-*, brick-*): metres per tile (a brick course is 7.5 cm)
// the view out of the window over a day, e 0 (day) .. 1 (night). Going dark the sun sets in the west (left), going light it rises in the east
// (right): the sky passes through a sunset's colours one way and a sunrise's the other. The moon and stars come out last and go first (the
// same stars every time); the clouds catch the low sun and fade at night
const SKY = { day: ['#5fa6ea', '#d6ebfb'], set: ['#3b4a8a', '#ff8a4a'], rise: ['#6a6fa8', '#ffb59a'], night: ['#060b1d', '#1b2a52'] };
function paintSky(cv, e, rising) {
  const cx = cv.getContext('2d'), W = cv.width, H = cv.height, mid = SKY[rising ? 'rise' : 'set'], f = Math.min(e * 2, 1), f2 = Math.max(e * 2 - 1, 0);
  const at = k => '#' + new THREE.Color(SKY.day[k]).lerp(new THREE.Color(mid[k]), f).lerp(new THREE.Color(SKY.night[k]), f2).getHexString();
  const g = cx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, at(0)); g.addColorStop(1, at(1));
  cx.globalAlpha = 1; cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  const glow = (x, y, r, c) => { const q = cx.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, c); q.addColorStop(1, 'transparent'); cx.fillStyle = q; cx.fillRect(0, 0, W, H); };
  const s = rising ? .5 - .65 * e : .5 + .65 * e, sx = W * (.93 - .86 * s), sy = H * (.9 - .78 * Math.sin(Math.PI * s));   // the sun's arc, east to west
  const sunCol = new THREE.Color('#fff8e1').lerp(new THREE.Color(rising ? '#ffb27a' : '#ff5a1f'), f);
  if (sy < H) { cx.globalAlpha = 1 - f2; glow(sx, sy, 260 - 80 * f, `#${sunCol.getHexString()}e6`); cx.globalAlpha = f * (1 - f2); cx.fillStyle = `#${sunCol.getHexString()}`; cx.beginPath(); cx.arc(sx, sy, 24, 0, Math.PI * 2); cx.fill(); }
  const cloud = new THREE.Color('#ffffff').lerp(new THREE.Color(mid[1]), f * .7);
  cx.globalAlpha = .55 * (1 - f2); cx.fillStyle = `#${cloud.getHexString()}`;
  for (const [x, y, w] of [[380, 300, 90], [450, 290, 70], [330, 310, 60], [120, 380, 70], [180, 372, 50]]) { cx.beginPath(); cx.ellipse(x, y, w, w * .32, 0, 0, Math.PI * 2); cx.fill(); }
  const dark = Math.min(Math.max((e - .6) / .4, 0), 1);
  if (dark) {
    let seed = 7; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    cx.fillStyle = '#fff';
    for (let i = 0; i < 70; i++) { cx.globalAlpha = dark * (.35 + .65 * rnd()); cx.beginPath(); cx.arc(rnd() * W, rnd() * 380, .6 + rnd() * 1.4, 0, Math.PI * 2); cx.fill(); }
    cx.globalAlpha = dark; glow(390, 150, 110, 'rgb(190 210 255 / .35)');
    cx.fillStyle = '#f3efe2'; cx.beginPath(); cx.arc(390, 150, 30, 0, Math.PI * 2); cx.fill();
  }
  cx.globalAlpha = 1;
}
// the room's files: what it needs to rise (main), and the box's contents (later), which join it as they arrive, so the slow brushes hold nothing up
// the Draco decoder is three's own, copied to public/draco: same origin, so no CDN connection on the room's critical path
function roomFiles() {
  const libs = track(Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/loaders/DRACOLoader.js'),
    import('three/addons/environments/RoomEnvironment.js'), import('three/addons/lights/RectAreaLightUniformsLib.js')]));
  const glb = f => libs.then(([{ GLTFLoader }, { DRACOLoader }]) => (glb.loader ??= new GLTFLoader().setDRACOLoader(new DRACOLoader()
    .setDecoderPath(new URL('../draco/', ASSETS).href))).loadAsync(new URL(`${f}.glb`, ASSETS).href)).then(g => g.scene);
  const json = f => track(fetch(new URL(f, ASSETS)).then(r => r.json()));
  return { libs, main: Promise.all([json('art-layout.json'), json('record-layout.json') /* scripts/settle-records.py */, json('data/top-tracks.json') /* scripts/fetch-spotify.mjs */,
      ...['clock', 'lamp', 'box'].map(f => track(glb(f)))]),   // the clock and lamp hold lights and hands, and the box places the rest
    later: () => ['cup', 'spraycan', 'tube', 'paintbrush-1', 'paintbrush-2', 'paintbrush-3'].map(glb) };   // called once the room is up, so they don't slow it
}
async function buildRoom(renderer, rack, files) {
  const XL = rack.min.x - .18, X1 = XL + ROOM;                // the left wall 18 cm off the rack's side
  const [, , { RoomEnvironment }, { RectAreaLightUniformsLib }] = await files.libs;
  RectAreaLightUniformsLib.init();                           // the floor's bounce lights (see bounce())
  const [layout, recLayout, { tracks }, clock, deskLamp, box] = await files.main;

  // white marble on the floor; the walls painted white (see WALL), so the things in the room do the talking
  const tl = new THREE.TextureLoader(), texLoads = [];        // the room rises only once these are in: an untextured floor shows brown under the lamp
  const surface = (k, rx, ry, roughness, n) => {             // a texture set, repeated rx x ry times over each face's UVs
    const [map, normalMap, roughnessMap] = ['diff', 'nor', 'rough'].map(m => {
      let t; texLoads.push(track(new Promise(r => { t = tl.load(new URL(`tex/${k}-${m}.jpg`, ASSETS).href, r, undefined, r); })));   // a failed one still lets the room in
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; return t;
    });
    map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map, normalMap, roughnessMap, roughness, normalScale: new THREE.Vector2(n, n) });
  };
  const floor = new THREE.Mesh(new THREE.BoxGeometry(ROOM + T, .08, ROOM + T), surface('marble', ROOM / MARBLE, ROOM / MARBLE, .75, .4));   // a little polished
  floor.position.set(X1 - (ROOM + T) / 2, -1.04, Z0 - T + (ROOM + T) / 2);   // runs under the walls too
  // each wall layer is an L of boxes (the back wall's runs on past the left wall's, so every layer turns the corner unbroken), the left one in
  // four pieces around the window's opening. UVs come from the world position on each face, so paint and bricks keep their real size and line up
  const WIN = { y: -1 + 1.65, z: Z0 + ROOM * .45, w: 1.2, h: 1.3 }, wy0 = WIN.y - WIN.h / 2, wy1 = WIN.y + WIN.h / 2, wz0 = WIN.z - WIN.w / 2, wz1 = WIN.z + WIN.w / 2;
  const mats = { paint: surface('paint', 1, 1, 1, .5), brick: surface('brick', 1, 1, 1, .8) }, Y0 = -1, Y1 = -1 + WALL_H;
  const slab = (x0, x1, y0, y1, z0, z1, k) => {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (Math.abs(n.getX(i)) > .5 ? p.getZ(i) : p.getX(i)) / TILE[k], (Math.abs(n.getY(i)) > .5 ? p.getZ(i) : p.getY(i)) / TILE[k]);
    const m = new THREE.Mesh(g, mats[k]); m.castShadow = m.receiveShadow = true; return m;
  };
  const walls = WALL.flatMap(([d0, d1, k]) => [
    slab(XL - d1, X1, Y0, Y1, Z0 - d1, Z0 - d0, k),                                   // back
    ...[[Y0, wy0, Z0 - d0, Z0 + ROOM], [wy1, Y1, Z0 - d0, Z0 + ROOM], [wy0, wy1, Z0 - d0, wz0], [wy0, wy1, wz1, Z0 + ROOM]]
      .map(([y0, y1, z0, z1]) => slab(XL - d1, XL - d0, y0, y1, z0, z1, k))]);        // left, around the window
  const stalk = buildStalk();
  stalk.position.set(floor.position.x, -1.08, floor.position.z); stalk.rotation.y = Math.PI / 4; stalk.scale.setScalar(ROOM / 2.6);   // its housing faces the open corner; drawn for a 2.6 m floor
  const shell = new THREE.Group().add(floor, ...walls);

  // the art box, real size, all CC BY 4.0: ForgeCAD's box against the back wall, left of the rack; in it NVIDIA's spray can
  // and Palatial's cup, with NVIDIA's tubes and brushes in the cup
  const put = (o, x, y, z) => {                              // its bottom centre to x, y, z
    const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3());
    o.position.x += x - c.x; o.position.y += y - b.min.y; o.position.z += z - c.z;
  };
  const art = new THREE.Group().add(box);
  box.scale.setScalar(BOX_SCALE);
  put(box, XL + ROOM / 2, -1, Z0 + .17);                     // its 40 cm side along the back wall (the folded flaps stand 1 cm off it), halfway along it
  const tools = [];                                          // what hops when the box is clicked: filled as the contents arrive (see the end)

  // the window: a painted frame and sash, thin glass, and a sky outside it (see paintSky())
  const win = new THREE.Group(), trimM = new THREE.MeshStandardMaterial({ color: '#f1ede4', roughness: .6 });
  const bar = (dx, dy, dz, x, y, z, m = trimM) => { const o = new THREE.Mesh(new THREE.BoxGeometry(dx, dy, dz), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; win.add(o); };
  for (const s of [-1, 1]) {
    bar(.016, .07, WIN.w + .14, XL + .008, WIN.y + s * (WIN.h / 2 + .035), WIN.z);   // the trim on the room side
    bar(.016, WIN.h, .07, XL + .008, WIN.y, WIN.z + s * (WIN.w / 2 + .035));
    bar(T, .015, WIN.w, XL - T / 2, WIN.y + s * (WIN.h / 2 - .0075), WIN.z, mats.paint);   // the opening's sides, plastered like a real reveal
    bar(T, WIN.h, .015, XL - T / 2, WIN.y, WIN.z + s * (WIN.w / 2 - .0075), mats.paint);
  }
  bar(.035, WIN.h, .035, XL - T / 2, WIN.y, WIN.z); bar(.035, .035, WIN.w, XL - T / 2, WIN.y, WIN.z);   // the sash bars: four panes
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w, WIN.h).rotateY(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#d7e8f2', roughness: .05, transparent: true, opacity: .14, depthWrite: false,
    stencilWrite: true, stencilRef: 1, stencilZPass: THREE.ReplaceStencilOp }));   // marks the visible glass for the sky
  glass.position.set(XL - T / 2 + .004, WIN.y, WIN.z); win.add(glass);
  const skyCv = Object.assign(document.createElement('canvas'), { width: 600, height: 520 }), skyTex = new THREE.CanvasTexture(skyCv);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  // the sky: big enough for a steep look through the window, drawn after the glass and only where it marked, so it never shows past the wall's edge
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(8, 5).rotateY(Math.PI / 2), new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false,
    transparent: true, depthWrite: false, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.EqualStencilFunc }));
  outside.position.set(XL - T - .8, WIN.y, WIN.z); outside.renderOrder = 1; outside.raycast = () => {};   // a click past the window's edge is on the page, not the sky

  // sunlight: a DirectionalLight, parallel rays as the sun's are. Its shadow camera takes in the whole room, so the walls block it everywhere
  // and only the window's panes let it in: the sash bars' cross on the floor is the frame's own shadow. The glass casts none
  const rc = new THREE.Vector3(XL + ROOM / 2 - T / 2, -1 + WALL_H / 2, Z0 + ROOM / 2 - T / 2), SR = 3.6;   // the room's middle; its bounding radius
  const sun = new THREE.DirectionalLight('#fff1d6', SUN);
  sun.target.position.copy(rc); sun.position.copy(rc).addScaledVector(SUN_DIR, -8);
  Object.assign(sun.shadow.camera, { left: -SR, right: SR, top: SR, bottom: -SR, near: 8 - SR, far: 8 + SR });
  const SM = matchMedia('(pointer: coarse)').matches ? 1024 : 2048;   // phones: a quarter of the memory, the sash bars still ~5 texels wide
  sun.castShadow = true; sun.shadow.mapSize.set(SM, SM); sun.shadow.bias = -.0002; sun.shadow.normalBias = .01;
  // the sun is .53 degrees across, so a shadow's edge blurs .93 cm per metre from what casts it: ~1.9 cm from the sash bars to the floor,
  // in shadow texels (2 * SR / SM m each), half each side. ponytail: one softness for the room, PCSS if a nearer shadow looks too soft
  sun.shadow.radius = 2 * Math.tan(.53 / 2 * Math.PI / 180) * 2 / (2 * SR / SM) / 2;
  // where the sun lands: the window opening's corners carried along SUN_DIR to the floor (y -1), and its one bounce: a floor-sized area light facing up
  // whose radiance is what a matte floor of ALBEDO gives back from that light, ALBEDO x E / pi (E: the light on the floor). Area lights cast no shadow
  const toFloor = p => p.clone().addScaledVector(SUN_DIR, (-1 - p.y) / SUN_DIR.y);
  const patch = [[wy0, wz0], [wy0, wz1], [wy1, wz0], [wy1, wz1]].map(([y, z]) => toFloor(new THREE.Vector3(XL - T / 2, y, z)));
  const pc = patch.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / 4);
  const bounce = (color, x, z, w, d, E, y = -1) => {
    const l = new THREE.RectAreaLight(color, ALBEDO * E / Math.PI, w, d);
    l.position.set(x, y + .002, z); l.rotation.x = Math.PI / 2;   // its light leaves its -z side: turned to face up
    l.userData.full = l.intensity; return l;
  };
  const sunE = SUN * -SUN_DIR.y;                             // on the floor: the beam's illuminance times the cosine of its angle to the floor
  const xs = patch.map(p => p.x), zs = patch.map(p => p.z);
  const sunUp = bounce('#fff1d6', pc.x, pc.z, Math.max(...xs) - Math.min(...xs), WIN.w, sunE);   // the patch's length along x; across, the window's width (z is unchanged by the sun's path)
  // night: the moon through the window, as the sun by day (its own shadow over the whole room, so only the window lets it in, its cross on the
  // floor in pale blue, and its bounce), and a moon-blue hemisphere light tinting the room's own light cool
  const moon = new THREE.DirectionalLight('#9db8ff', 0);
  moon.target.position.copy(rc); moon.position.copy(rc).addScaledVector(MOON_DIR, -8);
  Object.assign(moon.shadow.camera, { left: -SR, right: SR, top: SR, bottom: -SR, near: 8 - SR, far: 8 + SR });
  moon.castShadow = true; moon.shadow.mapSize.set(SM, SM); moon.shadow.bias = -.0002; moon.shadow.normalBias = .01; moon.shadow.radius = sun.shadow.radius;
  const moonPatch = [[wy0, wz0], [wy0, wz1], [wy1, wz0], [wy1, wz1]].map(([y, z]) => { const q = new THREE.Vector3(XL - T / 2, y, z); return q.addScaledVector(MOON_DIR, (-1 - q.y) / MOON_DIR.y); });
  const mc = moonPatch.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / 4), mxs = moonPatch.map(q => q.x);
  const moonUp = bounce('#9db8ff', mc.x, mc.z, Math.max(...mxs) - Math.min(...mxs), WIN.w * 1.3, NIGHT.moon * -MOON_DIR.y);
  const hemi = new THREE.HemisphereLight('#6d87c8', '#05070c', 0);
  hemi.position.set(0, 100, 0);                              // its 'up' is its world position seen from the origin: high, so the rise from below can't tip it over (a brown floor)

  // Palatial's wall clock (CC BY 4.0), 1.6x its real 25 cm: high on the left wall. Its scan has the hands painted on the dial,
  // so a dial of our own covers it, with hands that turn (see hands())
  clock.scale.setScalar(1.6); clock.rotation.y = Math.PI / 2;   // its face (+z in the glb) to the room (+x)
  clock.position.set(XL + .0345 * 1.6, -1 + 2.75 - .1275 * 1.6, Z0 + ROOM - .6);   // its back on the wall, its centre 2.75 m up, near the open end
  await document.fonts.load('700 64px "Space Grotesk"');
  const cv = Object.assign(document.createElement('canvas'), { width: 512, height: 512 }), cx = cv.getContext('2d');
  cx.fillStyle = '#f4f1ea'; cx.beginPath(); cx.arc(256, 256, 256, 0, Math.PI * 2); cx.fill();
  cx.fillStyle = '#0d0d0d'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.font = '700 64px "Space Grotesk", sans-serif';
  for (let i = 1; i <= 60; i++) {                            // minute marks, and the hours' numbers
    const a = i / 60 * Math.PI * 2, sn = Math.sin(a), cs = -Math.cos(a), r0 = i % 5 ? 236 : 222;
    cx.lineWidth = i % 5 ? 3 : 7; cx.beginPath(); cx.moveTo(256 + sn * r0, 256 + cs * r0); cx.lineTo(256 + sn * 248, 256 + cs * 248); cx.stroke();
    if (!(i % 5)) cx.fillText(String(i / 5), 256 + sn * 176, 256 + cs * 176 + 4);
  }
  const dialTex = new THREE.CanvasTexture(cv); dialTex.colorSpace = THREE.SRGBColorSpace; dialTex.anisotropy = 8;
  const dial = new THREE.Mesh(new THREE.CircleGeometry(.108, 64), new THREE.MeshStandardMaterial({ map: dialTex, roughness: .6 }));
  dial.position.set(0, .1275, .0099); clock.add(dial);
  const hand = (len, tail, w, color, z) => {                 // pointing up (12 o'clock) from its pivot at the dial's centre
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len + tail, .0012).translate(0, (len - tail) / 2, 0), new THREE.MeshStandardMaterial({ color, roughness: .5 }));
    m.position.set(0, .1275, z); clock.add(m); return m;
  };
  const hands = { h: hand(.058, .012, .007, '#0d0d0d', .0106), m: hand(.088, .014, .005, '#0d0d0d', .0114), s: hand(.092, .022, .0018, '#FF2D78', .0122) };
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, .004, 24).rotateX(Math.PI / 2), hands.s.material); pin.position.set(0, .1275, .0128); clock.add(pin);
  // the record shelf on the back wall, right of the box
  const vinyl = buildVinyl(tracks, tl, recLayout);
  vinyl.grp.position.set(XL + ROOM * .82, -1, Z0 + .2); vinyl.grp.updateMatrixWorld(true);
  // the shelf's Christmas lights: one green wire hung from each board's front edge, swagging across every cube (a catenary, 2.5 cm deep, so a
  // record pulled out passes under it), down the right side, then back along the lower row. 12 bulbs a cube, tipped toward you, in five colours
  // that a controller changes at night (lights below). Each cube's glow is one small area light just inside it, tipped down over the records
  const BULBS = ['#ff1a1a', '#14d24a', '#1f5bff', '#ffc21a', '#ff6a00'].map(c => new THREE.Color(c)), SAG = .025, BZ = vinyl.cubes[0].z1 + .006;
  const hookY = c => c.y1 + .028, swag = (c, u) => hookY(c) + SAG * (Math.cosh(1.5 * u) - Math.cosh(1.5)) / (Math.cosh(1.5) - 1);   // u -1..1 across it
  const pts = [], beads = [], glows = [];                  // beads[cube * 12 + j]: bulb j of that cube, left to right
  [0, 1, 3, 2].forEach((k, n) => {                         // top left, top right, bottom right, bottom left
    const c = vinyl.cubes[k], a = c.x0 - .015, b = c.x1 + .015, back = k > 1;   // hooks at the boards' middles; the lower row runs right to left
    if (n === 2) pts.push(new THREE.Vector3(b, hookY(vinyl.cubes[1]) - .03, BZ), new THREE.Vector3(b, hookY(c) + .03, BZ));   // straight down the side
    for (let s = n % 2 ? 1 : 0; s <= 12; s++) { const u = back ? 1 - s / 6 : s / 6 - 1; pts.push(new THREE.Vector3((a + b) / 2 + u * (b - a) / 2, swag(c, u), BZ)); }
    for (let j = 0; j < 12; j++) { const u = (j + .5) / 6 - 1; beads[k * 12 + j] = new THREE.Vector3((a + b) / 2 + u * (b - a) / 2, swag(c, u) - .002, BZ); }
    const light = glows[k] = new THREE.RectAreaLight('#fff', 0, (c.x1 - c.x0) * .9, .03);
    light.position.set((c.x0 + c.x1) / 2, c.y1 - .03, c.z1 - .02); light.rotation.x = -Math.PI / 4;   // its light leaves its -z side: tipped down into the cube
  });
  const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 400, .0015, 6), new THREE.MeshStandardMaterial({ color: '#173d22', roughness: .6 }));
  const tip = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -Math.cos(1.1), Math.sin(1.1)));   // 63 degrees from hanging straight down
  const M = new THREE.Matrix4(), ONE = new THREE.Vector3(1, 1, 1);
  // one mesh for all 48; each bulb's colour is its instance colour, for its glass and (onBeforeCompile) its glow
  const bulbs = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.0035, .007, 4, 8).translate(0, .007, 0), new THREE.MeshStandardMaterial({ emissive: '#fff', emissiveIntensity: 0, roughness: .25 }), beads.length);
  bulbs.material.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor.rgb;'); };
  beads.forEach((p, b) => { bulbs.setMatrixAt(b, M.compose(p, tip, ONE)); bulbs.setColorAt(b, BULBS[b % 5]); });
  bulbs.computeBoundingSphere();
  for (const o of [wire, bulbs]) o.raycast = () => {};       // never in the way of a click on a record
  vinyl.top.add(wire, bulbs, ...glows);
  // Poly Haven's Desk Lamp Arm 01 (CC0): an architect's lamp clamped to the shelf top's left edge, its arm turned over the shelf. At night its bulb
  // glows and a warm spot from the bulb lights the deck, with its own bounce off the shelf top
  deskLamp.rotation.y = -Math.PI / 2; deskLamp.position.set(-.4, .8, -.02); vinyl.grp.add(deskLamp); vinyl.lamp = deskLamp;   // beside the shelf top's group, so the shelf close-up frames the shelf, not the lamp
  let bulbM = null; deskLamp.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.name.endsWith('_light')) bulbM = m; });
  vinyl.top.updateMatrixWorld(true);
  vinyl.grp.updateMatrixWorld(true);
  const bulbAt = deskLamp.localToWorld(new THREE.Vector3(-.002, .693, -.174)), deskAim = vinyl.top.localToWorld(vinyl.on.clone());
  const desk = new THREE.SpotLight('#ffcf8a', 0, 0, .42, .5, 2);
  desk.position.copy(bulbAt); desk.target.position.copy(deskAim);
  desk.castShadow = true; desk.shadow.mapSize.set(1024, 1024); desk.shadow.bias = -.0004; desk.shadow.radius = 3;
  const shelfTop = vinyl.top.localToWorld(new THREE.Vector3(0, .8, 0)), dd2 = bulbAt.distanceToSquared(deskAim);
  const deskUp = bounce('#ffcf8a', (bulbAt.x + deskAim.x) / 2, shelfTop.z, .6, .3, NIGHT.desk / dd2 * .6, shelfTop.y);   // the lit part of the shelf top
  vinyl.box = new THREE.Box3().setFromObject(vinyl.top);
  vinyl.tipAt = vinyl.grp.localToWorld(new THREE.Vector3(0, 1.4, 0));
  const root = new THREE.Group().add(shell, stalk, art, clock, vinyl.grp, win, sun, sun.target, sunUp, moon, moon.target, moonUp, hemi, desk, desk.target, deskUp);
  root.traverse(o => { if (o.isMesh && o !== glass) o.castShadow = o.receiveShadow = true; });   // everything in the room blocks and catches light but the glass
  // the rack's dim reflection room leaves the walls dark: the room gets three.js's studio light as its own envMap (scene.environment stays the rack's)
  const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
  const lit = [];
  root.traverse(o => { for (const m of o.material ? [].concat(o.material) : []) { m.envMap = env; m.envMapIntensity = ROOM_LIGHT; lit.push(m); } });   // one material or one per face (the sleeves)
  // the lights' controller, like a real string's: three modes, 8 s each. Chase: the colours walk along the string, a bulb every half-second.
  // Fade: every bulb fades through the colours, each a step behind its neighbour. Flash: every other bulb blinks, taking the next colour as it
  // lights. Each cube's glow takes the average of its 12 bulbs. t 0 is the string's own colours, held by day and with reduced motion
  const BC = new THREE.Color();
  const lights = t => {
    const mode = Math.floor(t / 8) % 3, s = Math.floor(t * (mode === 2 ? 2.5 : 2));
    glows.forEach(l => l.color.setRGB(0, 0, 0));
    for (let b = 0; b < beads.length; b++) {
      if (mode === 0) BC.copy(BULBS[(b + s) % 5]);
      else if (mode === 1) { const f = t / 1.5 + b * .25, i = Math.floor(f), x = f - i; BC.lerpColors(BULBS[i % 5], BULBS[(i + 1) % 5], x * x * (3 - 2 * x)); }
      else BC.copy(BULBS[(b + Math.floor((s + b % 2) / 2)) % 5]).multiplyScalar((b + s) % 2 ? .08 : 1);
      bulbs.setColorAt(b, BC); glows[b / 12 | 0].color.add(BC);
    }
    bulbs.instanceColor.needsUpdate = true; glows.forEach(l => l.color.multiplyScalar(1 / 12));
  };
  const SUN_COL = new THREE.Color('#fff1d6'), SUN_LOW = new THREE.Color('#ff9a5a');
  const setNight = (n, to = n) => {                         // 0 day .. 1 night; to: where it is heading (below n: back to day, a sunrise)
    const e = n;                                            // linear, in step with the page's 3 s fade (style.css .theme-fading)
    paintSky(skyCv, e, to < n); skyTex.needsUpdate = true;   // the view: the sun setting or rising, then the moon
    sun.color.copy(SUN_COL).lerp(SUN_LOW, Math.sin(Math.PI * e));   // the low sun's warm light, either way
    sun.intensity = SUN * (1 - e); sunUp.intensity = sunUp.userData.full * (1 - e); sun.visible = sunUp.visible = e < 1;
    moon.intensity = NIGHT.moon * e; moonUp.intensity = moonUp.userData.full * e; moon.visible = moonUp.visible = e > 0;
    hemi.intensity = NIGHT.hemi * e;
    for (const l of glows) { l.intensity = NIGHT.led * e; l.visible = e > 0; }
    bulbs.material.emissiveIntensity = 1.4 * e; lights(0);
    desk.intensity = NIGHT.desk * e; deskUp.intensity = deskUp.userData.full * e; desk.visible = deskUp.visible = e > 0;
    if (bulbM) { bulbM.emissive.set('#ffcf8a'); bulbM.emissiveIntensity = 2.5 * e; }   // the bulb glows at night
    for (const m of lit) m.envMapIntensity = ROOM_LIGHT * (1 - (1 - NIGHT.room) * e);
  };
  const out = { root, art, tools, hands, vinyl, tracks, star: null,                 // star: the brush that is Badminton auction (the wide yellow one), once it's in
    all: new THREE.Box3().setFromObject(root), shell: new THREE.Box3().setFromObject(shell),
    box: ((b) => { b.max.y += .093; b.max.z += .013; return b; })(new THREE.Box3().setFromObject(art)),   // with the contents' reach above and in front of it (measured with them in)
    boxFoot: ((b) => new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y, b.max.z))(new THREE.Box3().setFromObject(box)),   // its label hangs below it
    night: { at: 0, to: 0, set: setNight, lights },
    win, winTop: new THREE.Vector3(XL + .05, wy1 + .12, WIN.z),
    sunCheck: { toFloor, XL, T, WIN, wy0, wy1, wz0, wz1 } };        // the window and the sun's path, for the scripted light checks (?probe)
  root.add(outside);                                         // after the bounds and the envMap: unlit, and outside the room
  // the box's contents, each as it arrives, where Blender's rigid-body physics left them (scripts/settle-art.py -> art-layout.json), in the box glb's own frame
  const settle = (o, k, tool) => {
    o.quaternion.set(...layout[k].q); o.position.set(...layout[k].p).add(box.position); art.add(o);
    o.traverse(m => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; m.material = m.material.clone();   // each its own materials (the two tubes too), so one can brighten alone
      m.material.envMap = env; lit.push(m.material); } });
    if (tool) { o.userData.p0 = o.position.clone(); o.userData.up = new THREE.Vector3(0, 1, 0).applyQuaternion(o.quaternion); o.userData.mats = []; o.traverse(m => m.isMesh && o.userData.mats.push(m.material)); tools.push(o); }
    setNight(out.night.at); out.arrived?.();                 // its materials take the time of day; the page redraws (start sets arrived)
  };
  await Promise.all(texLoads);
  out.loadProps = () => {                                    // the box's contents: started once the first frame is up (start), or the moment the box is chosen
    out.loadProps = () => {};
    const later = files.later(), [cup, can, tube, ...brushes] = later;
  cup.then(o => { o.traverse(m => { if (m.isMesh) { m.material.map = null; m.material.color.set('#f2efe8'); } }); settle(o, 'cup'); });   // plain white: the scan carries a noodle brand's print
  tube.then(o => { settle(o, 'tube', true); settle(o.clone(), 'tube-2', true); });
  can.then(o => settle(o, 'spraycan', true));
  brushes.forEach((b, i) => b.then(o => { settle(o, `paintbrush-${i + 1}`, true); if (!i) out.star = o; }));
  for (const f of later) f.catch(err => console.warn('room: a prop is missing', err));
  };
  return out;
}

// the stalk the room floats on: a lift mechanism after the one under ~/Downloads/i-am-error, in my own geometry.
// Hung from the floor's underside at y 0, its front to +z; each part's second number is its depth under the floor, in metres.
// The mechanism sits 60 cm and more down: from the open corner the floor hides whatever is nearer to it
function buildStalk() {
  const metal = (color, roughness) => new THREE.MeshStandardMaterial({ color, metalness: 1, roughness });
  const gun = metal('#3a3d44', .5), steel = metal('#c4c7cc', .35), dark = new THREE.MeshStandardMaterial({ color: '#0d0d0d', roughness: .9 });
  const g = new THREE.Group(), POLE = .156, LEN = 2.8, END = 1.1 + LEN;   // the pole: .156 wide (.12 of the floor), LEN long from 1.1 m down
  const add = (geo, mat, x, depth, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, -depth, z); g.add(m); return m; };
  const cyl = (r, len) => new THREE.CylinderGeometry(r, r, len, 48), box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  add(cyl(.26, 1), gun, 0, .5, 0);                          // hub
  add(cyl(.2, .1), gun, 0, 1.05, 0);                        // collar
  add(cyl(POLE, LEN), steel, 0, 1.1 + LEN / 2, 0);          // the pole: straight
  add(cyl(POLE + .003, .08), dark, 0, END - .04, 0);        // its open end
  add(new THREE.TorusGeometry(.75, .022, 8, 8), gun, 0, .62, 0).rotation.set(Math.PI / 2, 0, Math.PI / 8);   // octagonal ring rail, a flat to the front
  for (const [x, z] of [[.49, .49], [-.49, .49], [.49, -.49], [-.49, -.49]]) { add(box(.04, .62, .04), gun, x, .31, z); add(box(.1, .07, .1), gun, x, .62, z); }   // its hangers and their clamps
  add(box(.32, .36, .26), gun, -.1, .8, .32);               // motor housing
  for (let i = 0; i < 4; i++) add(box(.2, .022, .01), dark, -.1, .68 + i * .05, .452);   // its vent slots
  add(box(.16, .22, .2), gun, .2, .81, .25);                // the smaller block beside it
  add(cyl(.055, .06), gun, .2, .81, .38).rotation.x = Math.PI / 2;   // its cap, where the pipe leaves
  const pipe = new THREE.CatmullRomCurve3([[.2, -.81, .41], [.2, -.84, .52], [.2, -.98, .54], [.16, -1.12, .4], [.1, -1.25, .23], [.08, -1.4, .18], [.08, -(END - .3), .18]].map(p => new THREE.Vector3(...p)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(pipe, 64, .018, 10), gun));   // out of the cap, bending down, then down beside the pole
  add(cyl(.012, END - 1.1), gun, -.12, (1 + END - .1) / 2, .15);   // a thin rod down the other side
  for (const depth of [1.45, 1.1 + LEN * .5, 1.1 + LEN * .82]) add(cyl(.18, .045), gun, 0, depth, 0);   // the clamps that hold both
  return g;
}

// the record shelf: a white 2 x 2 cube shelf (after the one in ~/Downloads/casier-pour-disques, in my own geometry), my Spotify top 40 standing on their
// side, 10 to a cube, and a turntable on top. In metres, its floor centre at the origin, its front to +z
function buildVinyl(tracks, tl, layout) {
  const mat = (color, roughness, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const black = mat('#0d0d0d', .55), steel = mat('#c4c7cc', .3, 1), white = mat('#d2b48c', .55);   // pale oak: white vanishes against the room's white marble
  const grp = new THREE.Group(), top = new THREE.Group(), H = .8, W = .8, D = .39, T = .03;
  const add = (parent, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (r, h) => new THREE.CylinderGeometry(r, r, h, 64);
  for (const x of [-W / 2 + T / 2, 0, W / 2 - T / 2]) add(grp, box(T, H, D), white, x, H / 2, 0);   // sides and the middle wall, then top, middle, bottom, back
  for (const y of [T / 2, H / 2, H - T / 2]) add(grp, box(W, T, D), white, 0, y, 0);
  add(grp, box(W, H, .006), white, 0, H / 2, -D / 2 + .003);
  // the four cubes' insides, open at the front (z1), in the order scripts/settle-records.py fills them: top left, top right, bottom left, bottom right
  const cubes = [[H / 2 + T / 2, H - T], [T, H / 2 - T / 2]].flatMap(([y0, y1]) => [[-W / 2 + T, -T / 2], [T / 2, W / 2 - T]].map(([x0, x1]) => ({ x0, x1, y0, y1, z0: -D / 2 + .006, z1: D / 2, recs: [] })));
  const sleeve = () => box(.314, .314, .004).translate(0, .157, -.002);   // origin on its bottom front edge, where it leans
  grp.add(top);
  const PER = layout.length / 4;                            // records per cube, as scripts/settle-records.py stood them
  const covers = [];
  let coversOn = false;
  const sleeves = tracks.map((t, k) => {
    // the cover printed front and back; the edges and spine in the cover's own average colour, so a stack reads in its covers' colours
    const edge = mat(t.avg ?? '#808080', .7), art = new THREE.MeshStandardMaterial({ roughness: .6 });
    const map = new THREE.Texture();                         // its picture comes in loadCovers(), when the shelf is first zoomed
    map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; art.color.set('#808080');
    covers.push(onLoad => new THREE.ImageLoader().load(new URL(`../${t.cover}`, ASSETS).href, img => {
      map.image = img; map.needsUpdate = true; art.map = map; art.color.set('#fff'); art.needsUpdate = true; onLoad();
    }));
    const s = add(top, sleeve(), [edge, edge, edge, edge, art, art], ...layout[k].p);   // on its side, spine out, where the physics left it
    s.quaternion.set(...layout[k].q);
    s.userData = { i: k, c: k / PER | 0, j: k % PER, art, edge, map, p0: s.position.clone(), q0: s.quaternion.clone(), p: 0 };   // p: how far it is pulled out (stepVinyl)
    cubes[k / PER | 0].recs.push(s);
    return s;
  });
  // the record player, my own geometry after a classic direct-drive deck, at the shelf top's right edge (its side 2 cm in): a walnut plinth on four
  // feet, a brushed aluminium top plate, a platter with strobe dots round its rim and a rubber mat, an S-shaped tonearm on a bearing post with
  // its counterweight, headshell and rest, a pitch slider, and start/stop and 33/45 buttons
  const PW = .44, PD = .35, FOOT = .012, PH = .07, PLATE = .006, TOPY = FOOT + PH + PLATE, PC = [-.06, 0];   // TOPY: the top plate's surface; PC: the platter's centre
  const pl = new THREE.Group(); pl.position.set(W / 2 - .02 - PW / 2, H, 0); top.add(pl);
  const walnut = mat('#5b3a21', .5), alu = mat('#c9ccd1', .32, 1), rubber = mat('#151515', .9), dark = mat('#2a2a2a', .5, .6);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(pl, cyl(.022, FOOT), black, sx * (PW / 2 - .045), FOOT / 2, sz * (PD / 2 - .045));
  add(pl, box(PW, PH, PD), walnut, 0, FOOT + PH / 2, 0);
  add(pl, box(PW - .014, PLATE, PD - .014), alu, 0, FOOT + PH + PLATE / 2, 0);
  const sv = Object.assign(document.createElement('canvas'), { width: 1024, height: 64 }), sg = sv.getContext('2d');   // the platter's rim: rows of strobe dots
  sg.fillStyle = '#b8bbc0'; sg.fillRect(0, 0, 1024, 64); sg.fillStyle = '#5c5f63';
  [[10, 180], [24, 183], [38, 216], [52, 220]].forEach(([y, n]) => { for (let k = 0; k < n; k++) { sg.beginPath(); sg.arc((k + .5) * 1024 / n, y, 2, 0, Math.PI * 2); sg.fill(); } });
  const strobe = new THREE.CanvasTexture(sv); strobe.colorSpace = THREE.SRGBColorSpace; strobe.anisotropy = 8;
  const platter = add(pl, cyl(.152, .018), [new THREE.MeshStandardMaterial({ map: strobe, roughness: .35, metalness: .9 }), alu, alu], PC[0], TOPY + .002 + .009, PC[1]);
  add(platter, cyl(.149, .003), rubber, 0, .0105, 0);       // the mat: the record lands on it
  add(pl, cyl(.004, .024), steel, PC[0], TOPY + .03, PC[1]);   // spindle
  add(pl, box(.012, .002, .09), dark, PW / 2 - .035, TOPY + .001, .07);   // pitch slider, its slot and knob
  add(pl, box(.022, .008, .012), alu, PW / 2 - .035, TOPY + .005, .085);
  add(pl, box(.034, .006, .02), dark, -PW / 2 + .045, TOPY + .003, PD / 2 - .04);   // start/stop, and 33 / 45
  for (const k of [0, 1]) add(pl, cyl(.007, .006), alu, -PW / 2 + .085 + k * .022, TOPY + .003, PD / 2 - .04);
  const disc = new THREE.Group(); disc.visible = false; top.add(disc);
  add(disc, cyl(.15, .003), mat('#0d0d0d', .35), 0, 0, 0);
  const label = add(disc, new THREE.CircleGeometry(.05, 48), new THREE.MeshStandardMaterial({ roughness: .6 }), 0, .0016, 0); label.rotation.x = -Math.PI / 2;
  // tonearm: pivot at the back right, resting toward the front; on the record its stylus drops on the outer groove (14.2 cm out) and tracks in
  // to the run-out (6.2 cm) over the song
  const P = [.16, -.12], L = .24, C = PC, AY = TOPY + .044;   // AY: the arm's height, its cartridge just on a record on the mat
  add(pl, cyl(.026, .012), dark, P[0], TOPY + .006, P[1]);   // the bearing housing, its post and gimbal ring
  add(pl, cyl(.008, AY - TOPY - .01), steel, P[0], (TOPY + AY) / 2, P[1]);
  add(pl, new THREE.TorusGeometry(.011, .0025, 12, 32).rotateX(Math.PI / 2), steel, P[0], AY, P[1]);
  add(pl, cyl(.005, AY - TOPY - .012), steel, P[0] + .012, (TOPY + AY - .012) / 2, P[1] + L - .03);   // the rest and its cradle
  add(pl, box(.016, .004, .008), dark, P[0] + .012, AY - .012, P[1] + L - .03);
  const arm = new THREE.Group(); arm.position.set(P[0], AY, P[1]); pl.add(arm);
  const S = new THREE.CatmullRomCurve3([[0, 0, -.06], [0, 0, 0], [0, 0, .07], [.014, 0, .13], [-.006, 0, .19], [0, 0, L - .015]].map(q => new THREE.Vector3(...q)));
  add(arm, new THREE.TubeGeometry(S, 64, .0032, 10), steel, 0, 0, 0);   // the S-shaped arm, its stub out behind the pivot
  add(arm, cyl(.017, .034).rotateX(Math.PI / 2), dark, 0, 0, -.045);   // counterweight
  add(arm, box(.017, .004, .032).rotateY(-.25), alu, 0, -.004, L);   // headshell, its cartridge and finger lift
  add(arm, box(.012, .012, .018), black, 0, -.012, L);
  add(arm, box(.002, .002, .018).rotateY(.6), alu, .012, -.001, L + .012);
  const swingAt = r => {                                    // the swing that puts the stylus r from the spindle (between the rest and straight at the spindle)
    let lo = Math.atan2(C[0] - P[0], C[1] - P[1]), hi = 0;
    for (let n = 0; n < 30; n++) { const m = (lo + hi) / 2; Math.hypot(P[0] + L * Math.sin(m) - C[0], P[1] + L * Math.cos(m) - C[1]) > r ? hi = m : lo = m; }
    return lo;
  };
  // the display (hover): upright, all turned the same angle from side-on toward you, spread across the cube's width. The angle is the steepest that
  // keeps DISPLAY.margin off the side walls and DISPLAY.gap between neighbours (measured square to them): n - 1 gaps of (gap + 4 mm) / cos(a),
  // plus one sleeve's width across, sin(a) * 31.4 cm (+ its thickness), must fit the cube's width
  for (const c of cubes) {
    const n = c.recs.length, room = c.x1 - c.x0 - 2 * DISPLAY.margin;
    let a = 89 * Math.PI / 180;
    while (a > 0 && (n - 1) * (DISPLAY.gap + .004) / Math.cos(a) + .314 * Math.sin(a) + .004 * Math.cos(a) > room) a -= Math.PI / 360;
    const step = (DISPLAY.gap + .004) / Math.cos(a), x = c.x0 + DISPLAY.margin + .157 * Math.sin(a) + .004 * Math.cos(a), z = (c.z0 + c.z1) / 2;
    c.display = { angle: a, q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 - a), at: c.recs.map((_, j) => new THREE.Vector3(x + j * step, c.y0, z)) };
  }
  return { grp, top, cubes, sleeves, loadCovers: onLoad => { if (!coversOn) { coversOn = true; covers.forEach(f => f(onLoad)); } }, disc, label, platter, arm, swing: swingAt(.142), inner: swingAt(.062), player: pl, on: new THREE.Vector3(pl.position.x + PC[0], H + TOPY + .0245, PC[1]) };
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
