export function getTheme() { try { return localStorage.getItem('vs_theme') || 'light'; } catch { return 'light'; } }
export function applyTheme(mode) {
  if (typeof document === 'undefined') return;
  const dark = mode === 'dark' || (mode === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', !!dark);
}
export function setTheme(mode) { try { localStorage.setItem('vs_theme', mode); } catch {} applyTheme(mode); }
