// Footer hover: scrambled letters under a cursor spotlight (port of the Evervault card; CSS does the mask and the fade).
const footer = document.querySelector('.footer'), chars = footer?.querySelector('.ever-chars');
if (chars) {
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let size = 0, queued = false;
  const fill = () => { let s = ''; for (let i = 0; i < size; i++) s += ABC[Math.random() * ABC.length | 0]; chars.textContent = s; queued = false; };
  // enough characters to cover the footer: its area over one ~7×16px monospace cell
  new ResizeObserver(() => { size = Math.ceil(footer.clientWidth * footer.clientHeight / (7 * 16) * 1.2); fill(); }).observe(footer);
  footer.addEventListener('pointermove', e => {
    const r = footer.getBoundingClientRect();
    footer.style.setProperty('--x', e.clientX - r.left + 'px'); footer.style.setProperty('--y', e.clientY - r.top + 'px');
    if (!reduce && !queued) { queued = true; requestAnimationFrame(fill); }
  });
}
