-- Rôles PostgreSQL de l'API (ADR-0023, docs/EXPLOITATION.md §11). À exécuter par le superutilisateur
-- `amg` (créé par l'image postgres), dans la base de l'environnement, AVANT la première migration :
--
--   docker exec -i <conteneur postgres> psql -v ON_ERROR_STOP=1 -U amg -d amg < libs/api/db/sql/roles.sql
--
-- Idempotent : peut être rejoué sans effet de bord (après une restauration, pour réaffirmer les
-- attributs et les droits). Ne contient AUCUN secret : les mots de passe sont posés à part, avec
-- `\password <rôle>` dans psql (empreinte SCRAM calculée par psql : le mot de passe ne passe ni sur
-- une ligne de commande, ni dans une requête, ni dans un journal du serveur).
--
-- Trois rôles, moindre privilège :
--   amg           superutilisateur de l'image : administration, sauvegarde, restauration. Jamais utilisé
--                 par l'API ni par les migrations.
--   amg_migrator  propriétaire des objets du schéma public : applique les migrations (conteneur
--                 ponctuel, lot 2). Ni superutilisateur, ni création de base, de rôle ou de schéma.
--   amg_app       rôle de l'API et du worker : lecture et écriture des données seulement (droits
--                 accordés table par table dans les migrations) ; ni DDL, ni TRUNCATE, ni accès à
--                 _prisma_migrations ; sur security_events : INSERT et SELECT seulement ; aucune
--                 fonction exécutable sans GRANT explicite.
--
-- Plus un garde-fou du superutilisateur : le déclencheur d'événement `amg_guard_security_events`
-- (schéma `amg_guard`, inaccessible aux autres rôles) interdit au propriétaire des tables de
-- désactiver, remplacer ou supprimer la protection du journal de sécurité (voir en fin de fichier).

-- Création si absents (CREATE ROLE n'a pas de IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'amg_migrator') THEN
    CREATE ROLE amg_migrator;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'amg_app') THEN
    CREATE ROLE amg_app;
  END IF;
END
$$;

-- Attributs réaffirmés à chaque exécution. NOINHERIT : aucun droit hérité d'un autre rôle.
-- Limites de connexions : migrations (une connexion et un verrou consultatif) ; API (pool de 5, plus
-- la réplique de bascule) et worker (pool de 2), sous max_connections = 40.
ALTER ROLE amg_migrator WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 3;
ALTER ROLE amg_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 20;

-- Garde-fous côté serveur, en plus de ceux du pool de l'API : aucune requête, aucun verrou ni
-- aucune transaction inactive ne peut tenir une connexion indéfiniment.
ALTER ROLE amg_app SET statement_timeout = '15s';
ALTER ROLE amg_app SET lock_timeout = '5s';
ALTER ROLE amg_app SET idle_in_transaction_session_timeout = '15s';

-- Base : seuls les deux rôles s'y connectent (et le superutilisateur) ; aucun rôle ne crée de
-- table temporaire ni de schéma. La base `postgres` de l'image est fermée aux rôles non privilégiés.
DO $$
BEGIN
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM amg_migrator, amg_app', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO amg_migrator, amg_app', current_database());
  IF current_database() <> 'postgres' THEN
    REVOKE CONNECT, TEMPORARY ON DATABASE postgres FROM PUBLIC;
  END IF;
  -- Modèle des nouvelles bases : aucun rôle non privilégié ne s'y connecte (ni n'y crée de table
  -- temporaire). CREATE DATABASE, réservé au superutilisateur, n'en a pas besoin.
  IF current_database() <> 'template1' THEN
    REVOKE CONNECT, TEMPORARY ON DATABASE template1 FROM PUBLIC;
  END IF;
END
$$;

-- Schéma public : création d'objets réservée au rôle des migrations, simple usage pour l'API.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM amg_app;
GRANT USAGE, CREATE ON SCHEMA public TO amg_migrator;
GRANT USAGE ON SCHEMA public TO amg_app;

-- Fonctions : PostgreSQL accorde EXECUTE à PUBLIC sur toute nouvelle fonction. Pour celles que crée
-- le rôle des migrations, ce droit par défaut est retiré : une fonction n'est exécutable par
-- `amg_app` que si une migration le lui accorde explicitement (tests/integration/privileges.test.ts).
ALTER DEFAULT PRIVILEGES FOR ROLE amg_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ---------------------------------------------------------------------------------------------
-- Journal de sécurité protégé contre son propriétaire (ADR-0023). Les déclencheurs de la migration
-- rendent `security_events` ajout seul pour tous les rôles, mais `amg_migrator`, propriétaire de la
-- table, pourrait les désactiver, les remplacer ou les supprimer, ou réécrire la table
-- (ALTER TABLE … ALTER COLUMN … TYPE … USING). Ce déclencheur d'événement, créé et possédé par le
-- superutilisateur (seul à pouvoir créer, modifier ou supprimer un déclencheur d'événement), refuse
-- à tout rôle non superutilisateur :
--   - toute commande DDL qui vise la table protégée ou la fonction `security_events_append_only`
--     (ALTER TABLE sous toutes ses formes : DISABLE TRIGGER, RENAME, ALTER COLUMN, DROP COLUMN, RLS…) ;
--   - tout état où les déclencheurs de la table ne sont pas exactement ceux de la migration
--     (déclencheur ajouté, remplacé par CREATE OR REPLACE TRIGGER, renommé, désactivé, conditionné
--     par WHEN, ou limité à certaines colonnes), ainsi que les règles et l'héritage sur la table ;
--   - la suppression de la table, de l'une de ses colonnes, de ses déclencheurs ou de la fonction.
-- La table protégée est repérée par ses déclencheurs (nom canonique ou fonction), pas seulement par
-- son nom : la renommer ne la soustrait pas au contrôle. Tant que le déclencheur de ligne n'existe
-- pas (migration initiale ou restauration en cours), rien n'est vérifié. Une future migration qui
-- modifie la structure du journal (nouvelle colonne) sera appliquée par le superutilisateur ;
-- `ALTER TYPE security_event_type ADD VALUE` et les index restent possibles pour `amg_migrator`.
-- Limite connue : renommer une valeur d'énumération (`ALTER TYPE … RENAME VALUE`) reste possible pour
-- le propriétaire du type ; détection par comparaison avec la sauvegarde (docs/EXPLOITATION.md §11).
-- ---------------------------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS amg_guard;
REVOKE ALL ON SCHEMA amg_guard FROM PUBLIC;

CREATE OR REPLACE FUNCTION amg_guard.protect_security_events() RETURNS event_trigger
  LANGUAGE plpgsql
  SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  row_trigger CONSTANT name := 'security_events_append_only_row';
  truncate_trigger CONSTANT name := 'security_events_append_only_truncate';
  append_only oid := to_regprocedure('public.security_events_append_only()');
  journal oid;
BEGIN
  IF (SELECT r.rolsuper FROM pg_catalog.pg_roles r WHERE r.rolname = current_user) THEN
    RETURN;
  END IF;

  IF TG_EVENT = 'sql_drop' THEN
    IF EXISTS (
      SELECT FROM pg_catalog.pg_event_trigger_dropped_objects() AS d
       WHERE (d.object_type = 'table' AND d.object_identity = 'public.security_events')
          OR (d.object_type = 'table column' AND starts_with(d.object_identity, 'public.security_events.'))
          OR (d.object_type = 'trigger' AND d.object_identity LIKE '% on public.security\_events')
          OR (d.object_type = 'function' AND d.object_identity = 'public.security_events_append_only()')
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'insufficient_privilege',
        MESSAGE = 'journal de sécurité : suppression réservée au superutilisateur';
    END IF;
    RETURN;
  END IF;

  -- ddl_command_end : chaque table « scellée » (porteuse du déclencheur de ligne du journal).
  FOR journal IN
    SELECT DISTINCT t.tgrelid FROM pg_catalog.pg_trigger t
     WHERE NOT t.tgisinternal
       AND (t.tgname = row_trigger OR (t.tgfoid = append_only AND (t.tgtype & 1) = 1))
  LOOP
    IF EXISTS (
      SELECT FROM pg_catalog.pg_event_trigger_ddl_commands() AS c
       WHERE (c.classid = 'pg_catalog.pg_class'::regclass::oid AND c.objid = journal)
          OR (c.classid = 'pg_catalog.pg_proc'::regclass::oid AND c.objid = append_only)
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'insufficient_privilege',
        MESSAGE = 'journal de sécurité : modification de la table ou de sa fonction réservée au superutilisateur';
    END IF;

    IF append_only IS NULL
       OR journal <> to_regclass('public.security_events')
       -- Déclencheur de ligne exact : BEFORE INSERT OR UPDATE OR DELETE FOR EACH ROW (1+2+4+8+16).
       OR NOT EXISTS (
         SELECT FROM pg_catalog.pg_trigger t
          WHERE t.tgrelid = journal AND t.tgname = row_trigger AND t.tgfoid = append_only
            AND t.tgtype = 31 AND t.tgenabled IN ('O', 'A') AND t.tgqual IS NULL
            AND t.tgnargs = 0 AND cardinality(t.tgattr::int2[]) = 0)
       -- Aucun autre déclencheur que ces deux-là ; TRUNCATE : BEFORE FOR EACH STATEMENT (2+32).
       OR EXISTS (
         SELECT FROM pg_catalog.pg_trigger t
          WHERE t.tgrelid = journal AND NOT t.tgisinternal
            AND NOT (t.tgfoid = append_only AND t.tgenabled IN ('O', 'A') AND t.tgqual IS NULL
                     AND t.tgnargs = 0 AND cardinality(t.tgattr::int2[]) = 0
                     AND ((t.tgname = row_trigger AND t.tgtype = 31)
                          OR (t.tgname = truncate_trigger AND t.tgtype = 34))))
       OR EXISTS (SELECT FROM pg_catalog.pg_rewrite r WHERE r.ev_class = journal)
       OR EXISTS (SELECT FROM pg_catalog.pg_inherits i WHERE i.inhrelid = journal OR i.inhparent = journal)
       OR EXISTS (SELECT FROM pg_catalog.pg_class c WHERE c.oid = journal AND (c.relrowsecurity OR c.relkind <> 'r'))
    THEN
      RAISE EXCEPTION USING ERRCODE = 'insufficient_privilege',
        MESSAGE = 'journal de sécurité : déclencheurs, règles ou héritage modifiés, réservé au superutilisateur';
    END IF;
  END LOOP;
END;
$$;

-- Jamais appelable directement (fonction de déclencheur d'événement) ; aucun droit pour PUBLIC.
REVOKE ALL ON FUNCTION amg_guard.protect_security_events() FROM PUBLIC;

-- Créés s'ils manquent (sans fenêtre où la protection disparaît au rejeu), puis réactivés.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_event_trigger WHERE evtname = 'amg_guard_security_events') THEN
    CREATE EVENT TRIGGER amg_guard_security_events ON ddl_command_end
      EXECUTE FUNCTION amg_guard.protect_security_events();
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_event_trigger WHERE evtname = 'amg_guard_security_events_drop') THEN
    CREATE EVENT TRIGGER amg_guard_security_events_drop ON sql_drop
      EXECUTE FUNCTION amg_guard.protect_security_events();
  END IF;
END
$$;
ALTER EVENT TRIGGER amg_guard_security_events ENABLE;
ALTER EVENT TRIGGER amg_guard_security_events_drop ENABLE;
