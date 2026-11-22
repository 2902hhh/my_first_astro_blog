export const themeStorageKey = 'dinghuan.blog.theme';
type Theme = 'light' | 'dark';

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

let transition: ViewTransition | undefined;
let revision = 0;
type Reveal = { x: number; y: number; radii: number[]; duration: number };

export function applyTheme(theme: Theme, reveal?: Reveal) {
  const request = ++revision;
  transition?.skipTransition();
  transition = undefined;
  const root = document.documentElement;
  delete root.dataset.themeReveal;
  if (currentTheme() === theme) return;

  const update = () => {
    if (request === revision) root.dataset.theme = theme;
  };
  if (!reveal || !document.startViewTransition) {
    update();
    return;
  }

  root.dataset.themeReveal = theme;
  const next = document.startViewTransition(update);
  transition = next;
  const clearReveal = () => {
    if (transition !== next) return;
    transition = undefined;
    delete root.dataset.themeReveal;
  };
  void next.finished.then(clearReveal, clearReveal);
  void next.ready.then(() => {
    if (transition !== next) return;
    const { x, y, radii, duration } = reveal;
    const frames = radii.map(radius => ({ clipPath: `circle(${radius}px at ${x}px ${y}px)` }));
    root.animate(frames, {
      duration,
      fill: 'both',
      pseudoElement: theme === 'dark' ? '::view-transition-old(root)' : '::view-transition-new(root)',
    });
  }).catch(() => next.skipTransition());
}

export function saveTheme(theme: Theme) {
  try { localStorage.setItem(themeStorageKey, theme); } catch { /* The current page can still switch. */ }
}
