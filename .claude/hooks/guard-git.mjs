#!/usr/bin/env node
// Hook PreToolUse (Bash) — garde-fous Git du projet.
// Code de sortie 2 = commande bloquée, le message stderr est renvoyé à Claude.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

function block(message) {
  process.stderr.write(`⛔ guard-git : ${message}\n`);
  process.exit(2);
}

function git(args) {
  try {
    return execSync(`git ${args}`, { cwd: projectDir, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  let command = '';
  try {
    command = JSON.parse(input)?.tool_input?.command ?? '';
  } catch {
    process.exit(0);
  }
  if (!command) process.exit(0);

  // Analyse chaque sous-commande (&&, ||, ;, |)
  const parts = command.split(/&&|\|\||;|\|/).map((p) => p.trim());

  for (const part of parts) {
    const isPush = /^git\s+push\b/.test(part);
    const isPrCreate = /^gh\s+pr\s+create\b/.test(part);

    if (/^gh\s+pr\s+merge\b/.test(part)) {
      block('le merge de PR est réservé à l’humain.');
    }
    if (isPush && /(\s--force\b|\s-f\b|\s--force-with-lease\b|\s\+)/.test(part)) {
      block('push forcé interdit.');
    }
    if (isPush && /\b(main|master)\b/.test(part)) {
      // Amorçage : seul le tout premier push de main est autorisé (main absente du remote).
      const remoteMain = git('ls-remote --heads origin main');
      const remoteExists = git('remote get-url origin') !== '';
      if (remoteExists && remoteMain === '') {
        process.exit(0);
      }
      block('push vers main interdit. Pousse sur dev et ouvre une PR dev → main.');
    }
    if (/^git\s+(commit|merge|rebase|cherry-pick)\b/.test(part)) {
      const branch = git('rev-parse --abbrev-ref HEAD');
      const hasCommits = git('rev-parse --verify HEAD') !== '';
      // Amorçage : le premier commit du dépôt (sur main) est autorisé.
      if ((branch === 'main' || branch === 'master') && hasCommits) {
        block(`opération interdite sur la branche ${branch}. Travaille sur dev.`);
      }
    }
    if (/^git\s+add\b.*\.env/.test(part)) {
      block('ne jamais committer de fichier .env.');
    }

    if (isPush || isPrCreate) {
      const branch = git('rev-parse --abbrev-ref HEAD');
      if (isPush && branch !== 'dev') {
        block(`push autorisé uniquement depuis dev (branche actuelle : ${branch}).`);
      }
      const dirty = git('status --porcelain');
      if (dirty) {
        block('des modifications ne sont pas committées. Committe puis relance le reviewer.');
      }
      const approvedFile = join(projectDir, '.claude', 'state', 'approved-sha');
      const head = git('rev-parse HEAD');
      const approved = existsSync(approvedFile) ? readFileSync(approvedFile, 'utf8').trim() : '';
      if (!approved || approved !== head) {
        block(
          `le commit ${head.slice(0, 7)} n’a pas été approuvé par l’agent reviewer. ` +
            'Lance l’agent "reviewer" (ou /revue) avant de pousser ou d’ouvrir une PR.',
        );
      }
    }
  }
  process.exit(0);
});
