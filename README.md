# Belconnect

Projet indépendant de BX-Connect. Le frontend React est dans `frontend-web/`, l'application mobile Expo dans `mobile/`, le backend Spring Boot (Java 25) dans `backend/`, et PostgreSQL est lancé avec Docker Compose.

## Démarrer la base et le backend

Depuis ce dossier :

```bash
docker compose up -d db
cd backend
./mvnw spring-boot:run
```

La base locale écoute sur `localhost:5433` et l'API sur `http://localhost:8080`. Vérifier la connexion de l'API et de la base avec `http://localhost:8080/actuator/health` : la réponse attendue contient `"status":"UP"`.

Le schéma initial est créé automatiquement par Flyway au démarrage du backend. Il comprend les comptes, espaces organisateurs, appartenances, groupes, projets, validations et participations non financières. Les autres modules seront ajoutés par migrations ultérieures. Les identifiants de la base sont destinés au développement local uniquement ; ils doivent être remplacés dans tout autre environnement via `DB_URL`, `DB_USER` et `DB_PASSWORD`.

Pour arrêter la base sans supprimer les données :

```bash
docker compose down
```

## Démarrer le frontend

Dans un autre terminal :

```bash
cd frontend-web
npm run dev
```

L’accueil, le catalogue et les fiches chargent les activités depuis PostgreSQL via le backend. Vite redirige `/api` vers `http://127.0.0.1:8080` (aussi en mode preview). Démarrer le backend avant d’ouvrir le frontend. Si l’API est indisponible, un message permet de réessayer ; aucun jeu de données de secours n’est embarqué.

## Démarrer l'application mobile

Dans un autre terminal :

```bash
cd mobile
npm start
```

L'application utilise Expo SDK 57 et TypeScript. Depuis un téléphone, ouvre Expo Go et scanne le QR code affiché par le terminal, sur le même réseau Wi-Fi que le Mac. L'écran initial est encore celui du modèle Expo et n'est pas connecté à l'API.


## API Activités

- `GET /api/activities` : liste des activités publiées, détails inclus.
- `GET /api/activities/{slug}` : une activité publiée, sinon HTTP 404.
- Migration `V2__activities.sql` : table `activite`. Une ligne correspond à une activité datée, avec prix, capacité, disponibilité et informations pratiques.
- Les dates sont renvoyées dans le fuseau `Europe/Brussels`. Prix en euros. Les filtres et la pagination restent côté navigateur sur la liste chargée.
- Profil `local` par défaut : les sept exemples Stitch sont insérés par `db/demo/R__demo_activities.sql`, sans écraser les lignes déjà présentes. Images dans `frontend-web/public/images`.
- Pour une nouvelle base sans exemples, activer explicitement `SPRING_PROFILES_ACTIVE=prod` avec les identifiants de l’environnement. Cela ne supprime pas les exemples d’une base existante.
- Les comptes sont réels. Les inscriptions gratuites sont enregistrées et décomptent les places en base. Les parcours payants restent simulés. Les activités du catalogue sont des exemples, sans engagement auprès d’un organisateur réel.
- En déploiement, prévoir la redirection de `/api` vers le backend.

Consulter les activités :

```bash
docker compose exec db psql -U belconnect -d belconnect -c "SELECT slug, titre, prix, places_disponibles FROM activite ORDER BY debut;"
```

Après une modification en base, actualiser le navigateur pour recharger les données.

## Vérifications

Depuis `backend`, exécuter `./mvnw test` avec PostgreSQL démarré. Les tests utilisent le schéma isolé `belconnect_test`, sans modifier les tables applicatives de `public`. Ils couvrent les endpoints, les activités non publiées, les contraintes de prix/capacité et les dates belges.

Depuis `frontend-web`, exécuter `npm run lint` et `npm run build`.


## Comptes et sessions

Ouvrir `/connexion` pour créer un compte ou se connecter. Les comptes sont enregistrés dans `utilisateur` (migration V3 pour le prénom). Les mots de passe sont hachés avec BCrypt, coût 12 ; longueur de 12 caractères minimum à la création, maximum 72 octets UTF-8. L’adresse e-mail est normalisée en minuscules et unique.

- `GET /api/auth/csrf` : obtenir le jeton et le nom du header à transmettre aux POST.
- `POST /api/auth/register` : `firstName`, `lastName`, `email`, `password` ; crée le compte et ouvre une session (201).
- `POST /api/auth/login` : `email`, `password` ; ouvre une session (200).
- `GET /api/auth/me` : profil courant, ou 401 sans session valide.
- `POST /api/auth/logout` : ferme la session côté serveur (204).

Cookie de session `JSESSIONID` HttpOnly et SameSite=Lax, identifiant renouvelé à la connexion. Aucune clé d’authentification ni mot de passe dans le stockage du navigateur. Session retrouvée à l’actualisation, expiration après 30 minutes d’inactivité. Les sessions sont en mémoire serveur : un redémarrage du backend demande une nouvelle connexion, sans supprimer les comptes. Limite locale de 20 tentatives par minute et par adresse IP sur connexion/création. Pour une exposition publique, prévoir une limitation partagée adaptée au proxy et à plusieurs instances.

En HTTPS, définir `SESSION_COOKIE_SECURE=true` et conserver frontend/API sur la même origine. La vérification d’adresse e-mail et la réinitialisation du mot de passe ne sont pas encore implémentées ; aucun e-mail n’est envoyé. Les inscriptions gratuites sont persistantes ; les paiements restent simulés. L’application mobile reste à connecter.

Les tests d’authentification couvrent création, hash du mot de passe, adresse normalisée, doublon, validation, CSRF, renouvellement du cookie, connexion incorrecte, compte suspendu et déconnexion. Le profil de test utilise exclusivement le schéma `belconnect_test`.


## Inscriptions gratuites

Depuis une fiche gratuite : choisir 1 à 4 places, vérifier les coordonnées, puis confirmer le récapitulatif. La réservation est enregistrée dans `inscription_activite` (migration V4) et apparaît dans « Mon espace », même après actualisation ou reconnexion. Un compte peut avoir une seule réservation confirmée par activité ; les places sont regroupées dans cette réservation. L’annulation est disponible avant le début de l’activité, avec confirmation. Une réservation annulée reste dans l’historique et permet une nouvelle inscription. La modification du nombre de participants et des coordonnées est disponible avant le début de l’activité.

- `GET /api/bookings` : uniquement les inscriptions du compte actif connecté.
- `POST /api/bookings` : `activityId` (slug), `quantity` (1–4), `firstName`, `lastName`, `email`, `phone` facultatif, `acknowledged: true`. Cookie de session et jeton CSRF requis ; retourne 201.
- Vérifications serveur : compte actif, activité publiée, date future, gratuité, places suffisantes, absence de réservation existante et coordonnées valides.
- Transaction et verrou de ligne PostgreSQL : l’enregistrement et le décompte des places sont atomiques. Deux réservations concurrentes ne peuvent pas prendre la même dernière place. Une répétition renvoie 409 sans décompter de nouvelles places ; consulter Mon espace si la réponse réseau a été perdue.
- Les activités payantes ne créent aucune inscription ni réservation, même après un paiement simulé. Aucun e-mail ni billet réel n’est envoyé.

Les tests HTTP de réservation utilisent des utilisateurs et une activité temporaires dans `belconnect_test` ; ils vérifient également les accès anonymes, le CSRF, la confidentialité, les doublons, les activités passées/non publiées/payantes et la concurrence sur la dernière place.


### Annuler une inscription

Dans Mon espace, choisir « Annuler mon inscription », puis confirmer (ou garder l’inscription). `POST /api/bookings/{id}/cancel` requiert la session du propriétaire et le jeton CSRF ; réponse 204. Une réservation absente ou appartenant à un autre compte retourne 404, une activité déjà commencée retourne 409. Les comptes suspendus ne peuvent pas annuler.

Migration V5 : statut `CONFIRMEE`/`ANNULEE` et date d’annulation. L’annulation et la restitution de toutes les places sont atomiques, avec le même verrou d’activité que la création. Une requête répétée sur une inscription annulée retourne 204 sans restituer les places une seconde fois. L’unicité porte sur les inscriptions confirmées : une nouvelle réservation reste possible selon les places disponibles. L’historique est conservé et le catalogue est actualisé après annulation.

Tests supplémentaires : autre propriétaire, absence de session/CSRF, activité passée, deux annulations simultanées, réinscription et répétition de l’ancienne annulation sans affecter la nouvelle réservation.


### Modifier une inscription

Dans Mon espace, choisir « Modifier mon inscription », ajuster les places (1 à 4) et/ou les coordonnées, puis enregistrer. « Abandonner les modifications » conserve la réservation telle quelle. Les coordonnées modifiées concernent uniquement cette réservation, pas le profil du compte.

`POST /api/bookings/{id}/modify` reçoit `quantity`, `firstName`, `lastName`, `email`, `phone` facultatif et `version` (renvoyée par GET /api/bookings). L’API retourne la réservation actualisée. Session active du propriétaire et CSRF requis. La réservation doit être confirmée et l’activité publiée, gratuite et non commencée. Les données invalides retournent 400 ; une réservation appartenant à un autre compte retourne 404 ; un manque de places, une version périmée ou une réservation non modifiable retourne 409 sans modifier les données.

Migration V6 : version de réservation. Chaque modification et annulation incrémente cette version. Deux formulaires basés sur la même version ne peuvent pas s’écraser mutuellement ; recharger les inscriptions après conflit. Les places sont ajustées de la différence entre ancien et nouveau nombre, dans la même transaction que les coordonnées, sous le verrou d’activité partagé avec création/annulation. Une diminution restitue les places ; une augmentation vérifie la disponibilité actuelle. Le catalogue est rechargé après réussite.

Tests : augmentation/diminution, conservation des coordonnées, validations, accès et CSRF, activité passée/non publiée/payante, inscription annulée, version périmée et deux augmentations concurrentes visant la dernière place.


### Interface Mon espace

`/mon-espace` est la page personnelle dédiée ; `/connexion` affiche également cette page lorsque le compte est connecté. Sans session, le formulaire de connexion apparaît. Design Belconnect avec accueil personnel, résumé du profil, cartes d’inscriptions illustrées et filtres Toutes / À venir / Passées / Annulées. Les compteurs reflètent uniquement les inscriptions chargées du compte. Les coordonnées du profil sont consultables ; leur modification n’est pas encore proposée. Les coordonnées propres à chaque inscription restent modifiables dans sa carte.

Sur mobile, les inscriptions précèdent le profil. Les états sans inscription, chargement et erreur avec réessai sont prévus. Les parcours de modification, d’annulation et de connexion ont été vérifiés dans le navigateur après la refonte, ainsi que les affichages de 320 à 1440 pixels.

### Espaces, groupes et projets personnels

Dans Mon espace, la rubrique « Mes espaces et projets » consulte `GET /api/workspace` avec la session active. Elle affiche les appartenances actives aux espaces et groupes, les rôles attribués et uniquement les projets dont le compte est auteur. Les brouillons des autres auteurs ne sont jamais inclus, même pour un administrateur ou un propriétaire. Un compte neuf reste participant sans appartenance ni rôle de gestion.

Migration V7 : `appartenance_groupe` (membre ou référent, plusieurs référents possibles) rattachée à une appartenance d’espace et à un groupe du même espace ; `role_plateforme` pour la désignation explicite du propriétaire. Aucun rôle n’est attribué automatiquement et aucun endpoint public ne permet de se promouvoir. La vue propriétaire liste les espaces actifs. Les appartenances suspendues/retirées et les espaces/groupes inactifs ne sont pas affichés ; les rôles sont relus à chaque requête. Les projets personnels restent consultables après un retrait d’espace.

Les espaces et groupes restent consultables en lecture seule. La création et la modification des brouillons personnels sont disponibles ; examen par référent, validation administrative et gestion des membres restent à développer. Les rôles affichés ne constituent pas une autorisation pour de futures actions : chaque endpoint de gestion devra vérifier lui-même les permissions en base. Les tests HTTP vérifient l’absence de rôle par défaut, le périmètre des appartenances, la confidentialité des brouillons et la révocation des accès.

Vérification de cette étape : 9 tests existants et le test HTTP `WorkspaceApiTests` passent ; lint et compilation frontend réussis. Contrôle navigateur sur données fictives isolées : rôles cumulés, filtre de projet, état vide, erreur et réessai, ordinateur et mobile à 390 px sans débordement horizontal. Les données de cette vérification visuelle ne sont pas ajoutées à la base de l’application.


### Créer et reprendre un brouillon de projet

Dans « Mon espace → Mes espaces et projets », un membre actif d’un espace actif peut créer un projet. Il choisit un espace et, facultativement, un groupe actif dont il est lui-même membre. Un rôle global de propriétaire ou d’administrateur ne remplace pas une appartenance au groupe. Sans espace accessible, une explication remplace le bouton de création ; aucun rôle n’est attribué automatiquement.

Le titre (5 à 180 caractères après suppression des espaces externes) est obligatoire ; description (10 000 caractères), objectif (3 000 caractères) et dates sont facultatifs au stade du brouillon. La fin ne peut pas précéder le début. Le projet reste `BROUILLON`, jamais soumis ni publié. Les valeurs auteur, statut et visibilité ne sont pas choisies par le client. L’espace et le groupe sont conservés lors des modifications.

- `POST /api/project-drafts` : `spaceId`, `groupId` facultatif, UUID `requestId`, et `content` (`title`, `description`, `objective`, `startsOn`, `endsOn`). Renvoie le brouillon en 201. Une nouvelle tentative avec la même clé et les mêmes données retrouve le projet ; une clé réutilisée avec des données différentes retourne 409.
- `GET /api/project-drafts/{id}` : détail d’un brouillon appartenant au compte actif ; 404 pour un autre auteur, y compris administrateur ou propriétaire, ou pour un projet qui n’est plus un brouillon.
- `POST /api/project-drafts/{id}` : `version` et `content`. Vérifie à nouveau les appartenances actives, conserve le même identifiant et incrémente la version. Conflit 409 si une autre modification a été enregistrée. La mise à jour est atomique.

Les POST nécessitent session et CSRF. Migration V8 : version et clé de création unique par auteur. Les vérifications d’appartenance verrouillent les lignes pendant l’enregistrement. Un auteur ayant perdu son appartenance peut encore lire son brouillon, mais ne peut plus le modifier. Le formulaire conserve les saisies après échec et confirme l’abandon des changements non enregistrés ; il ne sauvegarde pas automatiquement. La base est la source de vérité après réouverture.

Vérifications des brouillons : 11 tests backend réussis, lint et compilation frontend réussis. Tests HTTP dans `belconnect_test` : propriétaire du brouillon, CSRF, espaces/groupes autorisés, dates, titre, répétition de création, version périmée, retrait d’appartenance et suspension du compte. Contrôles navigateur sur données fictives isolées : création, modification, réouverture, erreur réseau avec saisie conservée, abandon explicite et mise en page dans un cadre mobile de 390 px sans débordement horizontal. Aucun compte ou projet de démonstration n’a été ajouté à la base applicative pour ces contrôles.


### Soumettre un projet pour validation

Depuis le brouillon enregistré, compléter la description et l’objectif, puis choisir « Soumettre pour validation » et confirmer. Toute modification non enregistrée bloque la soumission dans le formulaire. Le serveur vérifie le compte actif, l’auteur, les appartenances actives, le statut et la version enregistrée. Le projet conserve son identifiant, passe de `BROUILLON` à `SOUMIS` et sa version est incrémentée. Il n’est pas publié et ne peut plus être modifié par l’endpoint des brouillons.

`POST /api/project-drafts/{id}/submit` reçoit `version` avec session et CSRF. La soumission va aux autres référents actifs du groupe (compte et appartenance d’espace actifs également), ou directement à l’administrateur si le projet est sans groupe ou sans autre référent actif. La destination est calculée côté serveur. Le même appel répété ou concurrent retourne la soumission existante sans créer de doublon. Une version périmée retourne 409 ; description ou objectif vide retourne 400.

Migration V9 : étape de validation, date de soumission et historique `soumission_projet`, unique par projet et version de brouillon. Le changement d’état et l’historique sont enregistrés dans la même transaction. Les anciennes lignes `SOUMIS` sans étape ne sont pas routées automatiquement.

« Mes projets » affiche l’étape d’attente et permet à l’auteur de consulter sa version soumise. `GET /api/project-reviews` fournit les projets reçus, hors propres projets de l’examinateur. Les référents voient uniquement les dossiers de leurs groupes actifs à l’étape référent ; les administrateurs voient les dossiers de leur espace actif, y compris en cours d’avis référent. `GET /api/project-reviews/{id}` autorise l’auteur ou ces examinateurs. Les brouillons sont exclus, et un rôle global de propriétaire ne donne pas accès aux dossiers. Les permissions sont relues en base à chaque requête.

Les avis et demandes de correction des référents sont décrits dans la section suivante. Les décisions finales sont décrites plus bas ; les notifications restent à implémenter. La destination mémorisée n’est pas automatiquement recalculée si tous les référents sont retirés après la soumission ; les administrateurs conservent la consultation des dossiers de leur espace.

Vérifications de la soumission : 12 tests backend réussis, lint et compilation frontend réussis. Couverture : CSRF, auteur, contenu incomplet, version périmée, routage référent/direct, retrait d’un référent, confidentialité, propriétaire sans appartenance et deux soumissions simultanées sans doublon d’historique. Parcours navigateur testé sur données isolées : sauvegarde obligatoire, confirmation, passage à Soumis et consultation de la version transmise.


### Avis du référent et corrections

Un référent actif du groupe peut donner un avis sur un projet `SOUMIS` à l’étape `REFERENT`, à condition de ne pas être son auteur. Le bouton est piloté par `canReview` calculé côté serveur ; le POST recontrôle les droits, le compte, l’espace, le groupe, la version et l’étape. Le rôle d’administrateur ou de propriétaire seul ne suffit pas pour émettre cet avis.

`POST /api/project-reviews/{id}/opinion` reçoit `version`, `decision` (`AVIS_FAVORABLE` ou `A_CORRIGER`) et `comment` (3 000 caractères maximum). Le commentaire est obligatoire pour une correction. Session et CSRF requis. Une demande de correction passe le projet à `A_CORRIGER`. Un avis favorable le laisse `SOUMIS` et le transmet à l’étape `ADMINISTRATEUR` ; il ne publie jamais le projet. La décision finale de l’administrateur est décrite plus bas.

Migration V10 : version examinée dans `validation_projet` avec unicité par projet/version. L’avis, l’historique et le changement d’état sont atomiques. Deux référents intervenant sur la même version ne peuvent pas écraser leurs décisions : un seul avis est enregistré et l’autre requête reçoit 409. Une répétition strictement identique du même référent retrouve le résultat sans nouvelle entrée.

L’auteur retrouve « Consulter les remarques et corriger » dans Mes projets. Le même formulaire lit et modifie aussi les projets `A_CORRIGER`, conserve ce statut pendant la rédaction et affiche l’historique des avis. Les versions en correction sont inaccessibles aux examinateurs jusqu’à la nouvelle soumission. La resoumission conserve l’identifiant, incrémente la version, conserve les avis antérieurs et recalcule la destination selon les référents actifs. Aucun e-mail ni notification externe n’est envoyé.

Vérifications des avis : suite complète de 13 tests backend réussie, puis 3 tests ciblés brouillons/avis réussis après le dernier ajustement de confidentialité, lint et compilation frontend réussis. Couverture HTTP : droits des référents, auteur exclu, CSRF, commentaire obligatoire, version périmée, corrections privées, resoumission avec historique et deux avis concurrents. Parcours navigateur vérifié sur données fictives isolées : demande de correction, lecture des remarques par l’auteur, enregistrement, nouvelle soumission du même projet et avis favorable vers l’administrateur.

### Décision finale de l’administrateur

`POST /api/project-reviews/{id}/decision` reçoit `version`, `decision` (`APPROUVE` ou `REFUSE`) et `comment` (3 000 caractères maximum, obligatoire pour un refus). Session et CSRF requis. Seul un administrateur actif de l’espace actif, distinct de l’auteur, peut décider sur un projet soumis. Il peut intervenir directement à l’étape référent ou après avis favorable. Un groupe rattaché doit être actif. Le propriétaire de plateforme seul ne dispose pas de ce droit. La publication directe de son propre projet n’est pas implémentée.

La décision clôt l’examen, efface l’étape d’attente, incrémente la version et ajoute l’historique dans une transaction. Le verrou du projet et l’unicité projet/version de V10 empêchent deux décisions concurrentes ; la seconde reçoit 409. Une répétition identique du même administrateur retourne le résultat sans doublon. Aucune nouvelle migration n’est nécessaire.

Les boutons sont déterminés par `canDecide` calculé côté serveur. Le refus exige un motif dans le formulaire et côté API ; la décision est confirmée avant envoi. Les dossiers décidés sortent des projets reçus. L’auteur retrouve « Consulter la décision » dans Mes projets, avec le statut, le motif et l’historique. L’administrateur actif de l’espace conserve l’accès au détail par identifiant. Les projets approuvés/refusés ne sont plus modifiables ou soumettables ; le catalogue et la publication sont décrits ci-dessous ; les notifications restent à développer.

Vérifications des décisions : les 10 tests backend hors brouillons/projets ont réussi ; les 4 tests brouillons/projets ont réussi après correction de l’attente du test de resoumission d’un projet refusé (409). Lint et compilation frontend réussis. Parcours navigateur sur données fictives isolées : refus désactivé sans motif, confirmation, erreur réseau avec commentaire conservé, succès et consultation du motif par l’auteur. Les tests HTTP couvrent aussi l’approbation directe, l’auteur administrateur exclu, le propriétaire sans droit local, le référent non administrateur, le retrait de rôle, CSRF, les répétitions et les décisions simultanées. Aucun compte ou projet fictif n’a été ajouté à la base applicative.


### Publication et catalogue des projets

Migration V11 : champ `publie` distinct de l’approbation, date de dernière publication et journal `publication_projet` (administrateur, version, action, date). Tous les projets existants restent non publiés. Une contrainte interdit un projet publié sans statut `APPROUVE`.

- `GET /api/project-publications` : projets approuvés des espaces où le compte actif est administrateur.
- `POST /api/project-publications/{id}` : `version` et booléen `published`, session et CSRF. Recontrôle les droits, verrouille le projet, journalise l’action et incrémente la version. Répétition identique sans doublon ; conflit de version ou action concurrente : 409. Publication exige espace et groupe actifs ; retrait permis si ceux-ci sont suspendus.
- `GET /api/projects` et `/api/projects/{id}` : liste et fiche des projets publiés et approuvés, espace/groupe actifs. Les projets `PUBLIQUE` sont accessibles sans connexion. Les projets `GROUPE` exigent compte actif, appartenance active au groupe et à l’espace. Le rôle d’administrateur seul ne contourne pas la visibilité du catalogue. Un projet inaccessible retourne 404. Réponses sans cache ; aucun commentaire de validation, identifiant d’auteur ou e-mail n’est exposé.

La rubrique « Publication des projets approuvés » dans Mon espace permet de publier et retirer avec confirmation de l’audience. Après une nouvelle approbation, utiliser « Actualiser les publications ». Le champ de visibilité existant est respecté ; sa modification n’est pas encore proposée dans le formulaire de brouillon. Le catalogue `/projets` propose une recherche et des fiches `/projets/{id}`. L’accueil affiche les vrais projets publiés, sans exemples de remplacement quand la liste est vide. Aucun projet réel n’est publié automatiquement. La participation, les paiements et les notifications ne font pas partie de ce lot.

Vérifications : 15 tests backend réussis, lint et compilation frontend réussis. Couverture publication : droits, CSRF, approbation préalable, visibilité groupe, retrait d’appartenance, suspension du compte/espace, concurrence, répétitions, retrait et absence de données privées dans le DTO public. Les scénarios HTTP isolent leur quota de connexion dans le contexte de test uniquement ; la limite applicative reste inchangée. Parcours navigateur sur données fictives : confirmation de publication, fiche sans connexion, recherche vide, retrait et catalogue vide. Fiche vérifiée à 390 px sans débordement horizontal. Aucun projet fictif ajouté à la base applicative.

### Propositions d’aide aux projets

Ce lot ajoute des propositions d’aide gratuites, distinctes d’une réservation de place, d’un paiement et d’une adhésion au groupe. Types existants : bénévolat, compétences, partage du projet, soutien moral. Une proposition commence à `PROPOSEE`, l’administrateur peut l’accepter ou la refuser avec motif ; le participant peut annuler une proposition en attente ou acceptée. Les refus et annulations restent consultables ; une nouvelle proposition est possible avec une nouvelle clé de création.

Migration V12 : message initial (1 000 caractères maximum côté API), motif de réponse, version, UUID de création, date de modification, examinateur et journal `historique_participation`. L’index existant interdit plusieurs propositions actives du même type par personne et projet. La clé de création évite les doubles envois ; rejouer une création annulée retrouve la ligne annulée sans la réactiver. Les modifications et le journal sont transactionnels.

- `GET /api/project-participations` : historique personnel du compte actif, sans accès aux propositions d’autrui.
- `POST /api/project-participations` : `projectId`, `requestId`, `type`, `message` facultatif. Compte actif, projet approuvé et publié, espace/groupe actifs. Pour un projet de groupe, appartenance active au groupe et à l’espace. Un projet public ne nécessite aucune adhésion. Les créations sont sérialisées par utilisateur et projet ; aucun rôle ni adhésion n’est ajouté.
- `POST /api/project-participations/{id}/cancel` : `version`. Réservé au participant, même si le projet a été retiré ou l’appartenance révoquée. Conflit 409 si la réponse de l’administrateur a changé la version ; répétition d’une annulation sans doublon.
- `GET /api/project-participations/received` : propositions des espaces administrés activement ; ni le rôle de propriétaire seul ni celui de référent ne donne cet accès.
- `POST /api/project-participations/{id}/decision` : `version`, `status` (`ACCEPTEE` ou `REFUSEE`), `reason` (1 000 caractères maximum, requis pour refuser). Administrateur actif de l’espace et groupe actif. Pour accepter, le projet doit encore être publié, le participant actif et, pour un projet de groupe, toujours membre actif. Verrous et version évitent qu’une acceptation écrase une annulation. Les POST nécessitent CSRF et session.

La fiche publiée propose la connexion avec retour vers un chemin de projet strictement validé (aucune redirection externe), puis le formulaire. « Mon espace → Mes aides aux projets » permet le suivi et l’annulation. Les administrateurs trouvent « Propositions d’aide reçues » dans « Mes espaces et projets ». Le nom et le message sont visibles uniquement par le participant et les administrateurs autorisés, jamais dans le catalogue public. Les réponses sont consultables après actualisation ; aucun e-mail ou notification interne n’est envoyé pour l’instant.

Vérifications : suite de 16 tests backend réussie, puis scénario ciblé avec course acceptation/annulation réussi ; lint et compilation frontend réussis. Couverture : session, CSRF, type invalide, doubles envois, doublons actifs, isolation des comptes/espaces, motif requis, retrait de publication, retrait d’appartenance, suspension du compte et absence d’adhésion implicite. Parcours navigateur sur données fictives isolées : retour au projet après connexion, saisie conservée sur erreur réseau, envoi, suivi personnel, acceptation et réponse, annulation. Affichage du suivi vérifié à 390 px sans débordement. Aucun utilisateur ou projet fictif ajouté à la base applicative.

### Ouverture des espaces et gestion des groupes

Décision du 18 octobre 2026 : un utilisateur actif demande l'ouverture d'un espace ; le propriétaire de Belconnect approuve ou refuse. Une approbation crée l'espace et attribue au demandeur le rôle `ADMINISTRATEUR` dans cet espace seulement. Le rôle global `PROPRIETAIRE` n'est jamais attribué par l'inscription ou la demande. Il doit être désigné explicitement sur un compte existant actif.

Dans **Mon espace → Mes espaces et projets**, chaque utilisateur peut envoyer et suivre ses demandes. Le propriétaire dispose d'une file « Demandes à examiner », avec confirmation de l'approbation ou motif obligatoire de refus. L'administrateur accède à **Gérer l'espace et les groupes** pour modifier le nom, le type et la présentation de son espace, créer et modifier les groupes actifs. Un administrateur peut désormais choisir les groupes actifs de son espace pour créer un projet, sans appartenance de groupe fictive ; ses éventuels rôles de référent restent reconnus.

Migration V13 : demandes d'ouverture et décisions, version des espaces/groupes, couverture HTTPS, visibilité prévue et historique des actions de gestion. Les tables existantes sont conservées. Les groupes existants ont par défaut une visibilité privée, sans nouvelle publication publique.

API (session et CSRF pour les écritures) :

- `GET/POST /api/workspace/requests` : demandes personnelles ; création avec `requestId` UUID et `content` (`name`, `type`, `description`).
- `GET /api/workspace/opening-requests` : demandes consultables par le propriétaire.
- `POST /api/workspace/opening-requests/{id}/decision` : `version`, `status` (`APPROUVEE` ou `REFUSEE`), `reason`.
- `GET /api/workspace/spaces/{id}/management` : informations et groupes de l'espace administré.
- `POST /api/workspace/spaces/{id}` : `version`, `content` (`name`, `type`, `description`).
- `POST /api/workspace/spaces/{spaceId}/groups` : `requestId`, `content` (`name`, `description`, `coverUrl`, `openMembership`, `visibility`).
- `POST /api/workspace/spaces/{spaceId}/groups/{id}` : `version`, même `content`.

Les créations sont protégées des doubles envois par UUID ; l'approbation répétée identique retrouve le même espace. Les modifications utilisent une version et les écritures sont transactionnelles. Les permissions sont relues côté serveur ; un propriétaire sans appartenance administrateur ne peut pas modifier un espace. Les noms de groupes sont uniques dans un espace. Le compte du demandeur doit encore être actif pour approuver l'ouverture.

Limites du lot : couverture par adresse HTTPS, sans import de fichier ; visibilité et mode d'adhésion enregistrés mais catalogue public et adhésions encore absents ; désignation des référents, suspension/archivage depuis l'interface et notifications restent les lots suivants. Les réponses aux demandes se consultent après actualisation. Ce lot ne prétend pas reproduire tous les tableaux de bord Stitch.

Vérifications du 18 octobre : 18 tests backend réussis (dont isolation entre espaces, CSRF, refus, révocation, compte suspendu, approbations et créations concurrentes, versions périmées et non-régression des projets), compilation et lint web réussis. Parcours navigateur vérifié sur un serveur de simulation isolé : demande, approbation, création, modification, rechargement et conservation des saisies en cas d'erreur. Aucune donnée fictive de cette recette n'a été ajoutée à la base applicative. La commande de redimensionnement du navigateur n'a pas appliqué les 390 px demandés ; la recette visuelle mobile de ce nouveau panneau reste à terminer. La migration V13 est appliquée et le serveur local est opérationnel.

Voir le [suivi fonctionnel](docs/SUIVI_CONFORMITE.md) et le [planning détaillé](docs/SUIVI_PLANNING.md).

### Adhésions aux groupes

Le catalogue **Groupes** (`/groupes`) remplace l'ancien bouton d'aperçu. Les visiteurs voient uniquement les groupes publics actifs d'espaces actifs. Les membres actifs d'un espace voient également ses groupes privés. Recherche par texte et filtre adhésion ouverte/sur demande disponibles ; connexion requise avant une adhésion, avec retour vers le catalogue.

Une adhésion ouverte est immédiate après confirmation. Une demande d'accès n'attribue aucun droit avant acceptation. L'acceptation crée l'appartenance `MEMBRE` à l'espace si elle n'existe pas et l'appartenance `MEMBRE` au groupe, sans modifier les rôles existants. Cette conséquence est indiquée avant l'envoi. Les appartenances suspendues ou retirées ne sont jamais réactivées par ce parcours. Les administrateurs actifs de l'espace acceptent/refusent ; le rôle global de propriétaire ou un rôle référent seul ne donne pas ce droit. La délégation aux référents sera traitée dans le lot suivant.

Dans **Mon espace → Mes espaces et projets**, « Mes demandes et adhésions » affiche le suivi et les motifs. Les administrateurs disposent de « Demandes d'adhésion reçues », filtrées par statut, avec confirmation de décision et motif obligatoire pour un refus. Les appartenances antérieures sans demande restent affichées dans « Mes espaces et groupes ». Les paramètres de visibilité et de mode d'adhésion de la gestion des groupes sont désormais opérationnels.

API :

- `GET /api/groups` : catalogue filtré côté serveur ; ne renvoie ni membres, ni demandeurs, ni motifs privés.
- `POST /api/groups/{id}/join` : session active et CSRF ; aucune donnée de rôle acceptée du client.
- `GET /api/group-memberships` : demandes/adhésions propres à l'utilisateur.
- `GET /api/group-memberships/received` : demandes des seuls espaces administrés activement.
- `POST /api/group-memberships/{id}/decision` : `version`, `status` (`ACCEPTEE` ou `REFUSEE`), `reason`.

Migration V14 : demandes uniques par utilisateur/groupe, version, dates, motif et examinateur. Transaction, verrou d'espace et unicité empêchent les doubles adhésions et sérialisent les décisions concurrentes. Un renvoi de la même demande retrouve son résultat ; une décision identique répétée par le même administrateur est stable. Un conflit de décision ou de version retourne 409. Les groupes archivés/suspendus et espaces inactifs n'acceptent pas de nouvelles adhésions. Une décision passée ne garantit pas un accès encore actif ; le suivi indique les accès suspendus ou retirés.

Limites : pas encore de nouvelle candidature après refus, d'annulation de demande ou de sortie volontaire du groupe ; pas de notifications/e-mails, d'invitations externes aux groupes privés, ni de délégation de traitement aux référents. La réponse se consulte après actualisation. Une modification ultérieure du mode d'adhésion n'accepte pas automatiquement les demandes déjà en attente.

Vérifications du 18 octobre 2026 : **20 tests backend réussis**, compilation et lint web réussis. Tests couvrant catalogue public/privé, absence de droits avant acceptation, isolation des demandeurs et des espaces, CSRF, adhésion ouverte, préservation des rôles, refus avec motif, groupe archivé, compte suspendu, retrait d'accès et concurrence. Parcours navigateur vérifiés sur simulation isolée : adhésion ouverte, demande en attente, suivi dans Mon espace et acceptation administrative. Catalogue et filtre vérifiés dans une fenêtre interne de 390 px, largeur de contenu 390 px sans débordement. Aucune donnée fictive de recette ajoutée à la base applicative.

Activation locale vérifiée : migration V14 appliquée, backend sain et catalogue accessible via le proxy Vite (HTTP 200). Aucun groupe public actif n'était encore présent au moment de la livraison ; le catalogue affiche donc son état vide jusqu'à la création ou au passage en visibilité publique d'un groupe.

### Référents et délégation des adhésions

Dans **Mon espace → Mes espaces et projets → Gérer l’espace et les groupes → Membres et référents**, l’administrateur consulte les membres actifs, désigne plusieurs référents ou retire ce rôle sans supprimer leur adhésion. Les référents peuvent consulter les noms et rôles de leur groupe, sans adresses e-mail. Une permission commune aux référents de chaque groupe autorise le traitement des adhésions ; elle est désactivée par défaut. L’administrateur conserve ce droit et la décision finale sur les projets. Le rôle global de propriétaire seul ne donne pas ces droits.

API : `GET /api/workspace/groups/{id}/members`, `POST /api/workspace/groups/{id}/members/{memberId}/role` et `POST /api/workspace/groups/{id}/permissions`. Les écritures exigent CSRF, appartenance administrative active et version courante. Migration V15 : permission du groupe, version des appartenances et cible utilisateur de l’historique. La révocation est contrôlée côté serveur à chaque décision ; les modifications concurrentes sont sérialisées. Aucun rôle réel n’a été attribué pour cette recette.

Vérification du 18 octobre : **23 tests backend réussis**, compilation et lint web réussis. Recette sur simulation isolée : désignation, permission, vue référent en lecture seule et acceptation déléguée. Panneau référent contrôlé à 390 px sans débordement horizontal. Migration V15 appliquée et état de santé local UP. Aperçus avec données fictives : [ordinateur](docs/images/referents-demo.png), [mobile](docs/images/referents-mobile-demo.png).

Ce lot remplace les mentions antérieures « délégation référent restante ». Les permissions d’annonces et d’activités, la suspension/archivage depuis l’interface et les notifications restent à développer.

### Cycle de vie des groupes

L’administrateur actif de l’espace peut suspendre, réactiver un groupe suspendu ou archiver un groupe actif/suspendu dans « Gérer l’espace et les groupes ». Chaque action comporte une confirmation décrivant ses effets. L’archivage ne propose pas de retour à l’état actif. Les membres, rôles, demandes, projets et historique restent stockés ; les groupes inactifs et leurs projets disparaissent des catalogues, et les actions nécessitant un groupe actif sont bloquées. La réactivation conserve les permissions précédentes. Les activités de démonstration ne sont pas encore rattachées aux groupes.

API : `POST /api/workspace/spaces/{spaceId}/groups/{id}/status`, corps `{version, status}`. Session active, CSRF et rôle administrateur de cet espace obligatoires. Le propriétaire global ou un référent seul ne peut pas changer le statut. Les écritures sont sérialisées par espace et une version périmée retourne 409. Chaque transition écrit une entrée d’historique ; aucune suppression ni migration de schéma.

Recette : scénarios API de droits, isolation, conservation, réactivation et écritures concurrentes ; parcours navigateur simulés de suspension, réactivation et archivage, affichage mobile 390 px sans débordement. Les données fictives restent hors de la base applicative. Aperçu : `docs/images/groupes-archive-mobile-demo.png`. Les notifications et permissions d’annonces/activités restent hors de ce lot.

Validation finale : 25 tests backend réussis, compilation et lint web réussis, `git diff --check` sans anomalie. Serveur local redémarré et état de santé UP. Modifications locales prêtes à être enregistrées dans Git depuis le terminal de VS Code.

### Activités organisateur — premier parcours administratif

Dans **Mon espace → Mes espaces et projets → Activités de mes espaces**, les administrateurs actifs créent et modifient des brouillons, publient les activités gratuites et retirent une publication sans inscription confirmée. Les boutons « Organiser une activité » mènent à cet espace. Un compte sans espace peut y demander une ouverture. Le propriétaire global, un membre ou un référent sans rôle administrateur ne reçoit pas ces droits.

Le formulaire comporte titre, catégorie, description, ville, adresse, rendez-vous, début, clôture des inscriptions, durée, capacité, prix, public cible, préparation et image de la galerie locale. Les heures sont saisies dans le fuseau du navigateur et affichées en heure de Bruxelles sur le catalogue. Une activité appartient à un espace et au maximum un groupe actif du même espace ; ce rattachement n’est pas modifiable après création. La visibilité privée est réservée aux membres actifs du groupe, ou de l’espace sans groupe, ainsi qu’à l’administrateur. Catalogue, lien direct et réservation appliquent ce contrôle côté serveur.

Migration V16 : rattachements, auteur, identifiant de création, version, visibilité, clôture et historique administratif. API `GET/POST /api/managed-activities`, `POST /api/managed-activities/{id}` et `POST /api/managed-activities/{id}/publication`. Les écritures exigent CSRF, rôle actif, groupe actif et version courante. Le brouillon est partagé entre les administrateurs de l’espace, jamais public. Une création réessayée à l’identique ne crée pas de doublon. La publication payante est bloquée, mais le tarif peut être enregistré en brouillon. Les données de démonstration existantes restent accessibles selon leur publication.

Les inscriptions respectent la clôture distincte du début. Une activité d’espace/groupe inactif n’est plus visible ni réservable. L’annulation individuelle reste possible avant le début même si l’activité est masquée. Publication/retrait et réservation sont sérialisés : aucune réservation confirmée ne peut être contournée par un retrait concurrent. Les activités publiées ne sont pas directement modifiables ; retirer leur publication d’abord, uniquement sans inscription confirmée. Les annulations organisateur et notifications associées restent à développer.

Validation : 28 tests backend réussis, compilation et lint web réussis, diff sans erreur de format. Tests d’isolation, CSRF, visibilité privée, publication, dates, révocation, retrait concurrent avec inscription et non-régression. Parcours navigateur simulés de création, modification, publication et retrait ; formulaire mobile 390 px sans débordement. Aperçu fictif : `docs/images/activites-organisateur-mobile-demo.png`. Aucun compte ni activité de démonstration de cette recette n’a été ajouté à la base applicative.

Limites : galerie d’images fournie uniquement, sans import ; pas encore de gestion des activités par les référents, de paiement réel, de capacité illimitée, de registre détaillé des participants ni de notifications. Les tâches 03.14, 03.15 et 03.17 restent partielles ; la reproduction complète des tableaux de bord Stitch n’est pas déclarée terminée.

### Registre des inscriptions et export CSV — livraison du 19 octobre 2026

Dans **Mon espace → Mes espaces et projets → Activités de mes espaces → Voir les inscriptions**, l’administrateur actif consulte les réservations de l’activité. Une réservation indique les coordonnées fournies par la personne ayant réservé, le nombre de places, le statut et les dates d’inscription/annulation. Les accompagnants ne sont pas nommés individuellement par le modèle actuel. Les totaux distinguent places réservées, places restantes, inscriptions confirmées et annulées ; seules les réservations confirmées occupent des places. Les totaux restent globaux quel que soit le filtre.

Filtres Toutes / Confirmées / Annulées, état vide, actualisation et export CSV du filtre courant. Le CSV est généré à partir de la base au moment du téléchargement : UTF-8 avec BOM, séparateur point-virgule, cellules entre guillemets, guillemets internes échappés et valeurs susceptibles d’être interprétées comme formules préfixées par une apostrophe. Les dates sont en heure de Bruxelles.

API : `GET /api/managed-activities/{id}/registrations?status=ALL|CONFIRMEE|ANNULEE` et même chemin avec `registrations.csv`. Contrôle d’un compte actif, de l’espace actif et de l’appartenance administrative active à chaque lecture et export ; le propriétaire global seul, les référents, les participants et les administrateurs d’un autre espace sont refusés. Réponses sans cache. Les inscriptions d’un groupe suspendu ou archivé restent consultables par l’administrateur de l’espace pour le suivi historique. Le verrou partagé de l’activité garantit la cohérence des totaux pendant la lecture. Aucune nouvelle migration de schéma.

Validation : 29 tests backend réussis ; contrôles du registre vide, des quantités, des annulations, des filtres, de l’isolation, de la révocation et du CSV (accents, guillemets, retours à la ligne, neutralisation de formules). Compilation et lint web réussis. Recette navigateur isolée du registre et du téléchargement CSV filtré. Les données fictives de recette ne sont pas ajoutées à la base applicative.

Limites : pas encore d’accès référent délégué, de pointage des présences ou d’annulation par l’organisateur. Ce lot ne transmet aucun e-mail et ne modifie aucune inscription. La tâche 03.23 reste partielle pour l’accès référent.

Contrôle mobile : panneau et filtres vérifiés à 390 px, sans débordement horizontal. Aperçu avec données fictives : `docs/images/inscriptions-organisateur-mobile-demo.png`.


### Activités confiées aux référents — 19 octobre 2026

Décision produit : simplifier le quotidien, avec une seule autorisation par groupe et les écrans existants. Dans les membres et permissions du groupe, l’administrateur peut confier les activités à ses référents. Aucun nouveau circuit d’approbation des activités.

La permission est désactivée par défaut (migration V17). Un référent actif autorisé retrouve « Mes activités » : création et modification de brouillons, publication gratuite, inscriptions et export CSV, uniquement pour son groupe actif. Le formulaire sélectionne un groupe autorisé et ne propose pas « Sans groupe » au référent. L’administrateur conserve ses droits. Retirer l’autorisation ou le rôle retire immédiatement l’accès côté serveur, sans supprimer activités ni inscriptions. Les administrateurs peuvent toujours consulter les inscriptions historiques d’un groupe suspendu ou archivé.

API de configuration : `POST /api/workspace/groups/{id}/activity-permission`, avec CSRF, contrôle administrateur, version du groupe et historique. Les garde-fous existants sont conservés : activités payantes en brouillon seulement, retrait de publication bloqué en présence d’inscriptions confirmées.

Les contrôles navigateur utilisent des données fictives isolées ; aucun droit réel n’est attribué par cette livraison. Aperçu : `docs/images/activites-referent-demo.png`. Les annonces, notifications et paiements restent à développer ; les tâches 03.11, 03.12 et 03.17 restent partielles. La tâche 03.23 est réalisée localement pour les inscriptions et leur export.

Recette web : compilation et lint réussis ; parcours administrateur et référent vérifiés avec des données fictives, affichage mobile à 390 px sans débordement horizontal.

Validation backend : suite de 30 tests exécutée ; une régression du code de refus (409 au lieu de 403 pour une appartenance retirée) corrigée, puis les 14 tests SpaceManagementApiTests relancés avec succès. Les 16 autres tests étaient réussis. Migration V17 appliquée en local ; serveur sain et accès anonyme aux activités organisées refusé (401).
