-- Rôle dédié au journal de sécurité (ADR-0023, lot 3 du CRM 3) : `amg_journal`, créé par
-- sql/roles.sql (à rejouer AVANT cette migration), devient le seul écrivain de `security_events` ;
-- le rôle de l'API `amg_app` garde la lecture seule. Chaque événement est écrit par un INSERT seul,
-- en autocommit, sur le pool dédié de l'API, où aucun code du propriétaire des tables ne s'exécute.
--
-- Ordre imposé par le contrôle du journal (amg_guard.security_events_violation, déclencheurs
-- d'événement actifs pendant la fenêtre ordinaire) : le journal ne doit jamais rester sans
-- écrivain. D'abord l'accord au rôle du journal (deux écrivains, état de transition admis), puis le
-- retrait à `amg_app` (état final). Le rejeu de roles.sql qui suit la fenêtre constate l'état final
-- et pose le cliquet `amg_guard.journal_writer_split` : l'état d'origine est ensuite refusé.
-- Aucun changement de schema.prisma (droits seulement). Retour arrière : nouvelle migration et
-- intervention du superutilisateur sur le cliquet (docs/EXPLOITATION.md §11).

GRANT SELECT, INSERT ON TABLE "security_events" TO "amg_journal";

REVOKE INSERT ON TABLE "security_events" FROM "amg_app";
