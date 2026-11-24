/**
 * Bandeau de mots (Marquee.astro) : bouton pause / lecture (WCAG 2.2.2) et mise en pause hors
 * écran (IntersectionObserver : aucune animation inutile). Le défilement lui-même est en CSS ;
 * le bouton n'est affiché que s'il défile (`html.js`, sans mouvement réduit).
 */
import { onPageReady } from './lifecycle';

onPageReady((signal) => {
  const roots = [...document.querySelectorAll<HTMLElement>('[data-marquee]')];
  if (roots.length === 0) return;

  const observer =
    'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => {
          for (const entry of entries) {
            (entry.target as HTMLElement).toggleAttribute('data-offscreen', !entry.isIntersecting);
          }
        })
      : undefined;

  for (const root of roots) {
    observer?.observe(root);
    const toggle = root.querySelector<HTMLButtonElement>('[data-marquee-toggle]');
    const label = toggle?.querySelector<HTMLElement>('[data-marquee-label]');
    if (!toggle || !label) continue;

    toggle.addEventListener(
      'click',
      () => {
        const paused = root.toggleAttribute('data-paused');
        label.textContent =
          (paused ? toggle.dataset['labelPlay'] : toggle.dataset['labelPause']) ?? '';
      },
      { signal },
    );
  }

  signal.addEventListener('abort', () => observer?.disconnect(), { once: true });
});
