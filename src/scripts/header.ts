/**
 * En-tête : bascule `data-compact` quand le repère placé à `--header-compact-threshold`
 * (80 px) sort du haut de l'écran. Un IntersectionObserver, aucun écouteur de scroll.
 * Sans JS (ou sans support), l'en-tête garde son fond lisible (voir Header.astro).
 */
import { onPageReady } from './lifecycle';

onPageReady((signal) => {
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  const sentinel = document.querySelector<HTMLElement>('[data-header-sentinel]');
  if (!header || !sentinel || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(([entry]) => {
    if (!entry) return;
    const passed = !entry.isIntersecting && entry.boundingClientRect.top < 0;
    header.dataset['compact'] = String(passed);
  });

  observer.observe(sentinel);
  signal.addEventListener('abort', () => observer.disconnect(), { once: true });
});
