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
| 01.06 | Valider règles de paiements, annulations et remboursements | À valider | Analyse terrain, règles commerciales ou validation finale non établies par le code ; voir décisions du bilan. |
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
| 03.04 | Créer récupération mot de passe et profil | Partiel | Profil affiché ; modification et réinitialisation de mot de passe absentes. |
| 03.05 | Implémenter rôles et contrôle d'accès | Partiel | Désignation et retrait des référents, isolation des groupes et permission d’adhésion réalisés ; autres permissions à compléter. |
| 03.06 | Créer espaces organisateurs et isolation multi-organisateur | Partiel | Demande d’ouverture, décision propriétaire, attribution initiale et modification de l’espace disponibles ; cycle de vie complet restant. |
| 03.07 | Créer groupes et paramètres de visibilité | Partiel | Groupes actifs gérés, catalogue public/privé et modes d’adhésion opérationnels ; import de couverture restant. |
| 03.08 | Implémenter adhésion ouverte/sur demande | Réalisé localement | Adhésion ouverte ou demande, suivi personnel ; appartenance espace/groupe créée seulement après acceptation. Notifications restantes. |
| 03.09 | Gérer acceptation/refus et statut des membres | Réalisé localement | Acceptation/refus par administrateur ou référent autorisé du groupe ; version, isolation et révocation vérifiées. |
| 03.10 | Nommer un ou plusieurs référents par groupe | Réalisé localement | Liste des membres actifs, désignation de plusieurs référents et retrait conservant l’adhésion ; historique et contrôle de version. |
| 03.11 | Configurer droits des référents par groupe | Partiel | Permission de traiter les adhésions configurable par groupe, désactivée par défaut ; permissions annonces/activités restantes. |
| 03.12 | Gérer administration directe et déléguée | Partiel | Administration directe et délégation des adhésions réalisées ; autres modules délégués restants. |
| 03.13 | Suspendre et archiver les groupes | Réalisé localement | Suspension, réactivation des groupes suspendus et archivage administratif avec conservation des données ; contrôle de version et historique. |
| 03.14 | Créer formulaire d'activité et images | Partiel | Formulaire administrateur et galerie locale disponibles ; import de photos restant. |
| 03.15 | Gérer dates, lieux, places, tarifs, échéances | Partiel | Date, lieu, durée, capacité bornée, tarif de brouillon et clôture distincte ; paiements réels et capacité illimitée restants. |
| 03.16 | Rattacher activité à 0 ou 1 groupe / visibilité | Réalisé localement | Espace obligatoire, groupe actif facultatif et visibilité publique/privée ; catalogue, détail et réservations filtrés côté serveur. |
| 03.17 | Gérer brouillons, publication et workflow référent | Partiel | Brouillon, modification, publication gratuite et retrait sans inscription confirmée par administrateur ; délégation référent et annulation organisateur restantes. |
| 03.18 | Créer catalogue, détail et filtres d'activités | Réalisé localement | Catalogue API, détail et filtres web ; contenu initial de démonstration. |
| 03.19 | Gérer inscriptions gratuites, capacité et doublons | Partiel | Réservation gratuite, capacité, doublons et clôture gérés ; 1 à 4 places par inscription, capacité illimitée restante. |
| 03.20 | Préparer compte organisateur prestataire de paiement | À développer | Simulation visuelle seulement ; aucun paiement réel ni webhook serveur. |
| 03.21 | Créer paiement activité et suivi de session | À développer | Simulation visuelle seulement ; aucun paiement réel ni webhook serveur. |
| 03.22 | Vérifier paiement serveur, idempotence, expiration | À développer | Simulation visuelle seulement ; aucun paiement réel ni webhook serveur. |
| 03.23 | Créer liste des inscrits et accès du référent | À développer | Registre organisateur des participants et export absents. |
| 03.24 | Gérer annulation selon politique finalisée | Partiel | Annulation gratuite disponible ; politique définitive et remboursements payants restants. |
| 03.25 | Créer brouillon projet avec objectifs, images et aide | Partiel | Brouillons présents ; images et types d’aide recherchée manquants. |
| 03.26 | Soumettre projets et gérer leurs statuts | Réalisé localement | Soumission sauvegardée, statuts et permissions contrôlés. |
| 03.27 | Examen projet par référent et demandes de correction | Réalisé localement | Avis, corrections et nouvelle soumission du même projet avec historique. |
| 03.28 | Validation finale admin et publication projet | Réalisé localement | Décision administrative et publication explicite ; cas du propre projet administrateur à arbitrer. |
| 03.29 | Catalogue et page détail des projets | Réalisé localement | Liste et détail des projets publiés, contrôle des accès. |
| 03.30 | Participation non financière et suivi des intérêts | Réalisé localement | Aide non financière, traitement et annulation ; aucun soutien financier ni billet implicite. |
| 03.31 | Créer annonces de groupe et fil chronologique | À développer | Annonces, commentaires, modération, notifications et e-mails absents. |
| 03.32 | Ajouter commentaires et contrôle d'accès | À développer | Annonces, commentaires, modération, notifications et e-mails absents. |
| 03.33 | Modération des commentaires, annonces épinglées | À développer | Annonces, commentaires, modération, notifications et e-mails absents. |
| 03.34 | Créer notifications in-app | À développer | Annonces, commentaires, modération, notifications et e-mails absents. |
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

