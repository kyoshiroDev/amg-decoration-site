# ADR-0022 — Fichiers déposés : reconstruction du contenu plutôt qu'antivirus

- **Statut** : acceptée
- **Date** : 2026-11-25

## Contexte

Les clients et Amandine échangent des fichiers dans les CRM (ADR-0019) : surtout des **photos** et des **plans PDF**, mais aussi des **vidéos** (réponse de l'humain). L'ADR-0020 prévoyait ClamAV pour analyser chaque dépôt. Or ClamAV garde ses signatures en mémoire (environ 3 Gio), et AMG ne doit **jamais dépasser 4 Gio** au total sur le VPS partagé (exigence de l'humain, plafond dur par slice systemd). ClamAV n'y tient pas.

Un antivirus à signatures ne reconnaît que les menaces déjà connues. Pour des images, des PDF et des vidéos, l'attaque passe surtout par un fichier malformé ou par du contenu actif (JavaScript de PDF, pièce jointe, polyglotte). Ces deux vecteurs disparaissent si le fichier gardé est **reconstruit** à partir de son seul contenu utile.

## Décision

**Désarmement et reconstruction de contenu** (CDR), sans antivirus pour le moment. Validée par l'humain le 2026-11-25.

1. **Liste fermée de formats**, type établi d'après le **contenu** (signature binaire), jamais d'après l'extension ou le `Content-Type` envoyé :
   - photos : JPEG, PNG, WebP, HEIC/HEIF (iPhone) ;
   - plans : PDF ;
   - vidéos : MP4/MOV (H.264, H.265), WebM.

   Tout le reste est refusé (archives, documents bureautiques, exécutables, SVG…). Taille, dimensions et durée maximales fixées à CRM 5.

2. **Photos** : décodées puis ré-encodées en un fichier neuf (bibliothèque d'images du worker), **sans métadonnées** (EXIF, dont la position GPS : protection de la vie privée des clients), dimensions plafonnées.
3. **PDF** : refus de tout PDF contenant du JavaScript, des actions automatiques (`OpenAction`, `Launch`, `AA`), des fichiers joints, des formulaires XFA ou un chiffrement ; les autres sont réécrits par un outil de normalisation (structure reconstruite, objets inutiles supprimés).
4. **Vidéos** : ré-encodées (transcodage complet, pas un simple changement de conteneur) en MP4 H.264/AAC de résolution plafonnée, métadonnées supprimées ; durée et taille maximales. Le transcodage est la tâche la plus lourde : une seule à la fois, priorité basse.
5. **Isolement du traitement** : les décodeurs (images, PDF, vidéo) sont la surface d'attaque. Ils tournent dans un conteneur de traitement dédié, sans réseau, système de fichiers en lecture seule, sans capacités, non root, avec limites de mémoire, de CPU, de processus et de durée, dans le budget AMG. L'original n'est jamais servi ; il est supprimé après reconstruction (ou mis en quarantaine en cas de refus, puis supprimé).
6. **Distribution** : stockage hors de toute racine web, accès par lien temporaire signé après contrôle des droits, `Content-Disposition: attachment` (sauf aperçu d'image reconstruite), `X-Content-Type-Options: nosniff`, CSP `sandbox` sur les réponses de fichiers.

### Exigences de mise en œuvre (audit `securite` du 2026-11-25)

- **Jamais de socket Docker dans le worker** (équivalent root sur l'hôte partagé) : le conteneur de traitement est un service permanent qui reçoit ses tâches par un volume dédié (entrée / sortie), pas un conteneur lancé par le worker.
- **Un processus par fichier**, avec durée maximale : un décodeur compromis ne survit pas d'un fichier à l'autre. Aucun secret monté dans le conteneur de traitement.
- **Images** : dimensions lues dans l'en-tête et contrôlées **avant** le décodage (bombes de décompression, limite de pixels).
- **Vidéos** : démultiplexeur imposé d'après la signature, seul le protocole « fichier » autorisé ; listes de lecture (HLS) et concaténation refusées (lecture de fichiers locaux incrustés dans la sortie). Mémoire réelle du transcodage mesurée avant de fixer la limite.
- **PDF** : la normalisation reconstruit la structure mais garde polices et flux d'images, principaux vecteurs contre les lecteurs PDF. Le PDF normalisé n'est proposé qu'en téléchargement (`attachment`) ; l'aperçu dans l'interface se fait à partir d'une version rastérisée (images des pages).
- **Bibliothèques de décodage** (dont HEIC/H.265, à failles fréquentes) tenues à jour et analysées par Trivy à chaque build.
- **Quarantaine** : durée courte fixée, jamais sauvegardée.
- **Distribution** depuis un sous-domaine distinct sans cookie, en plus de `nosniff` et de la CSP `sandbox`.
- Le conteneur de traitement est dans le plafond mémoire d'AMG, et c'est lui que le noyau sacrifie en premier en cas de manque (priorité d'OOM élevée).

## Alternatives écartées

- **ClamAV en démon** : environ 3 Gio de mémoire, hors budget.
- **ClamAV à la demande** (`clamscan` sans démon) : recharge les signatures à chaque fichier (pic d'environ 1 Gio, plusieurs secondes), risque de dépasser le plafond pendant une bascule ou une sauvegarde.
- **Service d'analyse en ligne** : envoie les fichiers des clients (photos de leur intérieur, plans) à un tiers ; contraire à la minimisation RGPD et coûteux.

## Conséquences

- Risque résiduel accepté : un document techniquement propre peut contenir un lien vers un site malveillant (comme tout email) ; l'appareil d'Amandine garde son propre antivirus.
- Le transcodage vidéo consomme du CPU : file d'attente à une tâche, plafond de durée, et la vidéo n'est visible qu'une fois reconstruite (état « en traitement » dans l'interface).
- ClamAV pourra être ajouté **en plus** si la mémoire disponible le permet un jour, sans changer le reste de la chaîne.
- Formats, limites et outils exacts (bibliothèques, versions) sont fixés et testés à CRM 5, avec audit `securite` (fichiers piégés de test : polyglottes, PDF à JavaScript, images malformées, vidéos tronquées).
