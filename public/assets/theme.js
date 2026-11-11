// The site's theme: <html data-theme="light|dark">, from the visitor's choice (saved in this browser) or else their system's, set before
// the CSS paints. Every [data-theme-toggle] button flips it (the room's window blinds press the same button); rack.js watches the attribute.
(() => {
  const root = document.documentElement, os = matchMedia('(prefers-color-scheme: light)');
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch {}
  const set = t => {
    root.dataset.theme = t;
    const meta = document.querySelector('meta[name="theme-color"][data-themed]');   // the browser's bar: the page's colour (the home page's yellow by day)
    meta?.setAttribute('content', t === 'light' ? meta.dataset.light ?? '#F5F0E8' : '#0D0D0D');
    for (const b of document.querySelectorAll('[data-theme-toggle]')) b.setAttribute('aria-label', t === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
  };
  set(saved === 'light' || saved === 'dark' ? saved : os.matches ? 'light' : 'dark');
  os.addEventListener('change', e => { if (!saved) set(e.matches ? 'light' : 'dark'); });   // follows the system until a choice is made
  let fading = 0;
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-theme-toggle]')) return;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {   // the page's colours take the room's 3 s to change (style.css .theme-fading)
      root.classList.add('theme-fading'); clearTimeout(fading); fading = setTimeout(() => root.classList.remove('theme-fading'), 3000);
    }
    saved = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('theme', saved); } catch {}
    set(saved);
  });
  document.addEventListener('DOMContentLoaded', () => set(root.dataset.theme));   // the buttons' labels, now that they exist
})();
