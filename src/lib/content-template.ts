/**
 * Gabarit des corps Markdown (`.md`) : jetons `{email}` remplacés par les valeurs de
 * src/config/site.ts et blocs propres au mode du formulaire de contact, appliqués au source
 * avant le rendu par le plugin Sätteri `contentTemplatePlugin` (astro.config.mjs, ADR-0016).
 *
 *   Écrivez-moi à [{email}](mailto:{email}).
 *
 *   {formulaire:service}
 *   Paragraphe affiché seulement si `PUBLIC_FORM_ENDPOINT` est défini.
 *   {/formulaire}
 *
 * Fonctions PURES (tests/unit/content-template.test.ts) ; le plugin n'importe que des types.
 * Sans alias d'import : chargé avant la configuration de Vite.
 */
import type { MdastPluginDefinition } from 'satteri';
import type { FormTarget } from './contact-form';
import type { SiteConfig } from '../config/site';

export type FormMode = FormTarget['kind'];
export type TemplateVariables = Readonly<Record<string, string>>;

export interface ContentTemplateContext {
  readonly variables: TemplateVariables;
  readonly formMode: FormMode;
}

const FORM_MODES: readonly string[] = ['service', 'mailto'] satisfies FormMode[];
/** `{email}`, `{phoneE164}` : un identifiant entre accolades. */
const TOKEN = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g;
/** Bloc conditionnel, marqueurs seuls sur leur ligne. */
const BLOCK_OPEN = /^\{formulaire:([^}]*)\}$/;
const BLOCK_CLOSE = '{/formulaire}';

/** Valeurs injectées dans les corps Markdown (pages légales notamment). */
export function siteTemplateVariables(
  site: Pick<SiteConfig, 'email' | 'phone' | 'registration'>,
): TemplateVariables {
  return {
    email: site.email,
    phone: site.phone.display,
    phoneE164: site.phone.e164,
    siret: site.registration.siret,
  };
}

function lineAt(text: string, offset: number): number {
  return text.slice(0, offset).split('\n').length;
}

/** Remplace chaque jeton ; un jeton inconnu (faute de frappe) est une erreur. */
export function fillTokens(text: string, variables: TemplateVariables): string {
  const values = new Map(Object.entries(variables));
  return text.replace(TOKEN, (token: string, name: string, offset: number) => {
    const value = values.get(name);
    if (value === undefined) {
      const known = [...values.keys()].map((key) => `{${key}}`).join(', ');
      throw new Error(
        `Jeton inconnu « ${token} » (ligne ${lineAt(text, offset)} du corps) ; jetons disponibles : ${known}.`,
      );
    }
    return value;
  });
}

/**
 * Garde les blocs `{formulaire:<mode>}` … `{/formulaire}` du mode courant, retire les autres,
 * et supprime toujours les lignes de marqueur. Bloc non fermé, imbriqué ou mode inconnu : erreur.
 */
export function selectFormBlocks(text: string, formMode: FormMode): string {
  const kept: string[] = [];
  let open: { readonly mode: string; readonly line: number } | undefined;
  text.split('\n').forEach((line, index) => {
    const marker = line.trim();
    const opening = BLOCK_OPEN.exec(marker);
    if (opening) {
      const mode = opening[1] ?? '';
      if (open) throw new Error(`Bloc {formulaire:…} imbriqué (ligne ${index + 1} du corps).`);
      if (!FORM_MODES.includes(mode)) {
        throw new Error(
          `Mode de formulaire inconnu « ${mode} » (ligne ${index + 1} du corps) : ${FORM_MODES.join(' ou ')}.`,
        );
      }
      open = { mode, line: index + 1 };
    } else if (marker === BLOCK_CLOSE) {
      if (!open) throw new Error(`${BLOCK_CLOSE} sans bloc ouvert (ligne ${index + 1} du corps).`);
      open = undefined;
    } else if (!open || open.mode === formMode) {
      kept.push(line);
    }
  });
  if (open)
    throw new Error(`Bloc {formulaire:${open.mode}} non fermé (ligne ${open.line} du corps).`);
  return kept.join('\n');
}

/** Corps Markdown final : jetons remplacés, blocs du mode courant seulement. */
export function renderContentTemplate(text: string, context: ContentTemplateContext): string {
  return selectFormBlocks(fillTokens(text, context.variables), context.formMode);
}

/**
 * Plugin Sätteri (mdast) : réécrit le source d'un fichier `.md` avant son analyse. Les MDX
 * (articles) sont ignorés : `{…}` y est une expression. `context` est une donnée du plugin,
 * donc de la configuration Astro : le cache du Content Layer est vidé quand elle change
 * (mode du formulaire, coordonnées de site.ts).
 */
export function contentTemplatePlugin(
  context: ContentTemplateContext,
): MdastPluginDefinition & { readonly context: ContentTemplateContext } {
  return {
    name: 'amg:gabarit-contenu',
    context,
    before(root, ctx) {
      if (ctx.sourceFormat !== 'markdown') return;
      let output: string;
      try {
        output = renderContentTemplate(ctx.source, context);
      } catch (error) {
        const file = ctx.fileURL ? decodeURIComponent(ctx.fileURL.pathname) : 'fichier inconnu';
        throw new Error(`${file} : ${error instanceof Error ? error.message : String(error)}`, {
          cause: error,
        });
      }
      if (output !== ctx.source) ctx.replaceNode(root, { raw: output, mdxExpressions: false });
    },
  };
}
