/**
 * Menu mobile (Popover API) — amélioration progressive uniquement : sans ce script, le popover
 * fonctionne déjà (ouverture, Échap, clic extérieur, retour du focus au bouton).
 * Ajouts : focus sur le premier élément à l'ouverture, fermeture quand le focus quitte le
 * panneau (Tab après le dernier élément, Maj+Tab depuis le premier), et fermeture au clic sur
 * un lien (utile pour les ancres de la même page).
 * Panneau NON modal (navigation, pas dialogue) : pas de piège ni d'`inert`, mais le panneau ne
 * reste jamais ouvert quand le focus est ailleurs (il masquerait l'élément focalisé, WCAG 2.4.11).
 */
import { onPageReady } from './lifecycle';

const FOCUSABLE = 'a[href], button:not([disabled])';

onPageReady((signal) => {
  const panel = document.querySelector<HTMLElement>('[data-mobile-nav]');
  if (!panel || typeof panel.hidePopover !== 'function') return;

  const toggle = document.querySelector<HTMLElement>(`[popovertarget="${panel.id}"]`);
  const isOpen = (): boolean => panel.matches(':popover-open');
  const close = (): void => {
    if (isOpen()) panel.hidePopover();
  };

  panel.addEventListener(
    'toggle',
    () => {
      if (isOpen()) panel.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    },
    { signal },
  );

  // Maj+Tab depuis le premier élément : on referme (comme Échap) et le focus revient au bouton
  // d'ouverture, au lieu de s'y poser caché sous le panneau resté ouvert.
  panel.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Tab' || !event.shiftKey) return;
      if (document.activeElement !== panel.querySelector(FOCUSABLE)) return;
      event.preventDefault();
      close();
      if (toggle && document.activeElement !== toggle) toggle.focus();
    },
    { signal },
  );

  panel.addEventListener(
    'focusout',
    (event) => {
      const next = event.relatedTarget;
      // Focus perdu sans destination (changement d'onglet, clic sur une zone inerte) : on garde.
      if (!(next instanceof Element) || panel.contains(next)) return;
      // Clic sur le bouton d'ouverture : il referme lui-même le panneau, ne pas le rouvrir aussitôt.
      if (next === toggle) return;
      close();
    },
    { signal },
  );

  panel.addEventListener(
    'click',
    (event) => {
      if (event.target instanceof Element && event.target.closest('a[href]')) close();
    },
    { signal },
  );
});
