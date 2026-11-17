#!/usr/bin/env node
// Hook PostToolUse (Edit|Write) — formate le fichier modifié avec Prettier s'il est installé.
// Ne bloque jamais : en cas d'erreur, on sort en 0.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const prettier = join(projectDir, 'node_modules', '.bin', 'prettier');
const formattable = /\.(astro|ts|mjs|js|json|css|md|mdx|yaml|yml)$/;

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  try {
    const filePath = JSON.parse(input)?.tool_input?.file_path ?? '';
    if (filePath && formattable.test(filePath) && existsSync(prettier) && existsSync(filePath)) {
      spawnSync(prettier, ['--write', '--log-level', 'silent', filePath], { cwd: projectDir });
    }
  } catch {
    // silencieux
  }
  process.exit(0);
});
