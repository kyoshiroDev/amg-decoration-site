-- DÉVELOPPEMENT LOCAL ET CI UNIQUEMENT. Mots de passe PUBLICS des rôles de l'API, valables seulement
-- dans compose.dev.yaml et le service postgres du job CI « API (intégration) », dont la base est
-- jetable et n'écoute que sur 127.0.0.1. Jamais exécuté sur le serveur : en préproduction et en
-- production, les mots de passe sont posés avec `\password` (docs/EXPLOITATION.md §11).
-- À exécuter après ../roles.sql, par le superutilisateur.
ALTER ROLE amg_migrator PASSWORD 'dev-only-amg-migrator-password-public';
ALTER ROLE amg_app PASSWORD 'dev-only-amg-app-password-not-secret';
