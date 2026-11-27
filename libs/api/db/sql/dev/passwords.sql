-- DÉVELOPPEMENT LOCAL ET CI UNIQUEMENT. Mots de passe PUBLICS des rôles de l'API, valables seulement
-- dans compose.dev.yaml et le service postgres du job CI « API (intégration) », bases jetables
-- publiées sur 127.0.0.1 seulement (ports `127.0.0.1:5432:5432` des deux fichiers). Jamais exécuté
-- sur le serveur : en préproduction et en production, les mots de passe sont posés avec `\password`
-- et la connexion d'amg_migrator n'est ouverte que pendant une fenêtre de migration
-- (docs/EXPLOITATION.md §11). Ici, la fenêtre reste ouverte (migrations et tests sous ce rôle).
-- À exécuter après ../roles.sql, par le superutilisateur.
ALTER ROLE amg_migrator LOGIN PASSWORD 'dev-only-amg-migrator-password-public';
ALTER ROLE amg_app PASSWORD 'dev-only-amg-app-password-not-secret';
ALTER ROLE amg_journal PASSWORD 'dev-only-amg-journal-password-public';
