# Architecture

> Tenue à jour par l'agent `architecte`. L'arborescence de référence et les règles sont dans `CLAUDE.md` §3 ; ce document détaille le **pourquoi** et les flux.

## Principes

1. **Statique d'abord** : tout est pré-rendu au build. Zéro serveur, zéro base de données.
2. **Contenu séparé du code** : les textes vivent dans `src/content/` (Markdown/YAML validés par Zod) ; les infos de l'entreprise dans `src/config/site.ts`.
3. **Couches** : `pages` (routes) → `layouts` (squelette + SEO) → `blocks` (sections) → `ui` (atomes). `lib/` est transverse et pur.
4. **Progressive enhancement** : le HTML/CSS fonctionne seul ; le JS (`src/scripts/`) n'ajoute que de l'agrément.

## Flux de données

```
src/config/site.ts ──┐
                     ├──> layouts/BaseLayout.astro ──> components/seo/SEO.astro + JsonLd.astro
src/lib/jsonld.ts ───┘                │
                                      ▼
src/content/** ──(getCollection)──> pages/*.astro ──> components/blocks/* ──> components/ui/*
       ▲
src/content.config.ts (schémas Zod 4)
```

## Collections de contenu (cible)

| Collection    | Loader                                 | Champs clés                                                                                                                                                                                         |
| ------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projets`     | `glob('src/content/projets/*.md')`     | title, slug, summary, location, roomTypes (enum), style, cover (`image()`), gallery[{image, alt, kind: `'avant' \| '3d' \| 'apres'`}], beforeAfter?, featured, publishedAt, seo{title, description} |
| `prestations` | `glob`                                 | title, formula (enum Essentiel/Confort/Signature/Studio), target, includes[], deliverables[], price? (optionnel, masqué si absent), order                                                           |
| `articles`    | `glob('**/*.mdx')`                     | title, description, publishedAt, updatedAt?, cover, tags[], relatedService, relatedProject, draft                                                                                                   |
| `temoignages` | `file('src/content/temoignages.yaml')` | author, text, source ('google'), projectType?, url?                                                                                                                                                 |
| `faq`         | `file('src/content/faq.yaml')`         | question, answer, page                                                                                                                                                                              |

## Scripts client

Chaque fichier de `src/scripts/` exporte une fonction `init()` idempotente, attachée à `astro:page-load` (compatibilité View Transitions), et nettoie ses listeners sur `astro:before-swap`.

## Configuration

- `astro.config.mjs` : `site: 'https://amgdecorationdinterieur.com'`, `trailingSlash: 'always'`, `output: 'static'`, intégrations `sitemap` (+ `mdx`), `prefetch`, Fonts API, `image` (formats/qualités).
- `vercel.json` : redirections 301, en-têtes de sécurité (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`), cache immuable `/_astro/*`.
- `tsconfig.json` : `astro/tsconfigs/strictest` + alias `@/*`.

## Déploiement

GitHub → Vercel : chaque push sur `dev` = preview ; merge dans `main` (humain) = production. La CI GitHub Actions (`.github/workflows/ci.yml`) doit être verte avant tout merge.
