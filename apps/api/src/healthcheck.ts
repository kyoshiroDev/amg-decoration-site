// Point d'entrée de la sonde de santé du conteneur (`HEALTHCHECK` de apps/api/Dockerfile) et du
// drainage avant arrêt (`deploy.sh`). Logique dans healthcheck/probe.ts (testée sans réseau).
import { existsSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { runProbe } from './healthcheck/probe.js';

function httpStatus(url: string, timeoutMs: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'GET', timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on('timeout', () => {
      req.destroy(new Error('délai de la sonde dépassé'));
    });
    req.on('error', reject);
    req.end();
  });
}

process.exitCode = await runProbe(process.argv.slice(2), process.env, {
  exists: existsSync,
  writeFile: (path, data) => {
    writeFileSync(path, data, { mode: 0o600 });
  },
  get: httpStatus,
});
