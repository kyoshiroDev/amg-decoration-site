/**
 * Apparitions au scroll (docs/DESIGN-SYSTEM.md §5, effets 1 et 2 ; ADR-0013) sur `[data-reveal]`.
 * - Rien en mouvement réduit : le contenu reste tel quel.
 * - Seuls les blocs encore SOUS la ligne de flottaison sont préparés : rien de ce qui est déjà
 *   à l'écran ne disparaît (aucun clignotement, LCP intact), ni le bloc visé par l'ancre.
 * - Navigateurs qui gèrent `animation-timeline: view()` : état `scroll`, l'apparition suit le
 *   défilement, entièrement en CSS et sur le compositeur (src/styles/motion.css). Aucun
 *   observateur, aucun changement d'état ensuite : c'est ce qui la rend presque gratuite.
 * - Sinon (et toujours pour l'image reveal) : `pending`, puis `in` quand le haut du bloc
 *   franchit 90 % de la fenêtre (IntersectionObserver, une fois), animation CSS, état retiré
 *   au premier `animationend`. Une liste (`data-reveal="list"`) est un seul bloc : la cascade
 *   de ses enfants est portée par le CSS, sans observateur ni délai par enfant.
 * - Focus clavier (WCAG 2.4.7, 2.4.11) : un bloc préparé qui reçoit le focus (lui ou un
 *   descendant) est révélé immédiatement, sans animation ; motion.css le rend visible dès la
 *   première image via `:focus-within`.
 * transform, opacity et clip-path uniquement : aucun décalage (CLS).
 */
import { onPageReady } from './lifecycle';

/** Bande basse ignorée : le bloc apparaît une fois réellement entré dans la page. */
const ROOT_MARGIN = '0px 0px -10% 0px';

onPageReady((signal) => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const scrollDriven = CSS.supports('animation-timeline: view()');
  const observable = 'IntersectionObserver' in window;

  const fold = window.innerHeight;
  // Ancre de l'URL (#avantages-titre) : le navigateur y défile souvent APRÈS ce script. Son
  // bloc ne doit pas être décalé (translateY) à ce moment-là, sinon le défilement vise la
  // position décalée et le surtitre finit sous l'en-tête collant.
  const anchor = window.location.hash
    ? document.getElementById(decodeURIComponent(window.location.hash.slice(1)))
    : null;
  const targets = [...document.querySelectorAll<HTMLElement>('[data-reveal]')].filter(
    (element) =>
      !element.dataset['revealState'] &&
      element.getBoundingClientRect().top > fold &&
      !(anchor && (element.contains(anchor) || anchor.contains(element))) &&
      ((scrollDriven && element.dataset['reveal'] !== 'image') || observable),
  );
  if (targets.length === 0) return;

  const settle = (element: HTMLElement): void => {
    delete element.dataset['revealState'];
  };

  // Les animations d'un bloc (ou de tous les enfants d'une liste) finissent ensemble : le
  // premier `animationend` remonté marque la fin du bloc entier.
  const onAnimationEnd = (event: AnimationEvent): void => {
    if (!event.animationName.startsWith('reveal-')) return;
    if (event.currentTarget instanceof HTMLElement) settle(event.currentTarget);
  };

  const observer = observable
    ? new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const element = entry.target as HTMLElement;
            observer?.unobserve(element);
            element.dataset['revealState'] = 'in';
          }
        },
        { rootMargin: ROOT_MARGIN },
      )
    : undefined;

  for (const element of targets) {
    if (scrollDriven && element.dataset['reveal'] !== 'image') {
      element.dataset['revealState'] = 'scroll';
      continue;
    }
    element.dataset['revealState'] = 'pending';
    element.addEventListener('animationend', onAnimationEnd, { signal });
    element.addEventListener('animationcancel', onAnimationEnd, { signal });
    observer?.observe(element);
  }

  // Focus clavier dans un bloc préparé : affichage immédiat, sans attendre le défilement,
  // IntersectionObserver ni l'animation (le focus ne doit jamais être invisible).
  const showNow = (element: HTMLElement): void => {
    observer?.unobserve(element);
    settle(element);
  };
  document.addEventListener(
    'focusin',
    (event) => {
      if (!(event.target instanceof Element)) return;
      // Ancêtres (carte, liste) et descendants (image reveal dans un lien de galerie).
      const pending = [...event.target.querySelectorAll<HTMLElement>('[data-reveal-state]')];
      for (let node = event.target.closest<HTMLElement>('[data-reveal-state]'); node;) {
        pending.push(node);
        node = node.parentElement?.closest<HTMLElement>('[data-reveal-state]') ?? null;
      }
      for (const element of pending) showNow(element);
    },
    { signal },
  );

  signal.addEventListener(
    'abort',
    () => {
      observer?.disconnect();
      for (const element of targets) settle(element);
    },
    { once: true },
  );
});
