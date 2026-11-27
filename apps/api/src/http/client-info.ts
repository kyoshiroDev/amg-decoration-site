// Informations approximatives sur le client, pour la liste des sessions et le journal (ADR-0023) :
// IP retenue par le proxy de confiance, réseau tronqué (IPv4 /24, IPv6 /48 : jamais l'IP complète
// dans Redis ni montrée au client), appareil approximatif (familles de navigateur et de système,
// jamais l'en-tête `User-Agent` brut, qui est fourni par le client et sert à le pister).
import { isIPv4, isIPv6 } from 'node:net';
import type { FastifyRequest } from 'fastify';
import { DEVICE_LABEL_MAX_LENGTH } from '@amg/api-db';
import { normalizeIp } from './trust-proxy.js';

/** IP du client (dernier saut de confiance, trust-proxy.ts) ; `null` si illisible. */
export function clientIp(request: FastifyRequest): string | null {
  return normalizeIp(request.ip) ?? null;
}

/** Les 8 groupes d'une adresse IPv6 (forme développée), ou `undefined`. */
function ipv6Groups(address: string): number[] | undefined {
  if (!isIPv6(address) || address.includes('.')) return undefined;
  const [head = '', tail] = address.split('::');
  const left = head === '' ? [] : head.split(':');
  const right = tail === undefined || tail === '' ? [] : tail.split(':');
  const missing = 8 - left.length - right.length;
  if (tail === undefined ? missing !== 0 : missing < 1) return undefined;
  return [...left, ...Array<string>(missing).fill('0'), ...right].map((group) =>
    Number.parseInt(group, 16),
  );
}

/** Réseau approximatif : `203.0.113.0/24` ou `2001:db8:1::/48` ; `null` si inconnu. */
export function networkPrefix(ip: string | null): string | null {
  if (ip === null) return null;
  if (isIPv4(ip)) {
    const [a, b, c] = ip.split('.');
    return `${a ?? '0'}.${b ?? '0'}.${c ?? '0'}.0/24`;
  }
  const groups = ipv6Groups(ip);
  if (groups === undefined) return null;
  return `${groups
    .slice(0, 3)
    .map((group) => group.toString(16))
    .join(':')}::/48`;
}

const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/\bEdg(?:e|A|iOS)?\//, 'Edge'],
  [/\bOPR\/|\bOpera\b/, 'Opera'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\bFirefox\/|\bFxiOS\//, 'Firefox'],
  [/\bChrome\/|\bCriOS\//, 'Chrome'],
  [/\bVersion\/[\d.]+.*\bSafari\//, 'Safari'],
];

const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/\biPhone\b/, 'iPhone'],
  [/\biPad\b/, 'iPad'],
  [/\bAndroid\b/, 'Android'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bWindows\b/, 'Windows'],
  [/\bMac OS X\b|\bMacintosh\b/, 'macOS'],
  [/\bLinux\b/, 'Linux'],
];

/** En-tête lu au plus sur cette longueur (aucune expression sur une chaîne non bornée). */
const USER_AGENT_SCAN_LENGTH = 512;

/** « Firefox sur Linux », « Safari sur iPhone »… ; `null` si rien n'est reconnu. */
export function deviceLabel(userAgent: string | undefined): string | null {
  if (userAgent === undefined) return null;
  const scanned = userAgent.slice(0, USER_AGENT_SCAN_LENGTH);
  const browser = BROWSERS.find(([pattern]) => pattern.test(scanned))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(scanned))?.[1];
  const label =
    browser !== undefined && system !== undefined
      ? `${browser} sur ${system}`
      : (browser ?? system ?? null);
  return label === null ? null : label.slice(0, DEVICE_LABEL_MAX_LENGTH);
}
