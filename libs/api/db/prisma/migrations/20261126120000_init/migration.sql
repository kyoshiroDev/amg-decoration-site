-- Migration initiale du CRM 3 (ADR-0023) : comptes, liens d'activation, TOTP, codes de secours et
-- d'enrôlement, journal de sécurité. Appliquée par le rôle `amg_migrator` (propriétaire des objets),
-- après sql/roles.sql (qui crée `amg_migrator` et `amg_app`). Jamais modifiée après fusion sur main :
-- tout changement passe par une nouvelle migration (contrôle CI).
--
-- Partie 1 : SQL produit par `prisma migrate diff --from-empty --to-schema` (sans `CREATE SCHEMA`,
-- le schéma public existe et le rôle des migrations n'a pas le droit de créer de schéma).
-- Partie 2 : invariants que Prisma ne sait pas exprimer (CHECK, index uniques partiels, déclencheurs
-- des liens à usage unique et du journal) et droits du rôle de l'API, table par table. Toute
-- nouvelle table doit déclarer ses droits de la même façon (tests/integration/privileges.test.ts
-- échoue sinon).

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'CLIENT');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('INVITED', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "activation_purpose" AS ENUM ('INVITATION', 'INVITATION_RESEND', 'PASSWORD_RESET', 'MFA_RESET');

-- CreateEnum
CREATE TYPE "security_event_type" AS ENUM ('LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'ACCOUNT_LOCKED', 'LOGOUT', 'MFA_SUCCEEDED', 'MFA_FAILED', 'MFA_ENROLLED', 'MFA_RESET', 'RECOVERY_CODE_USED', 'RECOVERY_CODES_REGENERATED', 'ENROLLMENT_CODE_ISSUED', 'ACTIVATION_LINK_ISSUED', 'ACTIVATION_LINK_CONSUMED', 'PASSWORD_CHANGED', 'EMAIL_CHANGED', 'ACCOUNT_DISABLED', 'SESSION_REVOKED', 'SESSIONS_REVOKED_ALL', 'ACCESS_DENIED', 'CSRF_REJECTED', 'RATE_LIMITED', 'NEW_DEVICE_ALERT');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "email" VARCHAR(254) NOT NULL,
    "role" "user_role" NOT NULL,
    "status" "user_status" NOT NULL DEFAULT 'INVITED',
    "display_name" VARCHAR(120) NOT NULL,
    "password_hash" VARCHAR(255),
    "password_changed_at" TIMESTAMPTZ(3),
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activation_tokens" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "purpose" "activation_purpose" NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "issued_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activation_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "totp_factors" (
    "user_id" UUID NOT NULL,
    "secret_ciphertext" BYTEA NOT NULL,
    "secret_iv" BYTEA NOT NULL,
    "secret_auth_tag" BYTEA NOT NULL,
    "key_version" INTEGER NOT NULL,
    "confirmed_at" TIMESTAMPTZ(3),
    "last_used_step" BIGINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "totp_factors_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "recovery_codes" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "code_hmac" BYTEA NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment_codes" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "code_hmac" BYTEA NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollment_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "security_event_type" NOT NULL,
    "user_id" UUID,
    "actor_id" UUID,
    "ip" INET,
    "device" VARCHAR(160),
    "details" JSONB,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "activation_tokens_user_id_idx" ON "activation_tokens"("user_id");

-- CreateIndex
CREATE INDEX "activation_tokens_issued_by_id_idx" ON "activation_tokens"("issued_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "activation_tokens_token_hash_key" ON "activation_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_codes_user_id_code_hmac_key" ON "recovery_codes"("user_id", "code_hmac");

-- CreateIndex
CREATE INDEX "enrollment_codes_user_id_idx" ON "enrollment_codes"("user_id");

-- CreateIndex
CREATE INDEX "security_events_user_id_occurred_at_idx" ON "security_events"("user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "security_events_type_occurred_at_idx" ON "security_events"("type", "occurred_at");

-- CreateIndex
CREATE INDEX "security_events_occurred_at_idx" ON "security_events"("occurred_at");

-- AddForeignKey
ALTER TABLE "activation_tokens" ADD CONSTRAINT "activation_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activation_tokens" ADD CONSTRAINT "activation_tokens_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "totp_factors" ADD CONSTRAINT "totp_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_codes" ADD CONSTRAINT "enrollment_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------------------------
-- Partie 2a : invariants (CHECK). Prisma ne les gère pas mais ne les supprime pas.
-- ---------------------------------------------------------------------------------------------

-- Email normalisé comme le fait `emailSchema` (espaces retirés, minuscules) : une même adresse ne
-- peut exister deux fois sous deux casses. Mot de passe : Argon2id seulement, absent tant que le
-- compte est invité.
ALTER TABLE "users"
  ADD CONSTRAINT "users_email_normalized_check" CHECK ("email" = lower(btrim("email")) AND char_length("email") >= 3 AND strpos("email", '@') > 1),
  ADD CONSTRAINT "users_display_name_check" CHECK (char_length(btrim("display_name")) >= 1),
  ADD CONSTRAINT "users_password_hash_check" CHECK ("password_hash" IS NULL OR "password_hash" LIKE '$argon2id$%'),
  ADD CONSTRAINT "users_invited_without_password_check" CHECK ("status" <> 'INVITED' OR "password_hash" IS NULL),
  ADD CONSTRAINT "users_failed_login_count_check" CHECK ("failed_login_count" >= 0);

-- Lien d'activation : SHA-256 (32 octets), durée bornée par usage (7 jours pour l'invitation,
-- 72 heures pour les renvois et réinitialisations), consommé ou révoqué, jamais les deux. Durées en
-- heures (indépendantes du fuseau et des changements d'heure), avec une minute de tolérance :
-- `created_at` est l'heure de début de la transaction, l'échéance est calculée un peu plus tard.
ALTER TABLE "activation_tokens"
  ADD CONSTRAINT "activation_tokens_token_hash_check" CHECK (octet_length("token_hash") = 32),
  ADD CONSTRAINT "activation_tokens_lifetime_check" CHECK (
    "expires_at" > "created_at"
    AND "expires_at" <= "created_at" + CASE "purpose" WHEN 'INVITATION' THEN interval '168 hours 1 minute' ELSE interval '72 hours 1 minute' END
  ),
  ADD CONSTRAINT "activation_tokens_consumed_check" CHECK ("consumed_at" IS NULL OR "consumed_at" >= "created_at"),
  ADD CONSTRAINT "activation_tokens_single_outcome_check" CHECK ("consumed_at" IS NULL OR "revoked_at" IS NULL);

-- Secret TOTP chiffré en AES-256-GCM : IV de 96 bits, étiquette de 128 bits, secret de 16 à 64 octets.
ALTER TABLE "totp_factors"
  ADD CONSTRAINT "totp_factors_secret_iv_check" CHECK (octet_length("secret_iv") = 12),
  ADD CONSTRAINT "totp_factors_secret_auth_tag_check" CHECK (octet_length("secret_auth_tag") = 16),
  ADD CONSTRAINT "totp_factors_secret_ciphertext_check" CHECK (octet_length("secret_ciphertext") BETWEEN 16 AND 64),
  ADD CONSTRAINT "totp_factors_key_version_check" CHECK ("key_version" >= 1),
  ADD CONSTRAINT "totp_factors_last_used_step_check" CHECK ("last_used_step" IS NULL OR "last_used_step" >= 0);

-- Codes de secours et d'enrôlement : HMAC-SHA-256 (32 octets) ; code d'enrôlement valable 30 minutes
-- au plus (même tolérance d'une minute).
ALTER TABLE "recovery_codes"
  ADD CONSTRAINT "recovery_codes_code_hmac_check" CHECK (octet_length("code_hmac") = 32);

ALTER TABLE "enrollment_codes"
  ADD CONSTRAINT "enrollment_codes_code_hmac_check" CHECK (octet_length("code_hmac") = 32),
  ADD CONSTRAINT "enrollment_codes_lifetime_check" CHECK ("expires_at" > "created_at" AND "expires_at" <= "created_at" + interval '31 minutes'),
  ADD CONSTRAINT "enrollment_codes_single_outcome_check" CHECK ("consumed_at" IS NULL OR "revoked_at" IS NULL);

-- Journal : détails en objet JSON de 2 Kio au plus (aucun document, aucune donnée de projet).
ALTER TABLE "security_events"
  ADD CONSTRAINT "security_events_details_check" CHECK ("details" IS NULL OR (jsonb_typeof("details") = 'object' AND octet_length("details"::text) <= 2048));


-- ---------------------------------------------------------------------------------------------
-- Partie 2b : liens d'activation et codes d'enrôlement (ADR-0023). Les dates sont celles de la
-- base, jamais celles fournies par l'application ; un lien ou un code naît vivant, ne peut qu'être
-- consommé ou révoqué, une seule fois, et rien d'autre ne change ensuite.
-- ---------------------------------------------------------------------------------------------

-- Un seul lien vivant (ni consommé, ni révoqué) par compte, et un seul code d'enrôlement vivant :
-- l'émission révoque d'abord, dans la même transaction, tous les liens non consommés du compte, y
-- compris expirés (lot 4). Deux émissions simultanées : la seconde échoue (23505) au lieu de laisser
-- deux liens valides. Index partiels hors de schema.prisma : Prisma 7 les ignore à l'introspection
-- (sans l'aperçu `partialIndexes`, qui en ferait à tort un critère unique du client), donc ni
-- dérive ni suppression par `migrate diff`.
CREATE UNIQUE INDEX "activation_tokens_one_live_per_user_key" ON "activation_tokens" ("user_id")
  WHERE "consumed_at" IS NULL AND "revoked_at" IS NULL;

CREATE UNIQUE INDEX "enrollment_codes_one_live_per_user_key" ON "enrollment_codes" ("user_id")
  WHERE "consumed_at" IS NULL AND "revoked_at" IS NULL;

-- Commun aux deux tables (mêmes colonnes created_at, expires_at, consumed_at, revoked_at).
--   INSERT : `created_at` := now() (impossible d'antidater ou de post-dater, les CHECK de durée
--            portent donc sur l'heure de la base) ; consommé ou révoqué dès l'insertion : refusé.
--   UPDATE : seules `consumed_at` et `revoked_at` peuvent passer de NULL à une date, une seule fois,
--            fixée à now() ; un lien expiré à l'heure de l'instruction (statement_timestamp(), pas
--            now() : une transaction ouverte avant l'échéance ne consomme pas un lien expiré depuis)
--            ne peut pas être consommé ; `issued_by_id` ne peut que devenir NULL (ON DELETE SET NULL
--            à la suppression de l'admin émetteur) ; toute autre colonne est figée. Le rôle de l'API
--            n'a de toute façon l'UPDATE que sur ces deux colonnes.
-- Colonnes figées : la comparaison porte sur TOUTE la ligne (to_jsonb), sauf la liste d'exceptions
-- ci-dessous. Une future colonne qui doit être modifiable par UPDATE (et non seulement remplie à
-- l'insertion) devra y être ajoutée, par une nouvelle migration qui remplace cette fonction, avec
-- ses propres règles (sinon toute mise à jour de la ligne échoue).
CREATE FUNCTION "single_use_credential_guard"() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."consumed_at" IS NOT NULL OR NEW."revoked_at" IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'check_violation',
        MESSAGE = format('%s : un élément ne peut être créé déjà consommé ou révoqué', TG_TABLE_NAME);
    END IF;
    NEW."created_at" := now();
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - ARRAY['consumed_at', 'revoked_at', 'issued_by_id'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['consumed_at', 'revoked_at', 'issued_by_id'])
     OR ((to_jsonb(NEW) -> 'issued_by_id') IS DISTINCT FROM (to_jsonb(OLD) -> 'issued_by_id')
         AND (to_jsonb(NEW) -> 'issued_by_id') <> 'null'::jsonb) THEN
    RAISE EXCEPTION USING ERRCODE = 'insufficient_privilege',
      MESSAGE = format('%s : seules la consommation et la révocation sont modifiables', TG_TABLE_NAME);
  END IF;

  IF (OLD."consumed_at" IS NOT NULL AND NEW."consumed_at" IS DISTINCT FROM OLD."consumed_at")
     OR (OLD."revoked_at" IS NOT NULL AND NEW."revoked_at" IS DISTINCT FROM OLD."revoked_at") THEN
    RAISE EXCEPTION USING ERRCODE = 'insufficient_privilege',
      MESSAGE = format('%s : consommation et révocation sont définitives', TG_TABLE_NAME);
  END IF;

  IF OLD."consumed_at" IS NULL AND NEW."consumed_at" IS NOT NULL THEN
    IF OLD."expires_at" <= statement_timestamp() THEN
      RAISE EXCEPTION USING ERRCODE = 'check_violation',
        MESSAGE = format('%s : élément expiré, consommation refusée', TG_TABLE_NAME);
    END IF;
    NEW."consumed_at" := now();
  END IF;
  IF OLD."revoked_at" IS NULL AND NEW."revoked_at" IS NOT NULL THEN
    NEW."revoked_at" := now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION "single_use_credential_guard"() FROM PUBLIC;

CREATE TRIGGER "activation_tokens_single_use_guard"
  BEFORE INSERT OR UPDATE ON "activation_tokens"
  FOR EACH ROW EXECUTE FUNCTION "single_use_credential_guard"();

CREATE TRIGGER "enrollment_codes_single_use_guard"
  BEFORE INSERT OR UPDATE ON "enrollment_codes"
  FOR EACH ROW EXECUTE FUNCTION "single_use_credential_guard"();

-- ---------------------------------------------------------------------------------------------
-- Partie 2c : journal de sécurité en ajout seul, pour tous les rôles non superutilisateurs (le
-- rôle de l'API n'a de toute façon ni UPDATE ni DELETE). Date et identifiant sont ceux de la base,
-- jamais ceux fournis par l'application. Suppression admise seulement au-delà de la rétention de
-- 12 mois (purge, lot 5). Le propriétaire de la table (`amg_migrator`) pourrait désactiver,
-- remplacer ou supprimer ce déclencheur : le déclencheur d'événement `amg_guard_security_events`
-- (sql/roles.sql, créé par le superutilisateur) le lui interdit. Seul un superutilisateur peut
-- passer outre (accès SSH de l'exploitant, incident documenté).
-- Une restauration pg_restore crée les déclencheurs après les données : les dates restaurées sont conservées.
-- Les droits de `amg_app` sur le journal sont accordés AVANT ses déclencheurs : dès que le
-- déclencheur de ligne existe, le déclencheur d'événement exige après chaque commande DDL que
-- `amg_app` ait exactement SELECT et INSERT sur la table.
-- ---------------------------------------------------------------------------------------------

GRANT SELECT, INSERT ON TABLE "security_events" TO "amg_app";

CREATE FUNCTION "security_events_append_only"() RETURNS trigger
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

REVOKE ALL ON FUNCTION "security_events_append_only"() FROM PUBLIC;

CREATE TRIGGER "security_events_append_only_row"
  BEFORE INSERT OR UPDATE OR DELETE ON "security_events"
  FOR EACH ROW EXECUTE FUNCTION "security_events_append_only"();

CREATE TRIGGER "security_events_append_only_truncate"
  BEFORE TRUNCATE ON "security_events"
  FOR EACH STATEMENT EXECUTE FUNCTION "security_events_append_only"();

-- ---------------------------------------------------------------------------------------------
-- Partie 2d : droits du rôle de l'API `amg_app` (ni DDL, ni TRUNCATE, ni accès à _prisma_migrations).
-- Liens d'activation et codes d'enrôlement : UPDATE limité aux colonnes de fin de vie.
-- ---------------------------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "users", "totp_factors", "recovery_codes" TO "amg_app";
GRANT SELECT, INSERT, DELETE ON TABLE "activation_tokens", "enrollment_codes" TO "amg_app";
GRANT UPDATE ("consumed_at", "revoked_at") ON TABLE "activation_tokens", "enrollment_codes" TO "amg_app";
-- security_events : SELECT et INSERT, accordés en partie 2c.
