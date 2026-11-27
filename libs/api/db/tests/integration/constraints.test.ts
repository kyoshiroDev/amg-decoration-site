// Invariants garantis par la base elle-même (migration initiale), éprouvés sous le rôle de l'API :
// même une requête erronée de l'application ne peut pas les violer. Chaque test est annulé.
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  APP_ROLE,
  SQLSTATE,
  connectAs,
  digest32,
  expectSqlError,
  inRolledBackTransaction,
  insertUser,
  uniqueEmail,
} from './test-database.js';

let app: pg.Client;

beforeAll(async () => {
  app = await connectAs(APP_ROLE);
});

afterAll(async () => {
  await app.end();
});

const INSERT_USER = `INSERT INTO public.users (email, role, status, display_name, password_hash, failed_login_count, updated_at)
  VALUES ($1, 'CLIENT', $2, $3, $4, $5, now())`;
const ARGON2ID = '$argon2id$v=19$m=19456,t=2,p=1$c2VsLWRlLXRlc3Q$aGFjaGUtZGUtdGVzdA';

describe('users', () => {
  it('génère un identifiant UUID v7 et les valeurs par défaut', async () => {
    await inRolledBackTransaction(app, async () => {
      const id = await insertUser(app);
      const { rows } = await app.query<{ version: number; status: string; failed: number }>(
        `SELECT uuid_extract_version(id) AS version, status, failed_login_count AS failed FROM public.users WHERE id = $1`,
        [id],
      );
      expect(rows).toEqual([{ version: 7, status: 'INVITED', failed: 0 }]);
    });
  });

  it('accepte un compte actif avec une empreinte Argon2id', async () => {
    await inRolledBackTransaction(app, async () => {
      await app.query(INSERT_USER, [uniqueEmail(), 'ACTIVE', 'Cliente', ARGON2ID, 0]);
    });
  });

  it('refuse une adresse en double', async () => {
    await inRolledBackTransaction(app, async () => {
      const email = uniqueEmail();
      await insertUser(app, { email });
      await expectSqlError(
        app,
        INSERT_USER,
        [email, 'INVITED', 'Doublon', null, 0],
        SQLSTATE.uniqueViolation,
      );
    });
  });

  it.each([
    ['avec majuscules', 'Cliente@Exemple.test'],
    ['avec espaces', ' cliente@exemple.test'],
    ['sans arobase', 'cliente.exemple.test'],
    ['commençant par une arobase', '@exemple.test'],
  ])('refuse une adresse non normalisée (%s)', async (_label, email) => {
    await inRolledBackTransaction(app, async () => {
      await expectSqlError(
        app,
        INSERT_USER,
        [email, 'INVITED', 'Cliente', null, 0],
        SQLSTATE.checkViolation,
      );
    });
  });

  it('refuse une adresse de plus de 254 caractères', async () => {
    await inRolledBackTransaction(app, async () => {
      const email = `${'a'.repeat(250)}@exemple.test`;
      await expectSqlError(
        app,
        INSERT_USER,
        [email, 'INVITED', 'Cliente', null, 0],
        SQLSTATE.stringTooLong,
      );
    });
  });

  it.each([
    ['une empreinte qui n’est pas Argon2id', 'ACTIVE', '$argon2i$v=19$m=4096,t=3,p=1$abc$def', 0],
    ['un mot de passe en clair', 'ACTIVE', 'motdepasse', 0],
    ['un compte invité avec mot de passe', 'INVITED', ARGON2ID, 0],
    ['un compteur d’échecs négatif', 'ACTIVE', ARGON2ID, -1],
  ])('refuse %s', async (_label, status, hash, failed) => {
    await inRolledBackTransaction(app, async () => {
      await expectSqlError(
        app,
        INSERT_USER,
        [uniqueEmail(), status, 'Cliente', hash, failed],
        SQLSTATE.checkViolation,
      );
    });
  });

  it('refuse un nom affiché vide', async () => {
    await inRolledBackTransaction(app, async () => {
      await expectSqlError(
        app,
        INSERT_USER,
        [uniqueEmail(), 'INVITED', '   ', null, 0],
        SQLSTATE.checkViolation,
      );
    });
  });

  it('supprime en cascade les données d’authentification du compte', async () => {
    await inRolledBackTransaction(app, async () => {
      const id = await insertUser(app);
      await app.query(
        `INSERT INTO public.activation_tokens (user_id, purpose, token_hash, expires_at)
         VALUES ($1, 'INVITATION', $2, now() + interval '168 hours')`,
        [id, digest32()],
      );
      await app.query(`INSERT INTO public.recovery_codes (user_id, code_hmac) VALUES ($1, $2)`, [
        id,
        digest32(),
      ]);
      await app.query('DELETE FROM public.users WHERE id = $1', [id]);
      const { rows } = await app.query<{ n: string }>(
        `SELECT (SELECT count(*) FROM public.activation_tokens WHERE user_id = $1)
              + (SELECT count(*) FROM public.recovery_codes WHERE user_id = $1) AS n`,
        [id],
      );
      expect(rows).toEqual([{ n: '0' }]);
    });
  });
});

const INSERT_TOKEN = `INSERT INTO public.activation_tokens (user_id, purpose, token_hash, expires_at, consumed_at, revoked_at)
  VALUES ($1, $2, $3, now() + $4::interval, $5, $6)`;

describe('activation_tokens', () => {
  it.each([
    ['INVITATION', '168 hours'],
    ['INVITATION_RESEND', '72 hours'],
    ['PASSWORD_RESET', '72 hours'],
    ['MFA_RESET', '72 hours'],
  ])('accepte %s valable %s', async (purpose, lifetime) => {
    await inRolledBackTransaction(app, async () => {
      const id = await insertUser(app);
      await app.query(INSERT_TOKEN, [id, purpose, digest32(), lifetime, null, null]);
    });
  });

  it.each([
    ['INVITATION au-delà de 7 jours', 'INVITATION', '169 hours'],
    ['INVITATION_RESEND au-delà de 72 heures', 'INVITATION_RESEND', '73 hours'],
    ['PASSWORD_RESET au-delà de 72 heures', 'PASSWORD_RESET', '73 hours'],
    ['MFA_RESET au-delà de 72 heures', 'MFA_RESET', '73 hours'],
    ['une échéance déjà passée', 'INVITATION', '-1 minute'],
  ])('refuse %s', async (_label, purpose, lifetime) => {
    await inRolledBackTransaction(app, async () => {
      const id = await insertUser(app);
      await expectSqlError(
        app,
        INSERT_TOKEN,
        [id, purpose, digest32(), lifetime, null, null],
        SQLSTATE.checkViolation,
      );
    });
  });

  it.each([
    ['une empreinte de 31 octets', Buffer.alloc(31, 1)],
    ['une empreinte de 33 octets', Buffer.alloc(33, 1)],
  ])('refuse %s', async (_label, hash) => {
    await inRolledBackTransaction(app, async () => {
      const id = await insertUser(app);
      await expectSqlError(
        app,
        INSERT_TOKEN,
        [id, 'INVITATION', hash, '1 hour', null, null],
        SQLSTATE.checkViolation,
      );
    });
  });

  it.each([
    ['consommé', new Date(), null],
    ['révoqué', null, new Date()],
    ['consommé et révoqué', new Date(), new Date()],
  ])('refuse un jeton créé déjà %s', async (_label, consumedAt, revokedAt) => {
    await inRolledBackTransaction(app, async () => {
      const id = await insertUser(app);
      await expectSqlError(
        app,
        INSERT_TOKEN,
        [id, 'INVITATION', digest32(), '1 hour', consumedAt, revokedAt],
        SQLSTATE.checkViolation,
        /déjà consommé ou révoqué/,
      );
    });
  });

  it('refuse deux jetons de même empreinte, même pour deux comptes', async () => {
    await inRolledBackTransaction(app, async () => {
      const hash = digest32();
      await app.query(INSERT_TOKEN, [
        await insertUser(app),
        'INVITATION',
        hash,
        '1 hour',
        null,
        null,
      ]);
      await expectSqlError(
        app,
        INSERT_TOKEN,
        [await insertUser(app), 'PASSWORD_RESET', hash, '1 hour', null, null],
        SQLSTATE.uniqueViolation,
        /activation_tokens_token_hash_key/,
      );
    });
  });

  it('refuse un jeton pour un compte inexistant', async () => {
    await inRolledBackTransaction(app, async () => {
      await expectSqlError(
        app,
        INSERT_TOKEN,
        ['0190a4d2-0000-7000-8000-000000000000', 'INVITATION', digest32(), '1 hour', null, null],
        SQLSTATE.foreignKeyViolation,
      );
    });
  });
});

describe('totp_factors', () => {
  const INSERT_TOTP = `INSERT INTO public.totp_factors (user_id, secret_ciphertext, secret_iv, secret_auth_tag, key_version, last_used_step, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, now())`;

  it('accepte un secret chiffré AES-256-GCM bien formé', async () => {
    await inRolledBackTransaction(app, async () => {
      const id = await insertUser(app);
      await app.query(INSERT_TOTP, [
        id,
        Buffer.alloc(20),
        Buffer.alloc(12),
        Buffer.alloc(16),
        1,
        '58000000',
      ]);
    });
  });

  it.each([
    ['un IV de 16 octets', Buffer.alloc(20), Buffer.alloc(16), Buffer.alloc(16), 1, null],
    ['une étiquette tronquée', Buffer.alloc(20), Buffer.alloc(12), Buffer.alloc(8), 1, null],
    ['un chiffré trop court', Buffer.alloc(8), Buffer.alloc(12), Buffer.alloc(16), 1, null],
    ['une version de clé nulle', Buffer.alloc(20), Buffer.alloc(12), Buffer.alloc(16), 0, null],
    ['un pas de temps négatif', Buffer.alloc(20), Buffer.alloc(12), Buffer.alloc(16), 1, '-1'],
  ])('refuse %s', async (_label, ciphertext, iv, tag, version, step) => {
    await inRolledBackTransaction(app, async () => {
      const id = await insertUser(app);
      await expectSqlError(
        app,
        INSERT_TOTP,
        [id, ciphertext, iv, tag, version, step],
        SQLSTATE.checkViolation,
      );
    });
  });

  it('n’admet qu’un facteur par compte', async () => {
    await inRolledBackTransaction(app, async () => {
      const id = await insertUser(app);
      const values = [id, Buffer.alloc(20), Buffer.alloc(12), Buffer.alloc(16), 1, null];
      await app.query(INSERT_TOTP, values);
      await expectSqlError(app, INSERT_TOTP, values, SQLSTATE.uniqueViolation);
    });
  });
});

describe('recovery_codes et enrollment_codes', () => {
  it('refuse un code de secours en double pour le même compte', async () => {
    await inRolledBackTransaction(app, async () => {
      const id = await insertUser(app);
      const hmac = digest32();
      await app.query('INSERT INTO public.recovery_codes (user_id, code_hmac) VALUES ($1, $2)', [
        id,
        hmac,
      ]);
      await expectSqlError(
        app,
        'INSERT INTO public.recovery_codes (user_id, code_hmac) VALUES ($1, $2)',
        [id, hmac],
        SQLSTATE.uniqueViolation,
      );
    });
  });

  it('refuse un HMAC de code de secours de mauvaise longueur', async () => {
    await inRolledBackTransaction(app, async () => {
      const id = await insertUser(app);
      await expectSqlError(
        app,
        'INSERT INTO public.recovery_codes (user_id, code_hmac) VALUES ($1, $2)',
        [id, Buffer.alloc(20)],
        SQLSTATE.checkViolation,
      );
    });
  });

  const INSERT_ENROLLMENT = `INSERT INTO public.enrollment_codes (user_id, code_hmac, expires_at)
    VALUES ($1, $2, now() + $3::interval)`;

  it('accepte un code d’enrôlement valable 30 minutes', async () => {
    await inRolledBackTransaction(app, async () => {
      const id = await insertUser(app);
      await app.query(INSERT_ENROLLMENT, [id, digest32(), '30 minutes']);
    });
  });

  it.each([
    ['valable plus de 30 minutes', '32 minutes'],
    ['déjà expiré', '-1 second'],
  ])('refuse un code d’enrôlement %s', async (_label, lifetime) => {
    await inRolledBackTransaction(app, async () => {
      const id = await insertUser(app);
      await expectSqlError(
        app,
        INSERT_ENROLLMENT,
        [id, digest32(), lifetime],
        SQLSTATE.checkViolation,
      );
    });
  });
});
