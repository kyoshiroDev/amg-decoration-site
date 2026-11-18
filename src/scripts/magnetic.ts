/**
 * CTA magnétique léger (`[data-magnetic]`) : le bouton glisse d'au plus `--magnetic-max`
 * (6 px) vers le pointeur, puis revient au repos quand il s'en va. Pointeur fin uniquement et
 * jamais en mouvement réduit. transform seul (via `--magnet-x/y`, button.css) : la cible de clic
 * suit le bouton, le focus et le clic ne sont pas affectés.
 */
import { onPageReady } from './lifecycle';
import { magneticOffset } from '@/lib/magnetic';

const QUERY = '(pointer: fine) and (prefers-reduced-motion: no-preference)';

onPageReady((signal) => {
  if (!window.matchMedia(QUERY).matches) return;
  const elements = [...document.querySelectorAll<HTMLElement>('[data-magnetic]')];
  if (elements.length === 0) return;
  const max = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--magnetic-max'),
  );

  for (const element of elements) {
    let frame = 0;
    const reset = (): void => {
      cancelAnimationFrame(frame);
      element.style.removeProperty('--magnet-x');
      element.style.removeProperty('--magnet-y');
    };

    element.addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
        const { clientX, clientY } = event;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          // Boîte au repos : on retire la translation affichée (transition comprise), sinon
          // le bouton « fuirait » le pointeur.
          const box = element.getBoundingClientRect();
          const shift = new DOMMatrixReadOnly(getComputedStyle(element).transform);
          const rest = {
            left: box.left - shift.m41,
            top: box.top - shift.m42,
            width: box.width,
            height: box.height,
          };
          const offset = magneticOffset(clientX, clientY, rest, max);
          element.style.setProperty('--magnet-x', `${offset.x}px`);
          element.style.setProperty('--magnet-y', `${offset.y}px`);
        });
      },
      { signal },
    );
    element.addEventListener('pointerleave', reset, { signal });
    signal.addEventListener('abort', reset, { once: true });
  }
});
