// Proxy de confiance (ADR-0023, « Hôtes, gardes et limitation de débit ») : Traefik est le seul saut
// cru, et seulement depuis l'adresse ou le CIDR configuré (`TRUSTED_PROXY`, réseau edge où Traefik
// se connecte). L'IP du client est alors la dernière entrée de `X-Forwarded-For`, celle qu'a
// ajoutée Traefik ; tout le reste de l'en-tête (forgeable par le client) est ignoré. Jamais `true`.
import { BlockList, isIP } from 'node:net';

export interface TrustedProxy {
  readonly family: 'ipv4' | 'ipv6';
  readonly address: string;
  readonly prefix: number;
}

/** Préfixes les plus larges admis : un CIDR plus large ferait confiance à trop d'adresses. */
export const MIN_TRUSTED_PREFIX = { ipv4: 16, ipv6: 48 } as const;

const MAX_PREFIX = { ipv4: 32, ipv6: 128 } as const;

/** Lit `adresse` ou `adresse/préfixe` ; `undefined` si invalide ou trop large. */
export function parseTrustedProxy(value: string): TrustedProxy | undefined {
  const parts = value.split('/');
  if (parts.length > 2) return undefined;
  const [address = '', prefixText] = parts;
  const version = isIP(address);
  if (version === 0) return undefined;
  const family = version === 4 ? 'ipv4' : 'ipv6';
  if (family === 'ipv6' && address.includes('%')) return undefined;
  let prefix: number = MAX_PREFIX[family];
  if (prefixText !== undefined) {
    if (!/^(?:0|[1-9]\d{0,2})$/.test(prefixText)) return undefined;
    prefix = Number(prefixText);
  }
  if (prefix < MIN_TRUSTED_PREFIX[family] || prefix > MAX_PREFIX[family]) return undefined;
  return { family, address, prefix };
}

/** Adresse IPv4 écrite en IPv6 (`::ffff:192.0.2.1`), forme d'une socket à double pile. */
const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

/** Adresse normalisée (IPv4 mappée ramenée à IPv4), ou `undefined` si ce n'est pas une IP. */
export function normalizeIp(address: string | undefined): string | undefined {
  if (address === undefined) return undefined;
  const mapped = IPV4_MAPPED.exec(address);
  const candidate = mapped?.[1] ?? address;
  return isIP(candidate) === 0 ? undefined : candidate.toLowerCase();
}

/**
 * Fonction de confiance passée à Fastify (`trustProxy`) : `hop` vaut 0 pour l'adresse de la
 * socket, puis 1, 2… en remontant `X-Forwarded-For` depuis la fin. Seul le saut 0 peut être cru.
 * Sans proxy configuré : `false` (aucun en-tête `X-Forwarded-*` lu).
 */
export function buildTrustProxy(
  proxy: TrustedProxy | undefined,
): false | ((address: string, hop: number) => boolean) {
  if (proxy === undefined) return false;
  const allowed = new BlockList();
  allowed.addSubnet(proxy.address, proxy.prefix, proxy.family);
  return (address, hop) => {
    if (hop !== 0) return false;
    const normalized = normalizeIp(address);
    if (normalized === undefined) return false;
    return allowed.check(normalized, isIP(normalized) === 4 ? 'ipv4' : 'ipv6');
  };
}
