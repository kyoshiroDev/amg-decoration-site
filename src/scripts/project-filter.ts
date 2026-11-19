/**
 * Filtres de la page Réalisations (amélioration progressive, voir ProjectFilters.astro).
 * Active la barre de filtres (affichée sous `html.js`, ADR-0010), masque (`hidden`) les projets
 * d'un autre type de pièce, tient `aria-pressed` à jour et annonce le nombre de projets affichés
 * (`role="status"`).
 * Sans JS : barre absente, grille complète.
 */
import { onPageReady } from './lifecycle';

onPageReady((signal) => {
  const root = document.querySelector<HTMLElement>('[data-project-filters]');
  const status = root?.querySelector<HTMLElement>('[data-filter-status]');
  const items = [...document.querySelectorAll<HTMLElement>('[data-project-rooms]')];
  if (!root || !status || items.length === 0) return;

  const buttons = [...root.querySelectorAll<HTMLButtonElement>('button[data-filter]')];

  const apply = (value: string): void => {
    let count = 0;
    for (const item of items) {
      const rooms = (item.dataset['projectRooms'] ?? '').split(' ');
      const visible = value === '' || rooms.includes(value);
      item.hidden = !visible;
      if (visible) count += 1;
    }
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset['filter'] === value));
    }
    const template = (count === 1 ? status.dataset['one'] : status.dataset['other']) ?? '';
    status.textContent = template.replace('{count}', String(count));
  };

  root.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest<HTMLButtonElement>('button[data-filter]');
      if (button) apply(button.dataset['filter'] ?? '');
    },
    { signal },
  );

  signal.addEventListener(
    'abort',
    () => {
      apply('');
    },
    { once: true },
  );
});
