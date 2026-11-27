// Contrôle des rôles au démarrage (main.ts) : rôle non conforme sur l'un des deux pools, démarrage
// refusé ; base injoignable, démarrage admis (aucune dépendance de démarrage à la base).
import { DatabaseRoleError } from '@amg/api-db';
import { describe, expect, it } from 'vitest';
import { checkDatabaseRoles, type RoleVerifier } from '../../src/database/role-check.js';
import { loadTestConfig } from '../support/test-config.js';

const config = loadTestConfig();

function verifier(byScope: Record<'app' | 'journal', () => Promise<'ok' | 'unreachable'>>): {
  readonly verify: RoleVerifier;
  readonly calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    verify: (options) => {
      const scope = options.scope ?? 'app';
      calls.push(`${scope}:${options.connection.user}`);
      return byScope[scope]();
    },
  };
}

describe('checkDatabaseRoles', () => {
  it('contrôle les deux pools, chacun sous son rôle et son périmètre', async () => {
    const { verify, calls } = verifier({
      app: () => Promise.resolve('ok'),
      journal: () => Promise.resolve('ok'),
    });
    await expect(checkDatabaseRoles(config, verify)).resolves.toEqual({
      admitted: true,
      unreachable: [],
    });
    expect(calls.sort()).toEqual(['app:amg_app', 'journal:amg_journal']);
  });

  it.each(['app', 'journal'] as const)(
    'refuse le démarrage si le rôle du pool %s n’est pas conforme',
    async (scope) => {
      const reject = () =>
        Promise.reject(new DatabaseRoleError(['écriture du journal hors de son pool']));
      const ok = () => Promise.resolve('ok' as const);
      const { verify } = verifier(
        scope === 'app' ? { app: reject, journal: ok } : { app: ok, journal: reject },
      );
      await expect(checkDatabaseRoles(config, verify)).resolves.toEqual({
        admitted: false,
        pool: scope === 'app' ? 'principal' : 'journal',
        reasons: ['écriture du journal hors de son pool'],
      });
    },
  );

  it('un rôle non conforme l’emporte sur une base injoignable de l’autre pool', async () => {
    const { verify } = verifier({
      app: () => Promise.resolve('unreachable'),
      journal: () => Promise.reject(new DatabaseRoleError(['superutilisateur'])),
    });
    const result = await checkDatabaseRoles(config, verify);
    expect(result.admitted).toBe(false);
  });

  it('admet le démarrage sur une base injoignable (erreur réseau comprise)', async () => {
    const { verify } = verifier({
      app: () => Promise.resolve('unreachable'),
      journal: () => Promise.reject(new Error('ECONNRESET')),
    });
    await expect(checkDatabaseRoles(config, verify)).resolves.toEqual({
      admitted: true,
      unreachable: ['principal', 'journal'],
    });
  });

  it('avec le vrai contrôle, une base fermée (port 1) n’empêche pas le démarrage', async () => {
    await expect(checkDatabaseRoles(config)).resolves.toEqual({
      admitted: true,
      unreachable: ['principal', 'journal'],
    });
  });
});
