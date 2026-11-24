/**
 * Cycle de vie des scripts client (ADR-0006).
 * Sans ClientRouter, chaque script s'exécute une fois par chargement de page : `init` est lancée
 * tout de suite. Les écouteurs `astro:page-load` / `astro:before-swap` gardent le code compatible
 * avec un éventuel retour du routeur client : chaque ré-exécution coupe la précédente via
 * l'`AbortSignal` (à passer à `addEventListener(…, { signal })` et aux observers).
 */
export function onPageReady(init: (signal: AbortSignal) => void): void {
  let controller: AbortController | undefined;

  const start = (): void => {
    controller?.abort();
    controller = new AbortController();
    init(controller.signal);
  };

  start();
  document.addEventListener('astro:page-load', start);
  document.addEventListener('astro:before-swap', () => controller?.abort());
}
