/**
 * Jeu d'icônes du site : noms et tracés SVG (grille 24×24, trait 1.5, currentColor).
 * Formes des marques sociales simplifiées. Consommé par Icon.astro.
 */
export const iconNames = [
  'arrow-right',
  'external',
  'phone',
  'mail',
  'whatsapp',
  'instagram',
  'facebook',
  'pinterest',
  'linkedin',
  'menu',
  'close',
  'plus',
] as const;

export type IconName = (typeof iconNames)[number];

// Chemins dessinés sur une grille 24×24 ; formes simplifiées des marques sociales.
export const iconPaths: Record<IconName, string> = {
  'arrow-right': '<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>',
  // Flèche oblique : lien qui s'ouvre dans un nouvel onglet (indice visuel, toujours décoratif).
  external: '<path d="M8 16 17 7"/><path d="M9.5 7H17v7.5"/>',
  phone:
    '<path d="M5 3.5h3.2l1.6 4.2-2.1 1.4a11 11 0 0 0 7.2 7.2l1.4-2.1 4.2 1.6V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.1 1.5 1.5 0 0 1 5 3.5Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>',
  whatsapp:
    '<path d="M4.2 19.8 5.3 16A8.5 8.5 0 1 1 8.4 19l-4.2.8Z"/><path d="M9.2 8.6c.3-.6.9-.6 1.2 0l.6 1.4c.1.3 0 .6-.2.8l-.5.5a5.6 5.6 0 0 0 2.4 2.4l.5-.5c.2-.2.5-.3.8-.2l1.4.6c.6.3.6.9 0 1.2-.8.5-1.8.7-2.8.3a8 8 0 0 1-3.9-3.9c-.4-1-.2-2 .5-2.6Z"/>',
  instagram:
    '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.8"/><circle cx="17.2" cy="6.8" r=".6" fill="currentColor"/>',
  facebook:
    '<path d="M14 21v-7.5h2.6l.4-3H14V8.7c0-.9.3-1.5 1.6-1.5H17V4.5a19 19 0 0 0-2.3-.1c-2.3 0-3.8 1.4-3.8 3.9v2.2H8.3v3h2.6V21"/>',
  pinterest:
    '<circle cx="12" cy="12" r="8.5"/><path d="M11.2 9.5c-.6 2.6-1.8 7.6-2.4 10.2"/><path d="M10.4 13.3c.5.9 1.4 1.4 2.5 1.4 2.3 0 3.8-2.1 3.8-4.6 0-2.4-2-4.1-4.6-4.1-3 0-4.7 2.1-4.7 4.3 0 1 .4 2 1.2 2.4"/>',
  linkedin:
    '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 10.5V16"/><circle cx="8" cy="7.8" r=".6" fill="currentColor"/><path d="M11.5 16v-5.5"/><path d="M11.5 13c0-1.5 1-2.6 2.4-2.6s2.1.9 2.1 2.5V16"/>',
  menu: '<path d="M4 8h16"/><path d="M4 16h16"/>',
  close: '<path d="m6 6 12 12"/><path d="M18 6 6 18"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
};
