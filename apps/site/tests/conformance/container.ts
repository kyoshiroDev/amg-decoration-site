/**
 * Mise en place des tests de conformité nginx (`npm run test:conformance -w @amg/site`) : démarre
 * un conteneur de l'image du site avec les mêmes contraintes que la production (deploy/compose.yaml :
 * système de fichiers en lecture seule, /tmp en tmpfs, aucune capacité, 64 Mo), attend la sonde
 * /healthz, puis le supprime à la fin.
 *
 * - `CONFORMANCE_IMAGE` : image à tester (défaut `amg-site:local`, construite avec
 *   `docker build -f apps/site/Dockerfile -t amg-site:local .` depuis la racine) ;
 * - `CONFORMANCE_BASE_URL` : serveur déjà démarré à tester à la place (aucun conteneur lancé).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string;
  }
}

const HEALTH_TIMEOUT_MS = 20_000;
const HEALTH_INTERVAL_MS = 200;

function docker(...args: string[]): string {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/** Attend que /healthz réponde 200 (état), avec une échéance. */
async function waitForHealth(baseUrl: string): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let lastError = 'aucune réponse';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(new URL('/healthz', baseUrl));
      if (response.ok) return;
      lastError = `HTTP ${String(response.status)}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_INTERVAL_MS));
  }
  throw new Error(`Le conteneur ne répond pas sur /healthz (${lastError})`);
}

export default async function setup(project: TestProject): Promise<() => void> {
  const external = process.env['CONFORMANCE_BASE_URL'];
  if (external) {
    project.provide('baseUrl', external);
    return () => undefined;
  }

  const image = process.env['CONFORMANCE_IMAGE'] ?? 'amg-site:local';
  try {
    docker('image', 'inspect', image);
  } catch {
    throw new Error(
      `Image ${image} introuvable : docker build -f apps/site/Dockerfile -t ${image} . (depuis la racine)`,
    );
  }
  const id = docker(
    'run',
    '--detach',
    '--read-only',
    '--tmpfs',
    '/tmp:size=16m,mode=1777',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges:true',
    '--memory',
    '64m',
    '--memory-swap',
    '64m',
    '--label',
    'amg.test=conformance',
    '--publish',
    '127.0.0.1::8080',
    image,
  );
  const remove = (): void => {
    docker('rm', '--force', id);
  };
  try {
    // Ex. « 127.0.0.1:49153 » : port choisi par Docker, jamais en conflit avec un autre service.
    const address = docker('port', id, '8080/tcp').split('\n')[0] ?? '';
    const baseUrl = `http://${address}`;
    await waitForHealth(baseUrl);
    project.provide('baseUrl', baseUrl);
  } catch (error) {
    const logs = spawnSync('docker', ['logs', '--tail', '20', id], { encoding: 'utf8' });
    remove();
    throw new Error(`Conteneur ${image} inutilisable :\n${logs.stdout}${logs.stderr}`, {
      cause: error,
    });
  }
  return remove;
}
