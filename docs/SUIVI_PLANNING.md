# Belconnect suivi détaillé du planning

État au 18 octobre 2026. Les 98 identifiants et intitulés proviennent du planning original, conservé sans modification. Ces statuts sont une appréciation du projet local et des références disponibles ; ils ne remplacent pas les statuts du classeur. Aucun taux global d’achèvement n’est déduit de ce tableau.

[Bilan fonctionnel, sources, écarts et critères du prochain lot](SUIVI_CONFORMITE.md). Les fonctions « réalisées localement » restent soumises à la recette globale et aux limites indiquées dans le bilan.

## Analyse

| ID | Tâche originale | État constaté | Suite ou limite |
|---|---|---|---|
| 01.01 | Définir la vision et les objectifs | Partiel | Documents de référence disponibles ; décisions récentes et règles ouvertes à réconcilier. |
| 01.02 | Analyser les besoins des organisateurs et membres | À valider | Analyse terrain, règles commerciales ou validation finale non établies par le code ; voir décisions du bilan. |
| 01.03 | Valider le périmètre V1 / hors V1 | Partiel | Documents de référence disponibles ; décisions récentes et règles ouvertes à réconcilier. |
| 01.04 | Finaliser le cahier des charges V1.1 | Partiel | Documents de référence disponibles ; décisions récentes et règles ouvertes à réconcilier. |
| 01.05 | Préciser les workflows et permissions | Partiel | Documents de référence disponibles ; décisions récentes et règles ouvertes à réconcilier. |
| 01.06 | Valider règles de paiements, annulations et remboursements | Partiel | Stripe Connect, commissions Starter 8 % / Pro 5 %, remboursement intégral si l'organisateur annule, aucun remboursement automatique si le participant annule ; répartition des frais Stripe et détails opérationnels restants. |
| 01.07 | Vérifier le nom commercial et les risques juridiques | À valider | Analyse terrain, règles commerciales ou validation finale non établies par le code ; voir décisions du bilan. |
| 01.08 | Valider modèle économique et budget | À valider | Analyse terrain, règles commerciales ou validation finale non établies par le code ; voir décisions du bilan. |
| 01.09 | Définir jalons, budget et registre des risques | À valider | Analyse terrain, règles commerciales ou validation finale non établies par le code ; voir décisions du bilan. |
| 01.10 | Créer dépôt Git, conventions et suivi de projet | Partiel | Suivi documentaire créé ; le projet actif ne possède pas de dépôt Git. |

## Conception

| ID | Tâche originale | État constaté | Suite ou limite |
|---|---|---|---|
| 02.01 | Cartographier les parcours visiteur/membre | Partiel | Maquettes et parcours disponibles ; couverture et concordance avec le code incomplètes. |
| 02.02 | Cartographier les parcours administrateur/référent/propriétaire | Partiel | Maquettes et parcours disponibles ; couverture et concordance avec le code incomplètes. |
| 02.03 | Dessiner l'architecture de navigation | Partiel | Maquettes et parcours disponibles ; couverture et concordance avec le code incomplètes. |
| 02.04 | Créer les maquettes Google Stitch web et mobile | Partiel | Maquettes et parcours disponibles ; couverture et concordance avec le code incomplètes. |
| 02.05 | Prototyper inscription et paiement d'activité | Partiel | Maquettes et parcours disponibles ; couverture et concordance avec le code incomplètes. |
| 02.06 | Prototyper groupe, annonces, projet et validations | Partiel | Maquettes et parcours disponibles ; couverture et concordance avec le code incomplètes. |
| 02.07 | Faire valider le prototype par utilisateurs pilotes | À valider | Recette par les utilisateurs pilotes non établie. |
| 02.08 | Choisir la stack, la stratégie PWA et l'hébergement | Partiel | Stack web/backend et Expo présents ; stratégie de livraison mobile et hébergement à arrêter. |
| 02.09 | Modéliser utilisateurs, organisations, groupes, adhésions | Partiel | Schéma partiel migré ; adhésions gérées, transactions, annonces et notifications à compléter selon leur périmètre. |
| 02.10 | Modéliser activités, inscriptions et transactions | Partiel | Schéma partiel migré ; adhésions gérées, transactions, annonces et notifications à compléter selon leur périmètre. |
| 02.11 | Modéliser projets, publications et notifications | Partiel | Schéma partiel migré ; adhésions gérées, transactions, annonces et notifications à compléter selon leur périmètre. |
| 02.12 | Définir contrats REST et API | Partiel | API, contrôles et tests locaux existent ; contrats complets, matrice de permissions, audit transversal et CI à compléter. |
| 02.13 | Concevoir RBAC, isolation organisations et audit | Partiel | API, contrôles et tests locaux existent ; contrats complets, matrice de permissions, audit transversal et CI à compléter. |
| 02.14 | Préparer environnements local, CI et tests | Partiel | API, contrôles et tests locaux existent ; contrats complets, matrice de permissions, audit transversal et CI à compléter. |

## Développement

| ID | Tâche originale | État constaté | Suite ou limite |
|---|---|---|---|
| 03.01 | Initialiser backend et migrations DB | Réalisé localement | Backend Spring Boot et migrations Flyway présents. |
| 03.02 | Initialiser frontend responsive et navigation | Partiel | Socle React présent ; couverture responsive complète à recetter. |
| 03.03 | Créer authentification, inscription et connexion | Réalisé localement | Inscription, connexion et déconnexion ; sessions avec cookies et CSRF. |
| 03.04 | Créer récupération mot de passe et profil | Partiel | Prénom et nom modifiables ; lien de récupération à usage unique préparé. Configuration SMTP et vérification de l'envoi réel restantes ; adresse e-mail non modifiable. |
| 03.05 | Implémenter rôles et contrôle d'accès | Partiel | Désignation et retrait des référents, isolation des groupes et permission d’adhésion réalisés ; autres permissions à compléter. |
| 03.06 | Créer espaces organisateurs et isolation multi-organisateur | Partiel | Demande d’ouverture, décision propriétaire, attribution initiale et modification de l’espace disponibles ; cycle de vie complet restant. |
| 03.07 | Créer groupes et paramètres de visibilité | Partiel | Groupes actifs gérés, catalogue public/privé et modes d’adhésion opérationnels ; import de couverture restant. |
| 03.08 | Implémenter adhésion ouverte/sur demande | Réalisé localement | Adhésion ouverte ou demande, suivi personnel ; appartenance espace/groupe créée seulement après acceptation. Notifications restantes. |
| 03.09 | Gérer acceptation/refus et statut des membres | Réalisé localement | Acceptation/refus par administrateur ou référent autorisé du groupe ; version, isolation et révocation vérifiées. |
| 03.10 | Nommer un ou plusieurs référents par groupe | Réalisé localement | Liste des membres actifs, désignation de plusieurs référents et retrait conservant l’adhésion ; historique et contrôle de version. |
| 03.11 | Configurer droits des référents par groupe | Partiel | Permission de traiter les adhésions configurable par groupe, désactivée par défaut ; permission activités (publication gratuite et inscrits/CSV) disponible ; annonces restantes. |
| 03.12 | Gérer administration directe et déléguée | Partiel | Administration directe et délégation des adhésions et activités réalisées ; autres modules délégués restants. |
| 03.13 | Suspendre et archiver les groupes | Réalisé localement | Suspension, réactivation des groupes suspendus et archivage administratif avec conservation des données ; contrôle de version et historique. |
| 03.14 | Créer formulaire d'activité et images | Partiel | Formulaire administrateur et galerie locale disponibles ; import de photos restant. |
| 03.15 | Gérer dates, lieux, places, tarifs, échéances | Partiel | Date, lieu, durée, capacité bornée, tarif de brouillon et clôture distincte ; paiements réels et capacité illimitée restants. |
| 03.16 | Rattacher activité à 0 ou 1 groupe / visibilité | Réalisé localement | Espace obligatoire, groupe actif facultatif et visibilité publique/privée ; catalogue, détail et réservations filtrés côté serveur. |
| 03.17 | Gérer brouillons, publication et workflow référent | Partiel | Brouillon, modification, publication gratuite, retrait sans inscription et annulation d’activité avant son début ; référent autorisé pour son groupe. Paiement restant. |
| 03.18 | Créer catalogue, détail et filtres d'activités | Réalisé localement | Catalogue API, détail et filtres web ; contenu initial de démonstration. |
| 03.19 | Gérer inscriptions gratuites, capacité et doublons | Partiel | Réservation gratuite, capacité, doublons et clôture gérés ; 1 à 4 places par inscription, capacité illimitée restante. |
| 03.20 | Préparer compte organisateur prestataire de paiement | Partiel | Stripe Connect Express en mode test : lien d'onboarding et état par espace administré ; clé test et activation Stripe Connect à configurer, aucun paiement réel ni webhook. |
| 03.21 | Créer paiement activité et suivi de session | Partiel | Checkout test et retour provisoire intégrés ; publication conditionnée à Stripe test et compte Connect prêt, recette externe encore nécessaire. |
| 03.22 | Vérifier paiement serveur, idempotence, expiration | Partiel | Webhook signé et reprise périodique des sessions enregistrées ; cas sans identifiant de session et recette Stripe de bout en bout encore à traiter. |
| 03.23 | Créer liste des inscrits et accès du référent | Réalisé localement | Registre et export CSV filtré accessibles aux administrateurs et aux référents autorisés pour leur groupe. |
| 03.24 | Gérer annulation selon politique finalisée | Partiel | Annulation gratuite déjà disponible. Pour le payant : aucun remboursement automatique si le participant annule ; remboursement intégral si l'organisateur annule. Implémentation des deux parcours restante. |
| 03.25 | Créer brouillon projet avec objectifs, images et aide | Partiel | Brouillons, couverture par URL HTTPS et aides recherchées disponibles ; import de fichier restant. |
| 03.26 | Soumettre projets et gérer leurs statuts | Réalisé localement | Soumission sauvegardée, statuts et permissions contrôlés. |
| 03.27 | Examen projet par référent et demandes de correction | Réalisé localement | Avis, corrections et nouvelle soumission du même projet avec historique. |
| 03.28 | Validation finale admin et publication projet | Réalisé localement | Décision administrative et publication explicite ; cas du propre projet administrateur à arbitrer. |
| 03.29 | Catalogue et page détail des projets | Réalisé localement | Liste et détail des projets publiés, contrôle des accès. |
| 03.30 | Participation non financière et suivi des intérêts | Réalisé localement | Aide non financière, traitement et annulation ; aucun soutien financier ni billet implicite. |
| 03.31 | Créer annonces de groupe et fil chronologique | Partiel | Annonces texte visibles aux membres actifs, publication par administrateur ou référent ; édition et autres enrichissements restants. |
| 03.32 | Ajouter commentaires et contrôle d'accès | À développer | Annonces, commentaires, modération, notifications et e-mails absents. |
| 03.33 | Modération des commentaires, annonces épinglées | À développer | Annonces, commentaires, modération, notifications et e-mails absents. |
| 03.34 | Créer notifications in-app | Partiel | Avis persistants dans Mon espace pour les activités annulées ; autres événements et préférences restants. |
| 03.35 | Envoyer e-mails essentiels et préférences | À développer | Annonces, commentaires, modération, notifications et e-mails absents. |
| 03.36 | Créer tableaux de bord membre | Partiel | Suivi des demandes d’espace ajouté ; adhésions, annonces et notifications restantes. |
| 03.37 | Créer tableau de bord admin / validations | Partiel | Gestion des espaces/groupes et actions projets disponibles ; activités, membres, finances et tableau de bord complet restants. |
| 03.38 | Créer tableau de bord référent / groupes attribués | Partiel | Groupes attribués, membres et permissions consultables, examen des projets et adhésions autorisées ; tableau de bord complet restant. |
| 03.39 | Créer back-office propriétaire et modération | Partiel | File d’approbation des espaces et lecture globale disponibles ; modération et configuration restantes. |
| 03.40 | Assurer responsive, accessibilité et navigation mobile | Partiel | Web adaptatif ; recette complète accessibilité et appareils restante, Expo encore initial. |
| 03.41 | Installer PWA (si retenue) | Conditionnel | PWA à décider ; Expo installé ne réalise pas cette tâche PWA. |
| 03.42 | Rédiger documentation utilisateur et API | Partiel | README et suivi disponibles ; documentation utilisateur/API/exploitation à compléter. |

## Tests

| ID | Tâche originale | État constaté | Suite ou limite |
|---|---|---|---|
| 04.01 | Écrire tests unitaires sécurité et règles métier | Partiel | Tests backend disponibles pour les parcours existants ; couverture intégrale de l’exigence non acquise. |
| 04.02 | Tester authentification, RBAC et isolation organisations | Partiel | Tests backend disponibles pour les parcours existants ; couverture intégrale de l’exigence non acquise. |
| 04.03 | Tester adhésions, administration mixte et référents | Partiel | Tests locaux des adhésions, désignations, révocations, concurrence et isolation ; recette globale restante. |
| 04.04 | Tester capacité, délais, inscriptions concurrentes | Partiel | Tests backend disponibles pour les parcours existants ; couverture intégrale de l’exigence non acquise. |
| 04.05 | Tester paiements, webhooks, idempotence et échec | À développer | Tests métier dépendant de fonctionnalités encore absentes ou incomplètes. |
| 04.06 | Tester validations et publication des projets | Partiel | Tests backend disponibles pour les parcours existants ; couverture intégrale de l’exigence non acquise. |
| 04.07 | Tester annonces, commentaires et notifications | À développer | Tests métier dépendant de fonctionnalités encore absentes ou incomplètes. |
| 04.08 | Tester parcours E2E visiteur et membre | Partiel | Contrôles locaux ciblés ; recette complète des rôles, confidentialité et accessibilité restante. |
| 04.09 | Tester parcours E2E admin et référent | Partiel | Contrôles locaux ciblés ; recette complète des rôles, confidentialité et accessibilité restante. |
| 04.10 | Vérifier RGPD, sécurité, uploads et confidentialité | Partiel | Contrôles locaux ciblés ; recette complète des rôles, confidentialité et accessibilité restante. |
| 04.11 | Tester interfaces web, mobile et accessibilité | Partiel | Contrôles locaux ciblés ; recette complète des rôles, confidentialité et accessibilité restante. |
| 04.12 | Tester sauvegarde/restauration et incidents | À développer | Sauvegarde/restauration et procédure d’incident non validées. |
| 04.13 | Corriger anomalies et valider critères d'acceptation | Partiel | Corrections locales et critères du lot 1 documentés ; recette finale restante. |

## Déploiement

| ID | Tâche originale | État constaté | Suite ou limite |
|---|---|---|---|
| 05.01 | Choisir hébergement, domaine et services mail | À valider | Choix et activation externes à confirmer ; aucune mise en production établie. |
| 05.02 | Configurer base de données, secrets et stockage | À développer | Configuration locale ne vaut pas infrastructure, déploiement ou recette de production. |
| 05.03 | Configurer HTTPS, sauvegardes et monitoring | À développer | Configuration locale ne vaut pas infrastructure, déploiement ou recette de production. |
| 05.04 | Rédiger CGU, confidentialité et mentions légales | À valider | Choix et activation externes à confirmer ; aucune mise en production établie. |
| 05.05 | Configurer prestataire de paiement en production | À valider | Choix et activation externes à confirmer ; aucune mise en production établie. |
| 05.06 | Mettre en place CI/CD et versionnement des releases | À développer | Configuration locale ne vaut pas infrastructure, déploiement ou recette de production. |
| 05.07 | Déployer environnement pilote | À développer | Configuration locale ne vaut pas infrastructure, déploiement ou recette de production. |
| 05.08 | Tester les parcours critiques après déploiement | À développer | Configuration locale ne vaut pas infrastructure, déploiement ou recette de production. |

## Lancement

| ID | Tâche originale | État constaté | Suite ou limite |
|---|---|---|---|
| 06.01 | Recruter organisateurs pilotes | À valider | Pilotage, lancement ou exploitation hors code ; réalisation non établie, à suivre avec le fondateur. |
| 06.02 | Former pilotes et publier contenus de démonstration | À valider | Pilotage, lancement ou exploitation hors code ; réalisation non établie, à suivre avec le fondateur. |
| 06.03 | Collecter retours et mesures d'usage | À valider | Pilotage, lancement ou exploitation hors code ; réalisation non établie, à suivre avec le fondateur. |
| 06.04 | Corriger anomalies prioritaires du pilote | À valider | Pilotage, lancement ou exploitation hors code ; réalisation non établie, à suivre avec le fondateur. |
| 06.05 | Mettre en place support utilisateurs | À valider | Pilotage, lancement ou exploitation hors code ; réalisation non établie, à suivre avec le fondateur. |
| 06.06 | Préparer campagnes locales et supports commerciaux | À valider | Pilotage, lancement ou exploitation hors code ; réalisation non établie, à suivre avec le fondateur. |
| 06.07 | Déterminer tarifs définitifs et facturation | À valider | Pilotage, lancement ou exploitation hors code ; réalisation non établie, à suivre avec le fondateur. |
| 06.08 | Vérifier conformité de lancement et activer paiements | À valider | Pilotage, lancement ou exploitation hors code ; réalisation non établie, à suivre avec le fondateur. |
| 06.09 | Ouvrir lancement public progressivement | À valider | Pilotage, lancement ou exploitation hors code ; réalisation non établie, à suivre avec le fondateur. |
| 06.10 | Suivre coûts, incidents, performance et revenus | À valider | Pilotage, lancement ou exploitation hors code ; réalisation non établie, à suivre avec le fondateur. |
| 06.11 | Planifier maintenance et évolutions V2 | À valider | Pilotage, lancement ou exploitation hors code ; réalisation non établie, à suivre avec le fondateur. |



### Activités confiées aux référents — 19 octobre 2026

Décision produit : simplifier le quotidien, avec une seule autorisation par groupe et les écrans existants. Dans les membres et permissions du groupe, l’administrateur peut confier les activités à ses référents. Aucun nouveau circuit d’approbation des activités.

La permission est désactivée par défaut (migration V17). Un référent actif autorisé retrouve « Mes activités » : création et modification de brouillons, publication gratuite, inscriptions et export CSV, uniquement pour son groupe actif. Le formulaire sélectionne un groupe autorisé et ne propose pas « Sans groupe » au référent. L’administrateur conserve ses droits. Retirer l’autorisation ou le rôle retire immédiatement l’accès côté serveur, sans supprimer activités ni inscriptions. Les administrateurs peuvent toujours consulter les inscriptions historiques d’un groupe suspendu ou archivé.

API de configuration : `POST /api/workspace/groups/{id}/activity-permission`, avec CSRF, contrôle administrateur, version du groupe et historique. Les garde-fous existants sont conservés : activités payantes en brouillon seulement, retrait de publication bloqué en présence d’inscriptions confirmées.

Les contrôles navigateur utilisent des données fictives isolées ; aucun droit réel n’est attribué par cette livraison. Aperçu : `docs/images/activites-referent-demo.png`. Les annonces, notifications et paiements restent à développer ; les tâches 03.11, 03.12 et 03.17 restent partielles. La tâche 03.23 est réalisée localement pour les inscriptions et leur export.

La V26 prépare les réservations payantes d'activités en mode test Stripe : capacité retenue pendant Checkout et inscription créée uniquement après webhook payé et signé. Voir `docs/PAIEMENTS_STRIPE.md`.

Le remboursement d'une activité annulée par l'organisateur est désormais préparé côté serveur en mode test : fermeture de l'activité, expiration des sessions ouvertes, remboursement Stripe intégral et reprise des états en attente. Les inscriptions ne sont annulées dans Belconnect qu'après succès des remboursements. Checkout est relié au frontend pour les activités réelles ; la publication demande une configuration Stripe test et un compte Connect prêt. Une recette Stripe de bout en bout et la résolution des tentatives sans identifiant de session sont encore nécessaires avant le lancement.

Recette web : compilation et lint réussis ; parcours administrateur et référent vérifiés avec des données fictives, affichage mobile à 390 px sans débordement horizontal.

Validation backend : suite de 30 tests exécutée ; une régression du code de refus (409 au lieu de 403 pour une appartenance retirée) corrigée, puis les 14 tests SpaceManagementApiTests relancés avec succès. Les 16 autres tests étaient réussis. Migration V17 appliquée en local ; serveur sain et accès anonyme aux activités organisées refusé (401).


### Annulation simple d’une activité — 19 octobre 2026

Depuis « Mon espace → Mes activités », un administrateur ou un référent autorisé peut annuler une activité publiée avant son début. Une confirmation indique le nombre d’inscriptions concernées. L’action est définitive : l’activité disparaît du catalogue, les inscriptions confirmées deviennent annulées et les places sont libérées. Les participants voient « Activité annulée » dans « Mes inscriptions » ; l’organisateur conserve le registre et son export comme historique. Aucun e-mail automatique n’est envoyé.

La migration V18 ajoute l’état et la date d’annulation de l’activité. `POST /api/managed-activities/{id}/cancel` vérifie le rôle, le groupe, la version et le début, puis met à jour l’activité et ses inscriptions dans une transaction sous verrou. Une activité annulée ne peut être ni republiée ni réservée. Les activités déjà commencées sont refusées.

Validation : 31 tests backend réussis, compilation et lint web réussis. Migration V18 appliquée sur la base locale ; serveur opérationnel.


### Avis d’annulation dans Mon espace — 19 octobre 2026

Lorsqu’une activité est annulée, chaque inscription encore confirmée crée un avis personnel persistant. L’avis apparaît en haut de « Mon espace », mène à « Mes inscriptions » et peut être marqué comme lu. L’accès est limité au destinataire côté serveur ; la liste est sans cache. L’inscription annulée reste visible même après lecture de l’avis. Migration V19 et API `GET /api/notifications`, `POST /api/notifications/{id}/read`. Les autres notifications et les e-mails ne sont pas encore implémentés.

Validation : 31 tests backend réussis, compilation et lint web réussis. Avis et marquage comme lu vérifiés dans un navigateur avec des données fictives ; affichage mobile à 390 px sans débordement horizontal. Aperçus : `docs/images/avis-activite-annulee-demo.png` et `docs/images/avis-activite-annulee-mobile-demo.png`. Migration V19 appliquée en local.


### Nouvelles des groupes — 19 octobre 2026

Dans « Mon espace », les membres actifs voient les annonces de leurs groupes ; les administrateurs d’espace voient celles de leurs groupes. Un administrateur ou un référent actif peut publier un court texte dans son groupe. Les groupes suspendus et les appartenances retirées perdent immédiatement l’accès ; le propriétaire de la plateforme seul n’a pas d’accès spécial. L’interface reste un fil simple, sans nouvel espace de gestion. Migration V20 ; API `GET` et `POST /api/group-announcements`, avec authentification, CSRF à l’écriture, identifiant de requête et limite de 1 000 caractères.

Les commentaires, l’édition, la modération et les e-mails restent à faire. Décision du fondateur : les activités payantes font partie du lancement initial ; les tâches 03.20–03.22 et les remboursements restent donc obligatoires avant publication réelle de ces activités.

Validation : 32 tests backend réussis, compilation et lint web réussis. Publication et lecture vérifiées dans un navigateur sur données fictives ; affichage mobile à 390 px sans débordement horizontal. Aperçus : `docs/images/nouvelles-groupes-demo.png` et `docs/images/nouvelles-groupes-mobile-demo.png`. Migration V20 appliquée en local ; serveur sain.


### Préparation de Stripe Connect — 19 octobre 2026

Décisions confirmées : l'organisateur reçoit les fonds, Belconnect prélève 5 % du prix total et rembourse intégralement le participant si l'organisateur annule. Si le participant annule, aucun remboursement automatique n'est déclenché. Le fondateur possède déjà un compte Stripe. La répartition des frais Stripe reste à préciser.

La migration V21 associe un compte Stripe Connect à un espace organisateur. L'administrateur actif de l'espace peut consulter l'état du compte et ouvrir l'onboarding Express depuis « Mon espace ». Le backend accepte seulement `STRIPE_SECRET_KEY` en mode test ; cette variable n'est pas encore configurée localement. Aucune session Checkout, aucun webhook et aucun encaissement n'ont été activés. Les activités payantes restent en brouillon et leurs réservations sont toujours refusées.

Validation : suite backend existante réussie, nouveau test ciblé des droits/CSRF/configuration réussie, compilation et lint web réussis. Migration V21 appliquée au schéma local ; API opérationnelle. Détails : `docs/PAIEMENTS_STRIPE.md`.


### Soutien financier des projets — décision de périmètre, 19 octobre 2026

Le fondateur souhaite ajouter un don libre à tous les projets approuvés et publiés, selon leur visibilité. L'organisateur reçoit les fonds via Stripe Connect et Belconnect prélève 5 %. Ce parcours est distinct de la participation non financière et du paiement d'une activité. La migration V22 enregistre chaque intention de don, le montant, la commission et son état. Le formulaire de la fiche projet crée une session Stripe Checkout en mode test uniquement si les deux secrets serveur et le compte organisateur sont prêts. Le retour navigateur ne confirme jamais le don ; seul un webhook signé, avec montant, devise et session vérifiés, le marque payé. Un suivi personnel apparaît dans « Mon espace ». Aucun don réel n'est encore encaissé localement ; une recette Stripe de bout en bout et les règles de frais/remboursement restent à finaliser. Voir `docs/SOUTIEN_FINANCIER_PROJETS.md`.

Validation : 34 tests backend réussis, dont un scénario de webhook signé, montant erroné, paiement différé, doublon et événement d'expiration après confirmation. Compilation et lint du frontend réussis. Migration V22 appliquée à la base locale ; API saine.

### Participation payante aux projets — 19 octobre 2026

Le fondateur confirme une participation à prix fixe avec nombre de places choisi par l'organisateur, une commission Belconnect de 5 % et un remboursement intégral si l'organisateur annule. Le parcours test est codé séparément du don et des aides, avec offre administrable, réservation temporaire, Stripe Checkout, webhook signé, suivi dans « Mon espace » et annulation avec remboursement. Voir `docs/PARTICIPATION_PAYANTE_PROJETS.md`. La recette Stripe test complète, le traitement des remboursements asynchrones et la décision sur les frais Stripe restent nécessaires avant tout paiement réel.

### Abonnement des espaces — préparation test, 19 octobre 2026

Le fondateur retient Starter gratuit et Pro à 10 € HT/mois par espace au lancement, avec une commission de transaction de 5 % inchangée. Le suivi, Checkout Stripe Billing et le portail de gestion sont préparés en mode test, avec confirmation par webhook signé. Les avantages concrets de Pro et la fiscalité du prix restent à définir ; aucun droit n'est encore limité ou débloqué par la formule. Voir `docs/ABONNEMENT_ORGANISATEURS.md`.


### Commission différenciée — 19 octobre 2026

Décision actualisée : Starter gratuit paie 8 % de commission et Pro à 10 € HT/mois paie 5 %, sur toutes les transactions (activités, dons et participations payantes aux projets). Le taux est déterminé côté serveur à partir de l'abonnement actif de l'espace et figé en centimes lors de la création de chaque transaction ; un changement de formule ne modifie pas les transactions déjà créées. Les activités payantes restent bloquées tant que leur parcours Stripe complet n'est pas réalisé. Les paragraphes antérieurs relatent les décisions précédentes.
