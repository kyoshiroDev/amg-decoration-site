/**
 * Comparateur « Rendu 3D ↔ Réalisé » (blocks/BeforeAfter.astro).
 * - Clavier : natif (`<input type="range">` : flèches, Page précédente/suivante, Début/Fin) ;
 *   le script répercute la valeur (`--compare-pos`) et tient `aria-valuetext` à jour.
 * - Souris / stylet : glisser n'importe où sur la scène (capture du pointeur).
 * - Tactile : la scène est en `touch-action: pan-y` ; un geste surtout horizontal règle le
 *   curseur, un geste vertical fait défiler la page (le navigateur annule alors le pointeur).
 *   Un simple appui place la poignée.
 */
import { onPageReady } from './lifecycle';
import { clampPercent, compareValueText, positionFromPointer } from '@/lib/before-after';

/** Déplacement (px) au-delà duquel un geste tactile est un glisser et non un appui. */
const TOUCH_SLOP = 6;

function enhance(root: HTMLElement, signal: AbortSignal): void {
  const stage = root.querySelector<HTMLElement>('[data-before-after-stage]');
  const range = root.querySelector<HTMLInputElement>('[data-before-after-range]');
  if (!stage || !range) return;
  const template = range.dataset['valueText'] ?? '';

  const render = (value: number): void => {
    const percent = clampPercent(value);
    range.value = String(percent);
    range.setAttribute('aria-valuetext', compareValueText(percent, template));
    root.style.setProperty('--compare-pos', `${percent}%`);
  };

  // Glisser : la boîte de la scène est mesurée une fois par geste et seule `--compare-pos` est
  // écrite, au plus une fois par image (rAF). La valeur du range et `aria-valuetext` sont
  // validées en fin de geste (commit) : pas de layout forcé à chaque pointermove.
  let box: DOMRect | undefined;
  let frame = 0;
  let lastX = 0;
  let moved = false;
  const paint = (value: number): void => {
    root.style.setProperty('--compare-pos', `${clampPercent(value)}%`);
  };

  const fromPointer = (clientX: number): void => {
    lastX = clientX;
    moved = true;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      box ??= stage.getBoundingClientRect();
      paint(positionFromPointer(lastX, box.left, box.width));
    });
  };

  const commit = (): void => {
    cancelAnimationFrame(frame);
    frame = 0;
    if (moved) {
      box ??= stage.getBoundingClientRect();
      render(positionFromPointer(lastX, box.left, box.width));
    }
    moved = false;
    box = undefined;
  };

  let pointerId: number | undefined;
  let startX = 0;
  let startY = 0;
  let dragging = false;

  const stop = (): void => {
    commit();
    pointerId = undefined;
    dragging = false;
    delete root.dataset['dragging'];
  };

  stage.addEventListener(
    'pointerdown',
    (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      if (event.pointerType === 'touch') return;
      // Souris : pas de glisser natif de l'image ni de sélection de texte.
      event.preventDefault();
      range.focus({ preventScroll: true });
      stage.setPointerCapture(event.pointerId);
      dragging = true;
      root.dataset['dragging'] = '';
      fromPointer(event.clientX);
    },
    { signal },
  );

  stage.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerId !== pointerId) return;
      if (!dragging) {
        const dx = Math.abs(event.clientX - startX);
        if (dx < TOUCH_SLOP || dx < Math.abs(event.clientY - startY)) return;
        dragging = true;
        root.dataset['dragging'] = '';
        stage.setPointerCapture(event.pointerId);
      }
      fromPointer(event.clientX);
    },
    { signal },
  );

  stage.addEventListener(
    'pointerup',
    (event) => {
      if (event.pointerId !== pointerId) return;
      // Appui tactile bref : la poignée vient sous le doigt (avec la transition courte).
      if (!dragging) fromPointer(event.clientX);
      stop();
    },
    { signal },
  );
  stage.addEventListener('pointercancel', stop, { signal });

  range.addEventListener('input', () => render(Number(range.value)), { signal });
  signal.addEventListener('abort', () => cancelAnimationFrame(frame), { once: true });
  render(Number(range.value));
}

onPageReady((signal) => {
  for (const root of document.querySelectorAll<HTMLElement>('[data-before-after]')) {
    enhance(root, signal);
  }
});
