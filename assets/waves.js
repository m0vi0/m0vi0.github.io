// Hero backdrop: vertical lines bent by a simplex noise field and pushed along by the cursor, drawn behind the rack (port of the Waves component, minus its pointer dot).
// Canvas instead of SVG: ~200 lines × ~110 points rewritten every frame is cheaper as one stroke pass.
import { createNoise2D } from 'simplex-noise';

const canvas = document.querySelector('.waves');
const ctx = canvas?.getContext('2d');
if (ctx) {
  const noise = createNoise2D(), GAP = 8;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;          // phones: no cursor to follow, so half the frame rate is enough
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--black').trim() || '#0D0D0D';
  let lines = [], W = 0, H = 0, raf = 0, visible = true;
  const mouse = { x: -10, y: 0, lx: 0, ly: 0, sx: 0, sy: 0, vs: 0, a: 0, set: false };

  function setLines() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = Math.ceil((W + 200) / GAP), rows = Math.ceil((H + 30) / GAP);
    const x0 = (W - GAP * cols) / 2, y0 = (H - GAP * rows) / 2;
    lines = Array.from({ length: cols }, (_, i) => Array.from({ length: rows }, (_, j) => ({ x: x0 + GAP * i, y: y0 + GAP * j, cx: 0, cy: 0, vx: 0, vy: 0 })));
  }

  function draw(t) {
    // smoothed cursor and its speed, as in the original tick()
    mouse.sx += (mouse.x - mouse.sx) * .1; mouse.sy += (mouse.y - mouse.sy) * .1;
    const dx = mouse.x - mouse.lx, dy = mouse.y - mouse.ly;
    mouse.vs = Math.min(100, mouse.vs + (Math.hypot(dx, dy) - mouse.vs) * .1);
    mouse.lx = mouse.x; mouse.ly = mouse.y; mouse.a = Math.atan2(dy, dx);
    const l = Math.max(175, mouse.vs);
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    for (const pts of lines) pts.forEach((p, j) => {
      const m = noise((p.x + t * .008) * .003, (p.y + t * .003) * .002) * 8;
      const d = Math.hypot(p.x - mouse.sx, p.y - mouse.sy);
      if (d < l) {                                          // the cursor drags nearby points along its direction of travel
        const f = Math.cos(d * .001) * (1 - d / l) * l * mouse.vs * .00035;
        p.vx += Math.cos(mouse.a) * f; p.vy += Math.sin(mouse.a) * f;
      }
      p.vx = (p.vx - p.cx * .01) * .95; p.vy = (p.vy - p.cy * .01) * .95;   // spring back, damped
      p.cx = Math.min(50, Math.max(-50, p.cx + p.vx)); p.cy = Math.min(50, Math.max(-50, p.cy + p.vy));
      const px = p.x + Math.cos(m) * 12, py = p.y + Math.sin(m) * 6;
      j ? ctx.lineTo(px + p.cx, py + p.cy) : ctx.moveTo(px, py);
    });
    ctx.strokeStyle = ink; ctx.globalAlpha = .22; ctx.lineWidth = 1; ctx.stroke();   // faint: full black drowns the name and copy
  }

  let odd = false;
  const tick = t => { if (!coarse || (odd = !odd)) draw(t); raf = requestAnimationFrame(tick); };
  function wake() {
    cancelAnimationFrame(raf); raf = 0;
    if (reduce) draw(0); else if (visible && !document.hidden) raf = requestAnimationFrame(tick);
  }

  new ResizeObserver(() => { setLines(); if (!raf) draw(performance.now()); }).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); }).observe(canvas);
  document.addEventListener('visibilitychange', wake);
  addEventListener('pointermove', e => {                    // canvas ignores pointer events, so listen on the window
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    if (!mouse.set) { mouse.sx = mouse.lx = mouse.x; mouse.sy = mouse.ly = mouse.y; mouse.set = true; }
  }, { passive: true });
}
