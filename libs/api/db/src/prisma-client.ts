// Fabrique du client Prisma 7 sur le driver adapter `pg` (ADR-0023). Le pool est configuré champ par
// champ (pas d'URL) et le mot de passe n'y figure que sous forme de fonction : il n'apparaît dans
// aucun objet de configuration susceptible d'être sérialisé ou journalisé. Chaque nouvelle connexion
// est contrôlée avant toute requête : un rôle trop privilégié (superutilisateur, attribut système,
// membre d'un autre rôle, propriétaire des tables, droit de création) est refusé et la connexion
// fermée, l'API ne sert alors aucune donnée. Deux pools (ADR-0023, lot 3) : le pool principal
// (`amg_app`), qui ne peut pas écrire le journal de sécurité, et le pool du journal
// (`amg_journal`), qui ne peut rien faire d'autre qu'écrire et lire `public.security_events`.
import { PrismaPg } from '@prisma/adapter-pg';
import type { PoolConfig } from 'pg';
import { z } from 'zod';
import type { DatabaseConnection } from './database-config.js';
import { PrismaClient } from './generated/prisma/client.js';

/** Délais côté PostgreSQL : aucune requête ni transaction ouverte ne peut bloquer indéfiniment. */
export const POOL_TIMEOUTS = Object.freeze({
  /** Établissement d'une connexion. */
  connectionTimeoutMillis: 5_000,
  /** Connexion inactive rendue au serveur. */
  idleTimeoutMillis: 30_000,
  /** Requête la plus longue admise. */
  statementTimeoutMillis: 15_000,
  /** Attente d'un verrou. */
  lockTimeoutMillis: 5_000,
  /** Transaction ouverte sans activité (connexion tenue par un client lent ou planté). */
  idleInTransactionTimeoutMillis: 15_000,
});

/**
 * Pool contrôlé : `app` (données, sans écriture du journal) ou `journal` (INSERT et SELECT sur
 * `public.security_events` exigés, aucun autre droit sur `public`).
 */
export type SessionScope = 'app' | 'journal';

/**
 * Délais du pool du journal : un INSERT ou une lecture bornée, jamais long. Courts pour qu'une
 * opération qui écrit au journal (déconnexion…) n'attende pas la base bloquée : connexion 2 s,
 * requête et verrou 5 s (les mêmes que roles.sql pour `amg_journal`, que le client imposerait
 * sinon à 15 s), transaction inactive 5 s (le pool n'en ouvre aucune).
 */
export const JOURNAL_POOL_TIMEOUTS = Object.freeze({
  connectionTimeoutMillis: 2_000,
  idleTimeoutMillis: 30_000,
  statementTimeoutMillis: 5_000,
  lockTimeoutMillis: 5_000,
  idleInTransactionTimeoutMillis: 5_000,
});

export interface CreatePrismaClientOptions {
  readonly connection: DatabaseConnection;
  /** Pool principal par défaut. */
  readonly scope?: SessionScope;
  /** Connexions simultanées au plus (budget : 5 pour l'API, 2 pour le worker). */
  readonly maxConnections: number;
  /** Nom visible dans `pg_stat_activity` (diagnostic), sans donnée personnelle. */
  readonly applicationName: string;
  /** Erreur d'une connexion inactive du pool : sans gestionnaire, elle arrêterait le processus. */
  readonly onPoolError: (error: Error) => void;
}

/**
 * Privilèges de la session, lus dans les catalogues (aucune donnée) : superutilisateur, contournement
 * de la RLS, création de rôles ou de bases, réplication, appartenance à un autre rôle (rôles
 * prédéfinis compris : pg_read_all_data, pg_write_server_files, pg_execute_server_program…, même
 * sans héritage, SET ROLE y donne accès), appartenance au rôle propriétaire d'un objet du schéma
 * public (c'est le cas du superutilisateur et de `amg_migrator`), droit de créer dans le schéma public,
 * chemin de recherche effectif (`API_SEARCH_PATH` exactement).
 */
export const SESSION_PRIVILEGES_SQL = `SELECT r.rolsuper AS superuser,
       r.rolbypassrls AS bypass_rls,
       r.rolcreaterole AS create_role,
       r.rolcreatedb AS create_db,
       r.rolreplication AS replication,
       EXISTS (SELECT FROM pg_catalog.pg_auth_members m WHERE m.member = r.oid) AS member_of_roles,
       EXISTS (SELECT FROM pg_catalog.pg_class c
                 JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public'
                  AND pg_catalog.pg_has_role(current_user, c.relowner, 'MEMBER')) AS owns_objects,
       pg_catalog.has_schema_privilege('public', 'CREATE') AS can_create,
       pg_catalog.current_setting('search_path') AS search_path,
       EXISTS (SELECT FROM pg_catalog.pg_class c
                 JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = 'security_events'
                  AND pg_catalog.has_table_privilege(c.oid, 'INSERT')) AS journal_insert,
       EXISTS (SELECT FROM pg_catalog.pg_class c
                 JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                CROSS JOIN pg_catalog.unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE',
                                                   'REFERENCES', 'TRIGGER', 'MAINTAIN']) AS p(privilege)
                WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
                  AND NOT (c.relname = 'security_events' AND p.privilege IN ('SELECT', 'INSERT'))
                  AND (pg_catalog.has_table_privilege(c.oid, p.privilege)
                       OR (c.relname <> 'security_events'
                           AND p.privilege IN ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
                           AND pg_catalog.has_any_column_privilege(c.oid, p.privilege)))) AS beyond_journal
  FROM pg_catalog.pg_roles r
 WHERE r.rolname = current_user`;

const sessionPrivilegesSchema = z.strictObject({
  superuser: z.boolean(),
  bypass_rls: z.boolean(),
  create_role: z.boolean(),
  create_db: z.boolean(),
  replication: z.boolean(),
  member_of_roles: z.boolean(),
  owns_objects: z.boolean(),
  can_create: z.boolean(),
  search_path: z.string().max(1024),
  journal_insert: z.boolean(),
  beyond_journal: z.boolean(),
});

/**
 * Chemin de recherche de toute session de l'API (ADR-0023) : ni `public` ni `"$user"`. Une fonction ou
 * un opérateur créé dans `public` par le propriétaire des tables n'est donc pas préféré à celui de
 * pg_catalog ; Prisma qualifie tables et types (`"public"."users"`). Imposé à l'ouverture de la
 * connexion (paramètre `options`, prioritaire sur `ALTER ROLE … SET`, que roles.sql pose aussi) et
 * vérifié par `assertLeastPrivilegedSession`, à l'ouverture seulement : du code du propriétaire
 * exécuté dans la session (déclencheur, conversion sur ses tables et types) peut le changer ensuite.
 * La protection du journal n'en dépend pas ; il s'écrit et se lit sur un pool dédié (lot 3).
 */
export const API_SEARCH_PATH = 'pg_catalog, pg_temp';

/**
 * Paramètre de démarrage `options` : l'espace du chemin est échappé par une barre oblique inverse
 * (découpage des options par le serveur), pour que `current_setting('search_path')` vaille
 * exactement `API_SEARCH_PATH`.
 */
export const API_CONNECTION_OPTIONS = `-c search_path=${API_SEARCH_PATH.replaceAll(' ', '\\ ')}`;

/** Rôle de connexion trop privilégié pour l'API : les messages ne citent ni hôte, ni rôle. */
export class DatabaseRoleError extends Error {
  readonly reasons: readonly string[];

  constructor(reasons: readonly string[]) {
    super(
      `Rôle de connexion refusé (${reasons.join(', ')}) : l'API ne sert aucune donnée sous ce rôle`,
    );
    this.name = 'DatabaseRoleError';
    this.reasons = reasons;
  }
}

/** Ce dont le contrôle a besoin d'une connexion `pg` (`ClientBase`, ou un double de test). */
export interface SessionQueryable {
  query(text: string): Promise<{ readonly rows: readonly unknown[] }>;
}

/**
 * Vérifie que la session n'a aucun attribut système (superutilisateur, RLS contournée, création de
 * rôles ou de bases, réplication), n'est membre d'aucun rôle, n'est pas propriétaire des tables et
 * ne peut pas créer d'objets ; lève `DatabaseRoleError` sinon. Défense en profondeur : l'API refuse déjà au
 * démarrage `DB_USER` = `amg`, `amg_migrator` ou `postgres`, ce contrôle attrape un rôle mal créé
 * ou un mot de passe d'un autre rôle.
 */
export async function assertLeastPrivilegedSession(
  client: SessionQueryable,
  scope: SessionScope = 'app',
): Promise<void> {
  const { rows } = await client.query(SESSION_PRIVILEGES_SQL);
  const parsed = z.array(sessionPrivilegesSchema).length(1).safeParse(rows);
  if (!parsed.success) throw new DatabaseRoleError(['privilèges illisibles']);
  const [privileges] = parsed.data;
  const reasons: string[] = [];
  if (privileges?.superuser !== false) reasons.push('superutilisateur');
  if (privileges?.bypass_rls !== false) reasons.push('contournement de la RLS');
  if (privileges?.create_role !== false) reasons.push('création de rôles');
  if (privileges?.create_db !== false) reasons.push('création de bases');
  if (privileges?.replication !== false) reasons.push('réplication');
  if (privileges?.member_of_roles !== false) reasons.push('membre d’un autre rôle');
  if (privileges?.owns_objects !== false) reasons.push('propriétaire des tables');
  if (privileges?.can_create !== false) reasons.push('création dans le schéma public');
  if (privileges?.search_path !== API_SEARCH_PATH) reasons.push('chemin de recherche');
  if (scope === 'app') {
    // Le journal ne s'écrit que sur son pool : aucun code du propriétaire des tables ne s'y exécute.
    if (privileges?.journal_insert !== false) reasons.push('écriture du journal hors de son pool');
  } else {
    if (privileges?.journal_insert !== true) reasons.push('écriture du journal impossible');
    if (privileges?.beyond_journal !== false) reasons.push('droits hors du journal');
  }
  if (reasons.length > 0) throw new DatabaseRoleError(reasons);
}

/**
 * Configuration du pool : `PoolConfig` avec un contrôle asynchrone à chaque nouvelle connexion
 * (`onConnect` de pg-pool : en cas d'échec, la connexion est fermée et l'erreur rendue à la requête).
 */
export type GuardedPoolConfig = Omit<PoolConfig, 'onConnect'> & {
  readonly onConnect: (client: SessionQueryable) => Promise<void>;
};

/** Configuration du pool `pg`, exposée pour être testée sans base. */
export function buildPoolConfig(options: CreatePrismaClientOptions): GuardedPoolConfig {
  const { connection } = options;
  const timeouts = options.scope === 'journal' ? JOURNAL_POOL_TIMEOUTS : POOL_TIMEOUTS;
  return {
    host: connection.host,
    port: connection.port,
    database: connection.database,
    user: connection.user,
    password: () => connection.password.reveal(),
    max: options.maxConnections,
    application_name: options.applicationName,
    options: API_CONNECTION_OPTIONS,
    connectionTimeoutMillis: timeouts.connectionTimeoutMillis,
    idleTimeoutMillis: timeouts.idleTimeoutMillis,
    statement_timeout: timeouts.statementTimeoutMillis,
    lock_timeout: timeouts.lockTimeoutMillis,
    idle_in_transaction_session_timeout: timeouts.idleInTransactionTimeoutMillis,
    onConnect: (client) => assertLeastPrivilegedSession(client, options.scope ?? 'app'),
  };
}

/**
 * Crée le client. Aucune connexion n'est ouverte avant la première requête : l'API démarre même si
 * la base est momentanément indisponible. `$disconnect()` ferme le pool (arrêt propre).
 */
export function createPrismaClient(options: CreatePrismaClientOptions): PrismaClient {
  if (!Number.isInteger(options.maxConnections) || options.maxConnections < 1) {
    throw new RangeError('maxConnections : entier ≥ 1 attendu');
  }
  const adapter = new PrismaPg(buildPoolConfig(options), { onPoolError: options.onPoolError });
  return new PrismaClient({ adapter });
}
