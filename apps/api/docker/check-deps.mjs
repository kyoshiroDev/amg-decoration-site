// Contrôle de construction des images de l'API (apps/api/Dockerfile) : chaque dépendance de
// production des workspaces donnés en argument (`dependencies`, pairs non optionnels), et
// récursivement celles de chaque paquet trouvé, doit être résolvable comme Node le fait pour un
// import nu : `node_modules/<nom>/package.json` dans le dossier du paquet ou l'un de ses parents.
// Sinon la construction échoue : une dépendance installée hors des dossiers copiés dans l'image
// (par exemple `apps/api/node_modules/ioredis`, imbriquée par npm) casse le build, pas le démarrage.
// Usage : node check-deps.mjs <dossier de workspace>...   (sans dépendance, Node seul)
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const roots = process.argv.slice(2);
if (roots.length === 0) {
  process.stderr.write('usage : node check-deps.mjs <dossier de workspace>...\n');
  process.exit(2);
}

/** Dossier du paquet `name` vu depuis `fromDir`, ou undefined (résolution des imports nus de Node). */
function findPackage(name, fromDir) {
  for (let dir = fromDir; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return realpathSync(candidate);
    if (dirname(dir) === dir) return undefined;
  }
}

/** Dépendances obligatoires à l'exécution : `dependencies` et pairs non marqués optionnels. */
function requiredDeps(manifest) {
  const peersMeta = manifest.peerDependenciesMeta ?? {};
  const peers = Object.keys(manifest.peerDependencies ?? {}).filter(
    (name) => peersMeta[name]?.optional !== true,
  );
  return [...new Set([...Object.keys(manifest.dependencies ?? {}), ...peers])];
}

const seen = new Set();
const missing = [];
const queue = roots.map((root) => realpathSync(resolve(root)));
while (queue.length > 0) {
  const dir = queue.shift();
  if (seen.has(dir)) continue;
  seen.add(dir);
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  for (const name of requiredDeps(manifest)) {
    const found = findPackage(name, dir);
    if (found === undefined) missing.push(`${name} (requis par ${manifest.name ?? dir})`);
    else queue.push(found);
  }
}

process.stdout.write(`dépendances de production résolues : ${seen.size - roots.length} paquets\n`);
if (missing.length > 0) {
  process.stderr.write(`ERREUR : dépendances introuvables : ${missing.sort().join(', ')}\n`);
  process.exit(1);
}
