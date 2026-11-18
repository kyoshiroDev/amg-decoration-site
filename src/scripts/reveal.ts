/**
 * Apparitions au scroll (docs/DESIGN-SYSTEM.md §5, effets 1 et 2) sur `[data-reveal]`.
 * - Rien sans IntersectionObserver ni en mouvement réduit : le contenu reste tel quel.
 * - Seuls les éléments encore SOUS la ligne de flottaison sont préparés (`pending`) : rien de
 *   ce qui est déjà à l'écran ne disparaît (aucun clignotement, LCP intact).
 * - Déclenchement à 15 % de visibilité, une seule fois ; les éléments entrés ensemble
 *   apparaissent en cascade (`--reveal-order` × `--stagger`), puis l'état est retiré.
 * transform, opacity et clip-path uniquement (src/styles/motion.css) : aucun décalage (CLS).
 */
import { onPageReady } from './lifecycle';

const THRESHOLD = 0.15;
/** Au-delà, les éléments d'un même lot apparaissent ensemble (cascade bornée). */
const MAX_ORDER = 5;

onPageReady((signal) => {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const fold = window.innerHeight;
  const targets = [...document.querySelectorAll<HTMLElement>('[data-reveal]')].filter(
    (element) => !element.dataset['revealState'] && element.getBoundingClientRect().top > fold,
  );
  if (targets.length === 0) return;

  // Fin de l'apparition : opacité (texte, cartes) ou masque de l'image (image reveal).
  const settle = (event: TransitionEvent): void => {
    const element = event.currentTarget;
    if (!(element instanceof HTMLElement)) return;
    if (event.propertyName !== 'opacity' && event.propertyName !== 'clip-path') return;
    delete element.dataset['revealState'];
    element.style.removeProperty('--reveal-order');
  };

  const observer = new IntersectionObserver(
    (entries) => {
      let order = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        observer.unobserve(element);
        element.style.setProperty('--reveal-order', String(Math.min(order, MAX_ORDER)));
        element.addEventListener('transitionend', settle, { signal });
        element.dataset['revealState'] = 'in';
        order += 1;
      }
    },
    { threshold: THRESHOLD },
  );

  for (const element of targets) {
    element.dataset['revealState'] = 'pending';
    observer.observe(element);
  }

  signal.addEventListener(
    'abort',
    () => {
      observer.disconnect();
      for (const element of targets) delete element.dataset['revealState'];
    },
    { once: true },
  );
});
