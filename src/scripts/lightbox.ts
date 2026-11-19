/**
 * Visionneuse des galeries (blocks/Lightbox.astro + ProjectGallery.astro).
 * Les vignettes sont des liens vers l'image grand format : sans JS, elles l'ouvrent simplement.
 * Avec JS : clic ⇒ `<dialog>` en `showModal()` (focus piégé et Échap natifs), image chargée à
 * la demande (srcset WebP), légende, précédent / suivant (boutons et flèches ← →), fermeture
 * au clic sur le fond ; le focus revient à la vignette d'origine.
 */
import { onPageReady } from './lifecycle';
import { counterText, wrapIndex } from '@/lib/lightbox';

function enhance(root: HTMLElement, signal: AbortSignal): void {
  const dialog = root.querySelector<HTMLDialogElement>('[data-lightbox]');
  const figure = dialog?.querySelector<HTMLElement>('[data-lightbox-figure]');
  const caption = dialog?.querySelector<HTMLElement>('[data-lightbox-caption]');
  const counter = dialog?.querySelector<HTMLElement>('[data-lightbox-counter]');
  const nav = dialog?.querySelector<HTMLElement>('[data-lightbox-nav]');
  const items = [...root.querySelectorAll<HTMLAnchorElement>('a[data-lightbox-item]')];
  if (!dialog || !figure || !caption || !counter || !nav || items.length === 0) return;
  if (typeof dialog.showModal !== 'function') return;

  // Créée à la première ouverture seulement : rien n'est téléchargé avant.
  const image = document.createElement('img');
  image.decoding = 'async';
  image.addEventListener('load', () => image.removeAttribute('data-loading'), { signal });
  nav.hidden = items.length < 2;
  let current = 0;
  let origin: HTMLAnchorElement | undefined;

  const show = (index: number): void => {
    current = wrapIndex(index, items.length);
    const item = items[current];
    if (!item) return;
    const { srcset = '', width = '', height = '', alt = '' } = item.dataset;
    image.dataset['loading'] = '';
    image.alt = alt;
    image.width = Number(width);
    image.height = Number(height);
    image.sizes = item.dataset['sizes'] ?? '100vw';
    image.srcset = srcset;
    image.src = item.href;
    if (!image.isConnected) figure.prepend(image);
    caption.textContent = item.dataset['caption'] ?? '';
    counter.textContent =
      items.length > 1 ? counterText(current, items.length, dialog.dataset['counter'] ?? '') : '';
  };

  root.addEventListener(
    'click',
    (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest<HTMLAnchorElement>('a[data-lightbox-item]');
      if (!link) return;
      event.preventDefault();
      origin = link;
      show(items.indexOf(link));
      // showModal() rend tout le document inerte (recalcul de style coûteux) : on le diffère
      // après le prochain rendu pour que le clic se peigne aussitôt (INP).
      requestAnimationFrame(() =>
        setTimeout(() => {
          // Deux clics dans la même image, ou page quittée entre-temps : rien à ouvrir.
          if (!signal.aborted && !dialog.open) dialog.showModal();
        }, 0),
      );
    },
    { signal },
  );

  dialog.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      // Le second clic d'un double clic sur la vignette tombe sur le fond de la visionneuse à
      // peine ouverte : il ne doit pas la refermer (les clics rapides sur ← → restent comptés).
      const onBackdrop = target === dialog || target === figure;
      if ((onBackdrop && event.detail < 2) || target?.closest('[data-lightbox-close]')) {
        dialog.close();
        return;
      }
      const step = target?.closest<HTMLElement>('[data-lightbox-step]')?.dataset['lightboxStep'];
      if (step) show(current + Number(step));
    },
    { signal },
  );

  dialog.addEventListener(
    'keydown',
    (event) => {
      if (items.length < 2) return;
      if (event.key === 'ArrowRight') show(current + 1);
      else if (event.key === 'ArrowLeft') show(current - 1);
    },
    { signal },
  );

  dialog.addEventListener('close', () => origin?.focus(), { signal });
  signal.addEventListener('abort', () => dialog.close(), { once: true });
}

onPageReady((signal) => {
  for (const root of document.querySelectorAll<HTMLElement>('[data-lightbox-gallery]')) {
    enhance(root, signal);
  }
});
