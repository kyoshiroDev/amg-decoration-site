// Sonde de santé du conteneur de l'API (HEALTHCHECK de l'image, docs/EXPLOITATION.md §3.1). L'image
// n'a ni shell ni wget : la sonde est un second processus Node, volontairement minimal (aucun import
// de Nest, de Prisma ni de Zod), car sa mémoire compte dans la limite du conteneur.
//   node dist/healthcheck.js        sain si /tmp/drain est absent et si GET /api/health répond 200
//   node dist/healthcheck.js drain  pose /tmp/drain : le conteneur devient « unhealthy » et Traefik le
//                                   retire du routage avant son arrêt (bascule sans coupure, deploy.sh)

/** Fichier de drainage (tmpfs `/tmp` du conteneur), le même que pour l'image du site. */
export const DRAIN_FILE = '/tmp/drain';

/** Route de vivacité de l'API (préfixe global `api`). */
export const HEALTH_PATH = '/api/health';

/** Délai de la requête de la sonde, sous le `--timeout` du HEALTHCHECK (3 s). */
export const PROBE_TIMEOUT_MS = 2_000;

/** Port d'écoute par défaut de l'API (`PORT`, env.schema.ts). */
export const DEFAULT_PORT = 3000;

/** Codes de sortie lus par Docker : 0 sain, 1 malsain ; 2 pour un appel mal formé. */
export const PROBE_HEALTHY = 0;
export const PROBE_UNHEALTHY = 1;
export const PROBE_USAGE = 2;

export interface ProbeDeps {
  readonly exists: (path: string) => boolean;
  readonly writeFile: (path: string, data: string) => void;
  /** Code HTTP de la réponse ; rejette en cas d'erreur réseau ou de délai dépassé. */
  readonly get: (url: string, timeoutMs: number) => Promise<number>;
}

/** Même règle que `tcpPortSchema` (décimal strict, 1 à 65 535), sans dépendre de Zod. */
export function probePort(value: string | undefined): number | undefined {
  if (value === undefined) return DEFAULT_PORT;
  if (!/^[1-9]\d{0,4}$/.test(value)) return undefined;
  const port = Number(value);
  return port <= 65_535 ? port : undefined;
}

/** Exécute la sonde et rend son code de sortie. */
export async function runProbe(
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
  deps: ProbeDeps,
): Promise<number> {
  if (args.length === 1 && args[0] === 'drain') {
    deps.writeFile(DRAIN_FILE, '');
    return PROBE_HEALTHY;
  }
  if (args.length > 0) return PROBE_USAGE;
  if (deps.exists(DRAIN_FILE)) return PROBE_UNHEALTHY;
  const port = probePort(env['PORT']);
  if (port === undefined) return PROBE_UNHEALTHY;
  try {
    const status = await deps.get(
      `http://127.0.0.1:${String(port)}${HEALTH_PATH}`,
      PROBE_TIMEOUT_MS,
    );
    return status === 200 ? PROBE_HEALTHY : PROBE_UNHEALTHY;
  } catch {
    return PROBE_UNHEALTHY;
  }
}
