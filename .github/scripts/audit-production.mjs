#!/usr/bin/env node
// Audit des dépendances installées en production (`npm audit --omit=dev`, ADR-0023) : échoue sur
// toute vulnérabilité de gravité élevée ou critique, sauf exception DATÉE et justifiée de
// .github/audit-exceptions.json (avis GHSA, paquets concernés, échéance). Une exception échue fait
// échouer le job : elle doit être revue (montée de version, ou nouvelle échéance argumentée).
// Lit le seul package-lock.json : aucune installation n'est nécessaire.
// Usage : node .github/scripts/audit-production.mjs
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BLOCKING = new Set(['high', 'critical']);
const exceptionsPath = new URL('../audit-exceptions.json', import.meta.url);

/** @param {string} message */
function fail(message) {
  process.stdout.write(`::error::${message}\n`);
  process.exitCode = 1;
}

/** @param {string} message */
function info(message) {
  process.stdout.write(`${message}\n`);
}

/**
 * @typedef {{ advisory: string, packages: string[], expires: string, reason: string }} AuditException
 * @typedef {{ name: string, severity: string, via: (string | { url?: string, title?: string })[] }} Vulnerability
 */

/** @returns {AuditException[]} */
function loadExceptions() {
  const parsed = JSON.parse(readFileSync(exceptionsPath, 'utf8'));
  if (!Array.isArray(parsed.exceptions))
    throw new Error('audit-exceptions.json : "exceptions" attendu');
  for (const entry of parsed.exceptions) {
    const valid =
      typeof entry.advisory === 'string' &&
      /^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/.test(entry.advisory) &&
      Array.isArray(entry.packages) &&
      entry.packages.every((name) => typeof name === 'string') &&
      typeof entry.expires === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(entry.expires) &&
      typeof entry.reason === 'string' &&
      entry.reason.length >= 20;
    if (!valid)
      throw new Error(`audit-exceptions.json : exception mal formée (${JSON.stringify(entry)})`);
  }
  return parsed.exceptions;
}

/**
 * Avis (URL GHSA) à l'origine d'une vulnérabilité, en suivant les dépendances transitives.
 * @param {Record<string, Vulnerability>} vulnerabilities
 * @param {string} name
 * @param {Set<string>} seen
 * @returns {Set<string>}
 */
function rootAdvisories(vulnerabilities, name, seen = new Set()) {
  const found = new Set();
  if (seen.has(name)) return found;
  seen.add(name);
  for (const via of vulnerabilities[name]?.via ?? []) {
    if (typeof via === 'string') {
      for (const url of rootAdvisories(vulnerabilities, via, seen)) found.add(url);
    } else if (typeof via.url === 'string') {
      found.add(via.url);
    }
  }
  return found;
}

const audit = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
// npm audit sort en code 1 dès qu'il trouve une vulnérabilité : seul le rapport JSON fait foi.
/** @type {{ vulnerabilities?: Record<string, Vulnerability> }} */
let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  fail(`npm audit illisible (code ${String(audit.status)}) : ${audit.stderr.slice(0, 500)}`);
  process.exit();
}
if (report.vulnerabilities === undefined) {
  fail('npm audit : rapport sans champ "vulnerabilities" (registre injoignable ?)');
  process.exit();
}

const today = new Date().toISOString().slice(0, 10);
const exceptions = loadExceptions();
const used = new Set();
const vulnerabilities = report.vulnerabilities;

for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
  if (!BLOCKING.has(vulnerability.severity)) continue;
  const urls = rootAdvisories(vulnerabilities, name);
  // Aucun avis racine identifiable (format du rapport changé, chaîne `via` cassée) : rien ne peut
  // être rapproché d'une exception, donc échec plutôt qu'un passage silencieux.
  if (urls.size === 0) {
    fail(`${name} (${vulnerability.severity}) : aucun avis identifié, rapport à examiner`);
    continue;
  }
  for (const url of urls) {
    const exception = exceptions.find(
      (entry) => url.endsWith(`/${entry.advisory}`) && entry.packages.includes(name),
    );
    if (exception === undefined) {
      fail(`${name} (${vulnerability.severity}) : ${url} sans exception`);
    } else if (exception.expires < today) {
      fail(`${name} : exception ${exception.advisory} échue le ${exception.expires}, à revoir`);
    } else {
      used.add(exception);
      info(`${name} : ${exception.advisory} toléré jusqu'au ${exception.expires}`);
    }
  }
}

for (const exception of exceptions) {
  if (!used.has(exception)) {
    process.stdout.write(
      `::warning::exception ${exception.advisory} inutilisée : la retirer de .github/audit-exceptions.json\n`,
    );
  }
}
if (process.exitCode !== 1)
  info('Aucune vulnérabilité élevée ou critique non justifiée en production.');
