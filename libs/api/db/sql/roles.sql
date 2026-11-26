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
--                 _prisma_migrations ; sur security_events : INSERT et SELECT seulement.

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
END
$$;

-- Schéma public : création d'objets réservée au rôle des migrations, simple usage pour l'API.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM amg_app;
GRANT USAGE, CREATE ON SCHEMA public TO amg_migrator;
GRANT USAGE ON SCHEMA public TO amg_app;
