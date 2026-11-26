-- Rôles PostgreSQL de l'API (ADR-0023, docs/EXPLOITATION.md §11). À exécuter par le superutilisateur
-- `amg` (créé par l'image postgres), dans la base de l'environnement, AVANT la première migration :
--
--   docker exec -i -e PGOPTIONS='-c search_path=pg_catalog,pg_temp' <conteneur postgres> \
--     psql -v ON_ERROR_STOP=1 -U amg -d amg < libs/api/db/sql/roles.sql
--
-- Atomique (BEGIN … COMMIT ci-dessous : une erreur n'applique rien, même sans ON_ERROR_STOP, et
-- même exécuté par l'entrypoint de l'image en développement) et idempotent : peut être rejoué sans
-- effet de bord (après une migration, une restauration, ou pour réaffirmer attributs et droits). Il
-- se termine, après la validation, par la vérification du journal de sécurité (fin de fichier) : un
-- rejeu qui échoue à cette étape signale un journal altéré. Ne contient AUCUN secret : les mots de passe sont posés à part,
-- avec `\password <rôle>` dans psql (empreinte SCRAM calculée par psql : le mot de passe ne passe ni
-- sur une ligne de commande, ni dans une requête, ni dans un journal du serveur).
--
-- Trois rôles, moindre privilège :
--   amg           superutilisateur de l'image : administration, sauvegarde, ouverture et fermeture
--                 des fenêtres de migration. Jamais utilisé par l'API ni pour appliquer une migration,
--                 et n'exécute jamais de DML ni de DDL sur les objets d'`amg_migrator` (ni par
--                 SET ROLE, qui n'est pas une frontière : le code d'un déclencheur ou d'une fonction
--                 peut faire RESET ROLE et agir en superutilisateur).
--   amg_migrator  propriétaire des objets du schéma public : applique les migrations (conteneur
--                 ponctuel, lot 2). Ni superutilisateur, ni création de base, de rôle ou de schéma.
--                 Créé NOLOGIN ; ce fichier ne touche jamais à LOGIN : la connexion n'est ouverte que
--                 pendant une fenêtre de migration ou de restauration (EXPLOITATION.md §11).
--   amg_app       rôle de l'API et du worker : lecture et écriture des données seulement (droits
--                 accordés table par table dans les migrations) ; ni DDL, ni TRUNCATE, ni accès à
--                 _prisma_migrations ; sur security_events : INSERT et SELECT seulement ; aucune
--                 fonction exécutable sans GRANT explicite.
--
-- Plus un garde-fou du superutilisateur : le déclencheur d'événement `amg_guard_security_events`
-- (schéma `amg_guard`, en lecture seule pour les autres rôles) interdit au propriétaire des tables
-- de désactiver, remplacer ou contourner la protection du journal de sécurité (fin de fichier).
--
-- Chemin de recherche épinglé pour toute la session, AVANT la transaction (la vérification finale
-- s'exécute après COMMIT) : `amg_migrator` peut créer dans `public` une fonction ou un opérateur
-- mieux assorti qu'une fonction de pg_catalog (par exemple `public.format(text, name)`, préférée au
-- `format(text, VARIADIC "any")` de pg_catalog) ; exécuté ici par le superutilisateur, son code
-- pourrait faire RESET ROLE et s'accorder SUPERUSER. Avec ce chemin, `public` n'est jamais consulté ;
-- en défense en profondeur, toute fonction et tout opérateur appelés hors des fonctions de
-- `amg_guard` sont en outre qualifiés (`pg_catalog.`), et chaque fonction de `amg_guard` fixe son
-- propre chemin (`SET search_path = pg_catalog, pg_temp`). Le superutilisateur reçoit le même chemin
-- par défaut (ci-dessous) : il ne lit jamais une table ou une vue de `public` (EXPLOITATION.md §11).

SET search_path = pg_catalog, pg_temp;

BEGIN;

-- Création si absents (CREATE ROLE n'a pas de IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname OPERATOR(pg_catalog.=) 'amg_migrator') THEN
    CREATE ROLE amg_migrator NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname OPERATOR(pg_catalog.=) 'amg_app') THEN
    CREATE ROLE amg_app;
  END IF;
END
$$;

-- Attributs réaffirmés à chaque exécution. NOINHERIT : aucun droit hérité d'un autre rôle.
-- Limites de connexions : migrations (une connexion et un verrou consultatif) ; API (pool de 5, plus
-- la réplique de bascule) et worker (pool de 2), sous max_connections = 40. LOGIN d'amg_migrator :
-- volontairement absent (fenêtres de migration, ci-dessus).
ALTER ROLE amg_migrator WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 3;
ALTER ROLE amg_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 20;

-- Superutilisateur : `public` hors de son chemin par défaut (défense en profondeur, en plus de
-- PGOPTIONS pour chaque commande, EXPLOITATION.md §11). Une table de `public` citée sans schéma
-- sous `amg` n'est donc pas trouvée, au lieu d'exécuter du code d'`amg_migrator`.
ALTER ROLE amg SET search_path = pg_catalog, pg_temp;

-- Garde-fous côté serveur, en plus de ceux du pool de l'API : aucune requête, aucun verrou ni
-- aucune transaction inactive ne peut tenir une connexion indéfiniment.
ALTER ROLE amg_app SET statement_timeout = '15s';
ALTER ROLE amg_app SET lock_timeout = '5s';
ALTER ROLE amg_app SET idle_in_transaction_session_timeout = '15s';

-- Migrations : une migration n'attend jamais un verrou plus de 5 s (une table tenue par l'API ou
-- une seconde migration simultanée la font échouer, sans figer l'API derrière son verrou exclusif),
-- aucune instruction ne dépasse 5 min (base de quelques Mio : une migration plus longue est une
-- anomalie), et une transaction abandonnée (conteneur des migrations interrompu) ne garde pas ses
-- verrous plus d'une minute. Appliqués à la connexion d'`amg_migrator` (pas sous SET ROLE).
ALTER ROLE amg_migrator SET lock_timeout = '5s';
ALTER ROLE amg_migrator SET statement_timeout = '5min';
ALTER ROLE amg_migrator SET idle_in_transaction_session_timeout = '1min';

-- Base : seuls les deux rôles s'y connectent (et le superutilisateur) ; aucun rôle ne crée de
-- table temporaire ni de schéma. La base `postgres` de l'image est fermée aux rôles non privilégiés.
DO $$
BEGIN
  EXECUTE pg_catalog.format('REVOKE ALL ON DATABASE %I FROM PUBLIC', pg_catalog.current_database());
  EXECUTE pg_catalog.format('REVOKE ALL ON DATABASE %I FROM amg_migrator, amg_app', pg_catalog.current_database());
  EXECUTE pg_catalog.format('GRANT CONNECT ON DATABASE %I TO amg_migrator, amg_app', pg_catalog.current_database());
  IF pg_catalog.current_database() OPERATOR(pg_catalog.<>) 'postgres' THEN
    REVOKE CONNECT, TEMPORARY ON DATABASE postgres FROM PUBLIC;
  END IF;
  -- Modèle des nouvelles bases : aucun rôle non privilégié ne s'y connecte (ni n'y crée de table
  -- temporaire). CREATE DATABASE, réservé au superutilisateur, n'en a pas besoin.
  IF pg_catalog.current_database() OPERATOR(pg_catalog.<>) 'template1' THEN
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
-- rendent `security_events` ajout seul pour tous les rôles ; leur fonction,
-- `amg_guard.security_events_append_only()`, est créée ici et possédée par le superutilisateur :
-- `amg_migrator`, propriétaire de la table et du type `security_event_type`, ne peut ni la
-- remplacer, ni la renommer, ni la supprimer. Il pourrait en revanche désactiver, remplacer ou
-- supprimer les déclencheurs, réécrire la table, bâillonner l'API ou réécrire l'historique sans
-- toucher aux lignes. Ce déclencheur d'événement, créé et possédé par le superutilisateur (seul à
-- pouvoir créer, modifier, désactiver ou supprimer un déclencheur d'événement), refuse à tout rôle
-- non superutilisateur :
--   - toute commande DDL qui vise la table protégée (ALTER TABLE sous toutes ses formes : DISABLE
--     TRIGGER, RENAME, ALTER COLUMN, DROP COLUMN, ADD CONSTRAINT, RLS…) ;
--   - après TOUTE commande DDL (GRANT, REVOKE, CREATE INDEX, CREATE TABLE … REFERENCES, ALTER TYPE
--     compris, dont pg_event_trigger_ddl_commands() ne donne pas toujours l'objet visé), tout état
--     du journal qui s'écarte de celui de la migration (amg_guard.security_events_violation) :
--       présence : une fois le journal scellé (marqueur `amg_guard.journal_sealed`, posé par la
--         vérification finale de ce fichier), `public.security_events` existe et reste scellée ;
--       déclencheurs : exactement ceux de la migration (ni ajout, ni déclencheur interne, donc ni
--         clé étrangère vers le journal, ni CREATE OR REPLACE TRIGGER, ni renommage, ni
--         désactivation, ni WHEN, ni limitation à des colonnes) ; ni règle, ni héritage, ni RLS, ni
--         politique ; fonction possédée par un superutilisateur, sans SECURITY DEFINER ;
--       contraintes : exactement la clé primaire et `security_events_details_check` (définition
--         figée), validées ; NOT NULL sur `id`, `occurred_at` et `type` seulement (PostgreSQL 18 les
--         enregistre aussi dans pg_constraint) ; aucune clé étrangère vers le journal (ses
--         déclencheurs internes bloqueraient la purge) ;
--       droits : seuls le propriétaire et `amg_app` figurent dans l'ACL de la table, `amg_app` avec
--         exactement SELECT et INSERT, sans option de transmission ; aucun droit de colonne
--         (un REVOKE INSERT … FROM amg_app ferait taire le journal) ;
--       index : aucun index unique autre que la clé primaire, aucun index partiel, sur expression ou
--         d'exclusion (un index unique partiel, ou une fonction d'index qui lève une erreur,
--         censurerait des événements choisis) ;
--       type : la colonne `type` est toujours de type public.security_event_type, dont les valeurs
--         de la migration initiale restent présentes, sous leur nom et dans leur ordre
--         (ALTER TYPE … ADD VALUE reste permis ; RENAME VALUE, qui permettrait d'échanger deux
--         valeurs et donc de réécrire l'historique, est refusé dès le premier renommage) ;
--   - la suppression de la table, de l'une de ses colonnes ou de ses déclencheurs.
-- La table protégée est repérée par ses déclencheurs (nom canonique ou fonction), pas seulement par
-- son nom : la renommer ne la soustrait pas au contrôle. Tant que le déclencheur de ligne n'existe
-- pas (migration initiale), rien n'est vérifié. Une migration qui doit modifier le journal lui-même
-- (nouvelle colonne, renommage d'une valeur…) s'applique dans une fenêtre où le superutilisateur
-- désactive ce déclencheur d'événement, puis rejoue ce fichier, qui le réactive et vérifie l'état
-- final, présence du journal comprise (docs/EXPLOITATION.md §11). Même chose pour une restauration
-- (droits restaurés après les déclencheurs). Nouvelles valeurs d'énumération : rien à changer ici.
-- ---------------------------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS amg_guard;
REVOKE ALL ON SCHEMA amg_guard FROM PUBLIC;
-- Le déclencheur d'événement s'exécute avec les droits du rôle qui lance la commande DDL : celui
-- des migrations doit pouvoir appeler les fonctions de contrôle (lecture des catalogues et du
-- marqueur seulement) et la fonction du déclencheur du journal (CREATE TRIGGER exige EXECUTE).
-- Aucun droit de création dans ce schéma.
GRANT USAGE ON SCHEMA amg_guard TO amg_migrator;

-- Fonction des déclencheurs du journal (ajout seul). Exécutée avec les droits du rôle qui écrit
-- (pas SECURITY DEFINER) ; aucun EXECUTE n'est vérifié au déclenchement, seulement à la création
-- du déclencheur : `amg_app` n'a besoin d'aucun droit sur ce schéma.
CREATE OR REPLACE FUNCTION amg_guard.security_events_append_only() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW."id" := uuidv7();
    NEW."occurred_at" := now();
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD."occurred_at" > now() - interval '12 months' THEN
      RAISE EXCEPTION 'journal de sécurité : suppression interdite avant 12 mois';
    END IF;
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'journal de sécurité : % interdit', TG_OP;
END;
$$;

-- « Scellé une fois, scellé toujours » : une ligne dès que la vérification finale a vu le journal
-- scellé. Ensuite, un journal supprimé, renommé ou descellé (pendant une fenêtre du journal, par
-- exemple) est un écart. Écrit par le superutilisateur seulement ; lu par le contrôle.
CREATE TABLE IF NOT EXISTS amg_guard.journal_sealed (
  sealed boolean PRIMARY KEY DEFAULT true CHECK (sealed)
);
REVOKE ALL ON TABLE amg_guard.journal_sealed FROM PUBLIC;

-- Tables « scellées » : porteuses du déclencheur de ligne du journal (par son nom ou sa fonction).
CREATE OR REPLACE FUNCTION amg_guard.sealed_journals() RETURNS SETOF oid
  LANGUAGE sql STABLE
  SET search_path = pg_catalog, pg_temp
AS $$
  SELECT DISTINCT t.tgrelid FROM pg_catalog.pg_trigger t
   WHERE t.tgname = 'security_events_append_only_row'
      OR (t.tgfoid = pg_catalog.to_regprocedure('amg_guard.security_events_append_only()')
          AND (t.tgtype & 1) = 1)
$$;

-- Premier écart à l'état attendu, sur toutes les tables scellées ; NULL si tout est conforme.
CREATE OR REPLACE FUNCTION amg_guard.security_events_violation() RETURNS text
  LANGUAGE plpgsql STABLE
  SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  row_trigger CONSTANT name := 'security_events_append_only_row';
  truncate_trigger CONSTANT name := 'security_events_append_only_truncate';
  -- Valeurs de security_event_type à la migration initiale, dans leur ordre (figées ; les ajouts
  -- ultérieurs n'ont pas à figurer ici).
  base_labels CONSTANT text[] := ARRAY[
    'LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'ACCOUNT_LOCKED', 'LOGOUT', 'MFA_SUCCEEDED', 'MFA_FAILED',
    'MFA_ENROLLED', 'MFA_RESET', 'RECOVERY_CODE_USED', 'RECOVERY_CODES_REGENERATED',
    'ENROLLMENT_CODE_ISSUED', 'ACTIVATION_LINK_ISSUED', 'ACTIVATION_LINK_CONSUMED',
    'PASSWORD_CHANGED', 'EMAIL_CHANGED', 'ACCOUNT_DISABLED', 'SESSION_REVOKED',
    'SESSIONS_REVOKED_ALL', 'ACCESS_DENIED', 'CSRF_REJECTED', 'RATE_LIMITED', 'NEW_DEVICE_ALERT'];
  -- Colonnes NOT NULL de la migration initiale (ni plus, ni moins : un NOT NULL de plus, sur
  -- user_id par exemple, censurerait les événements sans compte).
  not_null_columns CONSTANT text[] := ARRAY['id', 'occurred_at', 'type'];
  -- Définition de la contrainte CHECK du journal, telle que PostgreSQL la restitue.
  details_check CONSTANT text :=
    'CHECK (((details IS NULL) OR ((jsonb_typeof(details) = ''object''::text) AND (octet_length((details)::text) <= 2048))))';
  append_only oid := to_regprocedure('amg_guard.security_events_append_only()');
  app_role oid := to_regrole('amg_app');
  event_type oid := to_regtype('public.security_event_type');
  -- PostgreSQL 18 enregistre les NOT NULL dans pg_constraint (contype 'n'), pas les versions
  -- antérieures.
  not_null_constraints CONSTANT boolean := current_setting('server_version_num')::integer >= 180000;
  journal oid;
  label text;
  matched integer;
BEGIN
  IF append_only IS NULL
     OR NOT EXISTS (SELECT FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_roles r ON r.oid = p.proowner
                     WHERE p.oid = append_only AND r.rolsuper AND NOT p.prosecdef) THEN
    RETURN 'fonction du déclencheur du journal absente ou altérée';
  END IF;

  -- Scellé une fois, scellé toujours.
  IF EXISTS (SELECT FROM amg_guard.journal_sealed)
     AND (to_regclass('public.security_events') IS NULL
          OR to_regclass('public.security_events') NOT IN (SELECT amg_guard.sealed_journals())) THEN
    RETURN 'journal supprimé, remplacé ou descellé';
  END IF;

  FOR journal IN SELECT amg_guard.sealed_journals() LOOP
    IF journal IS DISTINCT FROM to_regclass('public.security_events') THEN
      RETURN 'table du journal renommée ou remplacée';
    END IF;

    -- Clé étrangère vers le journal : ses déclencheurs internes (ON DELETE …) bloqueraient ou
    -- étendraient la purge.
    IF EXISTS (SELECT FROM pg_catalog.pg_constraint k WHERE k.confrelid = journal) THEN
      RETURN 'clé étrangère vers le journal';
    END IF;

    -- Déclencheur de ligne exact : BEFORE INSERT OR UPDATE OR DELETE FOR EACH ROW (1+2+4+8+16) ;
    -- aucun autre que lui et celui de TRUNCATE : BEFORE FOR EACH STATEMENT (2+32). Les
    -- déclencheurs internes (clés étrangères, contraintes différables) sont comptés : le journal
    -- migré n'en a aucun.
    IF NOT EXISTS (
         SELECT FROM pg_catalog.pg_trigger t
          WHERE t.tgrelid = journal AND t.tgname = row_trigger AND t.tgfoid = append_only
            AND NOT t.tgisinternal AND t.tgconstraint = 0
            AND t.tgtype = 31 AND t.tgenabled IN ('O', 'A') AND t.tgqual IS NULL
            AND t.tgnargs = 0 AND cardinality(t.tgattr::int2[]) = 0)
       OR EXISTS (
         SELECT FROM pg_catalog.pg_trigger t
          WHERE t.tgrelid = journal
            AND NOT (t.tgfoid = append_only AND NOT t.tgisinternal AND t.tgconstraint = 0
                     AND t.tgenabled IN ('O', 'A') AND t.tgqual IS NULL
                     AND t.tgnargs = 0 AND cardinality(t.tgattr::int2[]) = 0
                     AND ((t.tgname = row_trigger AND t.tgtype = 31)
                          OR (t.tgname = truncate_trigger AND t.tgtype = 34)))) THEN
      RETURN 'déclencheurs modifiés';
    END IF;

    IF EXISTS (SELECT FROM pg_catalog.pg_rewrite r WHERE r.ev_class = journal)
       OR EXISTS (SELECT FROM pg_catalog.pg_inherits i WHERE i.inhrelid = journal OR i.inhparent = journal)
       OR EXISTS (SELECT FROM pg_catalog.pg_policy p WHERE p.polrelid = journal)
       OR EXISTS (SELECT FROM pg_catalog.pg_class c
                   WHERE c.oid = journal AND (c.relrowsecurity OR c.relforcerowsecurity OR c.relkind <> 'r')) THEN
      RETURN 'règles, héritage ou RLS';
    END IF;

    -- Contraintes : clé primaire sur `id`, CHECK des détails (définition figée), et sous
    -- PostgreSQL 18 les NOT NULL des colonnes attendues ; toutes validées, aucune autre (ni CHECK
    -- … NOT VALID, ni clé étrangère, ni unicité, ni exclusion, ni déclencheur de contrainte).
    IF EXISTS (
         SELECT FROM pg_catalog.pg_constraint k
          WHERE k.conrelid = journal
            AND NOT (k.convalidated AND NOT k.condeferrable
                     AND ((k.contype = 'p' AND k.conname = 'security_events_pkey'
                           AND k.conkey = ARRAY[(SELECT a.attnum FROM pg_catalog.pg_attribute a
                                                  WHERE a.attrelid = journal AND a.attname = 'id')])
                          OR (k.contype = 'c' AND k.conname = 'security_events_details_check'
                              AND pg_catalog.pg_get_constraintdef(k.oid) = details_check)
                          OR (k.contype = 'n' AND not_null_constraints
                              AND cardinality(k.conkey) = 1
                              AND (SELECT a.attname::text FROM pg_catalog.pg_attribute a
                                    WHERE a.attrelid = journal AND a.attnum = k.conkey[1])
                                  = ANY (not_null_columns)))))
       OR (SELECT count(*) FROM pg_catalog.pg_constraint k
            WHERE k.conrelid = journal AND k.contype IN ('p', 'c')) <> 2
       OR (not_null_constraints
           AND (SELECT count(*) FROM pg_catalog.pg_constraint k
                 WHERE k.conrelid = journal AND k.contype = 'n') <> cardinality(not_null_columns))
       OR (SELECT coalesce(array_agg(a.attname::text ORDER BY a.attname), '{}')
             FROM pg_catalog.pg_attribute a
            WHERE a.attrelid = journal AND a.attnum > 0 AND NOT a.attisdropped AND a.attnotnull)
          IS DISTINCT FROM ARRAY(SELECT unnest(not_null_columns) ORDER BY 1) THEN
      RETURN 'contraintes modifiées';
    END IF;

    -- Droits : ACL explicite (NULL = droits par défaut, donc aucun pour amg_app) ; bénéficiaires
    -- limités au propriétaire et à amg_app (PUBLIC a l'OID 0) ; amg_app : SELECT et INSERT, sans
    -- option de transmission ; aucun droit de colonne.
    IF app_role IS NULL
       OR EXISTS (SELECT FROM pg_catalog.pg_class c WHERE c.oid = journal AND c.relacl IS NULL)
       OR EXISTS (
         SELECT FROM pg_catalog.pg_class c, LATERAL pg_catalog.aclexplode(c.relacl) a
          WHERE c.oid = journal
            AND (a.grantee NOT IN (c.relowner, app_role) OR (a.grantee = app_role AND a.is_grantable)))
       OR (SELECT coalesce(array_agg(a.privilege_type::text ORDER BY a.privilege_type), '{}')
             FROM pg_catalog.pg_class c, LATERAL pg_catalog.aclexplode(c.relacl) a
            WHERE c.oid = journal AND a.grantee = app_role) IS DISTINCT FROM ARRAY['INSERT', 'SELECT']
       OR EXISTS (SELECT FROM pg_catalog.pg_attribute a
                   WHERE a.attrelid = journal AND a.attnum > 0 AND a.attacl IS NOT NULL) THEN
      RETURN 'droits modifiés';
    END IF;

    IF EXISTS (
         SELECT FROM pg_catalog.pg_index i
          WHERE i.indrelid = journal
            AND ((i.indisunique AND NOT i.indisprimary) OR i.indisexclusion
                 OR i.indexprs IS NOT NULL OR i.indpred IS NOT NULL)) THEN
      RETURN 'index unique, partiel, sur expression ou d''exclusion';
    END IF;

    IF event_type IS NULL OR NOT EXISTS (
         SELECT FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = journal AND a.attname = 'type' AND NOT a.attisdropped
            AND a.atttypid = event_type) THEN
      RETURN 'type de la colonne « type » modifié';
    END IF;
    -- Valeurs de la migration initiale : sous-suite ordonnée des valeurs actuelles.
    matched := 1;
    FOR label IN
      SELECT e.enumlabel::text FROM pg_catalog.pg_enum e WHERE e.enumtypid = event_type
       ORDER BY e.enumsortorder
    LOOP
      IF matched <= cardinality(base_labels) AND label = base_labels[matched] THEN
        matched := matched + 1;
      END IF;
    END LOOP;
    IF matched <= cardinality(base_labels) THEN
      RETURN 'valeurs de security_event_type renommées ou réordonnées';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION amg_guard.protect_security_events() RETURNS event_trigger
  LANGUAGE plpgsql
  SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  violation text;
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
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'insufficient_privilege',
        MESSAGE = 'journal de sécurité : suppression réservée au superutilisateur';
    END IF;
    RETURN;
  END IF;

  -- ddl_command_end, une fois le journal scellé : commande visant une table scellée…
  IF EXISTS (SELECT FROM amg_guard.sealed_journals()) AND EXISTS (
    SELECT FROM pg_catalog.pg_event_trigger_ddl_commands() AS c
     WHERE c.classid = 'pg_catalog.pg_class'::regclass::oid
       AND c.objid IN (SELECT amg_guard.sealed_journals())
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'insufficient_privilege',
      MESSAGE = 'journal de sécurité : modification de la table réservée au superutilisateur';
  END IF;

  -- … puis, quelle que soit la commande, état du journal.
  violation := amg_guard.security_events_violation();
  IF violation IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'insufficient_privilege',
      MESSAGE = format('journal de sécurité : %s, réservé au superutilisateur', violation);
  END IF;
END;
$$;

-- Fonctions de contrôle : appelables par le rôle des migrations (via le déclencheur d'événement),
-- par personne d'autre. La fonction du déclencheur d'événement n'est jamais appelable directement ;
-- celle du journal l'est par le rôle des migrations pour CREATE TRIGGER seulement (une fonction de
-- déclencheur ne s'appelle pas hors d'un déclencheur).
REVOKE ALL ON FUNCTION amg_guard.security_events_append_only() FROM PUBLIC;
REVOKE ALL ON FUNCTION amg_guard.sealed_journals() FROM PUBLIC;
REVOKE ALL ON FUNCTION amg_guard.security_events_violation() FROM PUBLIC;
REVOKE ALL ON FUNCTION amg_guard.protect_security_events() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION amg_guard.security_events_append_only() TO amg_migrator;
GRANT EXECUTE ON FUNCTION amg_guard.sealed_journals() TO amg_migrator;
GRANT EXECUTE ON FUNCTION amg_guard.security_events_violation() TO amg_migrator;
GRANT SELECT ON TABLE amg_guard.journal_sealed TO amg_migrator;

-- Créés s'ils manquent (sans fenêtre où la protection disparaît au rejeu), puis réactivés (fin
-- d'une fenêtre de migration du journal ou d'une restauration).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_event_trigger
                  WHERE evtname OPERATOR(pg_catalog.=) 'amg_guard_security_events') THEN
    CREATE EVENT TRIGGER amg_guard_security_events ON ddl_command_end
      EXECUTE FUNCTION amg_guard.protect_security_events();
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_event_trigger
                  WHERE evtname OPERATOR(pg_catalog.=) 'amg_guard_security_events_drop') THEN
    CREATE EVENT TRIGGER amg_guard_security_events_drop ON sql_drop
      EXECUTE FUNCTION amg_guard.protect_security_events();
  END IF;
END
$$;
ALTER EVENT TRIGGER amg_guard_security_events ENABLE;
ALTER EVENT TRIGGER amg_guard_security_events_drop ENABLE;

COMMIT;

-- Vérification finale, APRÈS la validation : les rôles, droits et déclencheurs d'événement ci-dessus
-- restent appliqués (protection réactivée, donc toute commande DDL d'amg_migrator refusée tant que
-- le journal n'est pas conforme), et un journal non conforme fait échouer le rejeu (code de sortie
-- de psql non nul avec ON_ERROR_STOP). Lecture des catalogues seulement : aucun code d'amg_migrator
-- n'est exécuté par le superutilisateur (chemin épinglé en tête de fichier, appels qualifiés).
-- Avant la migration initiale : rien à vérifier. Une table `public.security_events` présente mais
-- non scellée est un écart (journal descellé pendant une fenêtre, ou migration incomplète) ; un
-- journal conforme et scellé pose le marqueur « scellé une fois, scellé toujours ».
DO $$
DECLARE
  violation text := amg_guard.security_events_violation();
  journal oid := pg_catalog.to_regclass('public.security_events');
  sealed boolean := EXISTS (SELECT FROM amg_guard.sealed_journals());
BEGIN
  IF violation IS NULL AND journal IS NOT NULL
     AND NOT EXISTS (SELECT FROM amg_guard.sealed_journals() AS s(relid)
                      WHERE s.relid OPERATOR(pg_catalog.=) journal) THEN
    violation := 'table présente mais non scellée';
  END IF;
  IF violation IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'insufficient_privilege',
      MESSAGE = pg_catalog.format('journal de sécurité non conforme : %s', violation);
  END IF;
  IF sealed THEN
    INSERT INTO amg_guard.journal_sealed DEFAULT VALUES ON CONFLICT DO NOTHING;
  END IF;
END
$$;
