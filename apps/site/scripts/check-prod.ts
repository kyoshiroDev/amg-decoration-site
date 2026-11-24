/**
 * `npm run check:prod` : contrôle de mise en production exécuté localement (ADR-0015), le même
 * que celui du build de production Vercel, quel que soit l'environnement. À lancer avant de
 * rattacher le domaine. Exécuté directement par Node (types effacés à la volée).
 */
import { readReleaseBlockers } from '../src/lib/release-guard-files.ts';
import { formatReleaseBlockers } from '../src/lib/release-guard.ts';

const blockers = readReleaseBlockers();

if (blockers.length > 0) {
  process.stderr.write(`${formatReleaseBlockers(blockers)}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('Pages légales complètes : la mise en production est possible.\n');
}
