// Configuration Stylelint — CSS natif moderne (@layer, nesting, container queries).
/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard', 'stylelint-config-html/astro'],
  rules: {
    // Les couleurs hexadécimales ne sont autorisées que dans tokens.css (CLAUDE.md §4).
    'color-no-hex': true,
    'selector-class-pattern': [
      '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:__[a-z0-9]+(?:-[a-z0-9]+)*)?(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$',
      { message: 'Classes en kebab-case (BEM léger autorisé : bloc__element--modificateur).' },
    ],
  },
  overrides: [
    {
      files: ['src/styles/tokens.css'],
      rules: { 'color-no-hex': null },
    },
  ],
};
