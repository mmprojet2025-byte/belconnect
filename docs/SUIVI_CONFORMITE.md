# Belconnect suivi du cahier des charges et des maquettes

État au 18 octobre 2026. Projet concerné : `/Users/Malaba/Projects/belconnect`.

Le développement couvre déjà une partie importante du parcours des projets et des inscriptions gratuites. Il ne couvre pas encore tout le cahier des charges, et les tableaux de bord ne reproduisent pas entièrement les maquettes Stitch. Le premier lot de gestion des espaces et groupes est maintenant implémenté. Le parcours d’adhésion aux groupes est également réalisé localement. La désignation des référents, la délégation des adhésions et le cycle de vie des groupes sont disponibles. Un premier parcours administratif de création et publication d’activités est désormais réalisé.

## Références et règles de lecture

- [Cahier des charges V1.1](</Users/Malaba/Downloads/BelConnect/Belconnect Cahier Des Charges.docx>) : exigences fonctionnelles initiales.
- [Planning original](</Users/Malaba/Downloads/BelConnect/Belconnect_Planning_Previsionnel_Detaille_Gantt.xlsx>) : 98 tâches, dont les identifiants sont repris ci-dessous et dans le [suivi détaillé](SUIVI_PLANNING.md).
- [Contexte de référence](</Users/Malaba/Downloads/BelConnect/BELCONNECT_CONTEXTE_REFERENCE.md>) : décisions et hypothèses métier. Les décisions explicites ultérieures de l'utilisateur prévalent, notamment Java 25.
- [Dernier export Stitch](</Users/Malaba/Downloads/stitch_belconnect_activities_discovery_platform.zip>) : espaces par rôle, variantes R2 et une vue mobile du participant sans groupe. Cet export complète les précédentes maquettes des activités et projets.
- [Journal du projet](../README.md), sources backend, web et mobile : état de réalisation local.

Le cahier des charges et le planning originaux restent inchangés. Le planning conserve ses statuts historiques « À faire » ; ce suivi ne les remplace pas dans le classeur. Aucun pourcentage global n'est calculé à partir des estimations initiales.

**Réalisé localement** signifie que le parcours limité décrit existe. **Partiel** signifie qu'une partie de l'exigence manque. **À développer** désigne une fonction absente du code inspecté. **À valider** désigne une décision métier, une recette ou un travail externe dont la réalisation n'est pas établie. Ces statuts ne constituent pas une validation de mise en production.

## Tableau fonctionnel

| Fonction attendue | Planning | État | Réalisation et reste à faire |
|---|---|---|---|
| Backend et migrations PostgreSQL | 03.01 | Réalisé localement | Spring Boot et Flyway ; exploitation et sauvegardes restent distinctes. |
| Socle web responsive | 03.02, 03.40 | Partiel | React et pages fonctionnelles ; recette exhaustive mobile et accessibilité à faire. |
| Inscription, connexion, déconnexion | 03.03 | Réalisé localement | Sessions serveur, mots de passe hachés, CSRF et limitation des tentatives. |
| Profil et mot de passe oublié | 03.04 | Partiel | Profil affiché ; modification du profil et réinitialisation par e-mail absentes. |
| Rôles et isolation des données | 03.05, 02.13 | Partiel | Contrôles sur projets et espaces existants ; administration complète des rôles et permissions par groupe absente. |
| Espaces organisateurs | 03.06 | Partiel | Demande d’ouverture, approbation/refus par le propriétaire, attribution initiale et modification de l’espace disponibles. Cycle de vie complet restant. |
| Création, modification et visibilité des groupes | 03.07 | Partiel | Création/modification des groupes actifs, couverture par URL HTTPS, catalogue public/privé et modes d’adhésion disponibles. Import de fichiers restant. |
| Adhésion ouverte ou sur demande | 03.08, 03.09 | Réalisé localement | Adhésion immédiate ou demande, acceptation/refus motivé par l’administrateur et suivi. Création d’appartenances de membre uniquement après acceptation ; aucun contournement des suspensions. Notifications et délégation restent distinctes. |
| Désignation et permissions des référents | 03.10, 03.11 | Partiel | Rôle reconnu pour l'examen des projets ; désignation et permissions configurables absentes. |
| Administration directe et déléguée | 03.12 | Partiel | Intervention directe de l'administrateur sur les projets ; gestion complète des groupes restante. |
| Suspension et archivage des groupes | 03.13 | Partiel | Certains contrôles d'activité existent ; cycle de gestion et historique consultable à compléter. |
| Création et publication des activités | 03.14–03.17 | Partiel | Formulaire, galerie, dates, clôture, visibilité et publication gratuite par administrateur ; import, délégation et paiement restants. |
| Catalogue et détail des activités | 03.18 | Réalisé localement | Lecture API et filtres web ; contenu initial de démonstration. |
| Inscriptions gratuites | 03.19 | Partiel | Création, modification, annulation et capacité ; limite actuelle de 1 à 4 places, capacité illimitée et échéance distincte du début non couvertes. |
| Paiements des activités | 03.20–03.22 | À développer | Écran de simulation ; aucun encaissement réel ni confirmation serveur du prestataire. |
| Liste organisateur des inscrits et export | 03.23 | À développer | L'utilisateur voit ses inscriptions ; ce n'est pas le registre organisateur. |
| Annulation et remboursements | 03.24 | Partiel | Annulation gratuite avant le début ; politique définitive et remboursement payant à établir. |
| Brouillon de projet | 03.25 | Partiel | Titre, description, objectif, dates et groupe ; images et types d'aide recherchée manquants. |
| Soumission et suivi des statuts | 03.26 | Réalisé localement | Soumission du contenu sauvegardé et contrôle des droits. |
| Examen et corrections | 03.27 | Réalisé localement | Avis du référent, corrections et nouvelle soumission avec même projet et historique. |
| Décision finale et publication | 03.28 | Réalisé localement | Administrateur de l'espace ; approbation distincte de publication, retrait possible. Cas de son propre projet à arbitrer. |
| Catalogue public des projets | 03.29 | Réalisé localement | Projets effectivement publiés, détail et contrôle des accès réservés au groupe. |
| Propositions d'aide non financière | 03.30 | Réalisé localement | Aide, suivi personnel, acceptation/refus administratif et annulation. Ce ne sont pas des billets. |
| Participation gratuite ou payante et soutien financier aux projets | Complément récent | Partiel | Aide non financière disponible ; réservation/participation structurée, paiement et soutien financier absents. |
| Annonces et commentaires des groupes | 03.31–03.33 | À développer | Publication, modération et épinglage absents. |
| Notifications et e-mails | 03.34, 03.35 | À développer | Pas d'envoi lors des changements de statut, adhésions ou inscriptions. |
| Mon espace membre ou auteur | 03.36 | Partiel | Inscriptions, espaces, projets et aides ; groupes, annonces et notifications incomplets. |
| Espaces administrateur et référent | 03.37, 03.38 | Partiel | Actions projets intégrées à un espace commun ; tableaux de bord dédiés et gestion complète manquants. |
| Propriétaire de plateforme | 03.39 | Partiel | Lecture des espaces ; pas de back-office complet de modération, signalements et configuration. |
| Application mobile | 02.08, 03.40, 03.41 | Partiel | Expo installé, écran de démarrage ; pas encore de parcours Belconnect relié à l'API. PWA et application native sont deux choix distincts. |
| Production et exploitation | 05.01–05.08 | À développer / à valider | Configuration locale ; hébergement, sauvegardes, supervision, paiements, e-mails et recette de production restants. |

### Repères dans le code

- Authentification : [AuthController](../backend/src/main/java/be/belconnect/backend/auth/AuthController.java) et [SecurityConfig](../backend/src/main/java/be/belconnect/backend/auth/SecurityConfig.java).
- Espaces et rôles : [WorkspaceController](../backend/src/main/java/be/belconnect/backend/workspace/WorkspaceController.java).
- Projets : [brouillons](../backend/src/main/java/be/belconnect/backend/project/DraftController.java), [examen](../backend/src/main/java/be/belconnect/backend/project/ProjectReviewController.java), [publication](../backend/src/main/java/be/belconnect/backend/project/ProjectPublicationController.java), [aides](../backend/src/main/java/be/belconnect/backend/project/ProjectParticipationController.java).
- Activités et inscriptions : [ActivityController](../backend/src/main/java/be/belconnect/backend/activity/ActivityController.java), [BookingController](../backend/src/main/java/be/belconnect/backend/booking/BookingController.java).
- Interface : [AccountPage](../frontend-web/src/pages/AccountPage.tsx), [PaymentPage](../frontend-web/src/pages/PaymentPage.tsx), [mobile](../mobile/src/app/index.tsx).

## Écarts et décisions à conserver visibles

| Sujet | Constat | Traitement proposé |
|---|---|---|
| Ordre du planning | Le parcours projet a avancé avant la gestion autonome des espaces et groupes. | Revenir à cette fondation ; conserver les parcours projet déjà réalisés. |
| Financement des projets | Le cahier initial exclut les dons ; les décisions récentes envisagent trois parcours, dont soutien financier. | Garder ces parcours dans le suivi, sans les considérer réalisés ni les reporter silencieusement en V2. Définir leurs règles avant paiement réel. |
| Projet créé par un administrateur | Le code empêche l'auto-approbation ; la publication directe reste une hypothèse de maquette. | Arbitrer ce cas explicitement avant modification des droits. |
| Accès aux brouillons | Le brouillon est privé à son auteur ; la formulation « tous les projets » de l'administrateur est plus large. | Confirmer la confidentialité attendue des brouillons. |
| Authentification | Le cahier évoque des jetons ; le web utilise des sessions avec cookies et CSRF. | Formaliser ce choix technique et le futur accès mobile ; ne pas supprimer les protections existantes. |
| Java | Le contexte ancien cite Java 21 ; Java 25 a été demandé et installé. | Retenir la décision récente. |
| Maquettes des rôles | Les fonctions projet sont présentes, mais la composition des écrans R2, compteurs, cartes et panneaux n'est pas entièrement reprise. | Reprendre chaque rôle après disponibilité de ses données et actions. |
| Identité graphique | Les écrans R2 diffèrent des écrans d'activités et du style actuel. | Choisir la référence visuelle commune avant harmonisation globale. |
| Sauvegarde des brouillons | La maquette suggère une sauvegarde automatique ; le code demande une sauvegarde explicite. | Conserver un libellé fidèle au comportement ; décider séparément de l'autosauvegarde. |
| Contenu fictif Stitch | Budgets, soutiens, statistiques, sélecteurs de rôles de démonstration et mentions institutionnelles ne sont pas des règles validées. | Ne pas transformer ces exemples en droits réels, chiffres réels ou statut « Belconnect ASBL ». |
| Communication | Certains écrans évoquent un fil direct ; le cahier prévoit annonces et commentaires, sans messagerie privée temps réel en V1. | Implémenter d'abord annonces/commentaires ; arbitrer toute extension. |
| Maquette mobile | Une vue mobile R2 du participant sans groupe existe. | Elle ne couvre pas la recette mobile de tous les rôles. |
| Gestion du code | Le projet actif n'est pas un dépôt Git ; l'ancien dossier possède un dépôt distinct. | Initialiser le suivi du bon dossier dans un lot technique dédié, sans confondre les deux projets. |

## Premier lot proposé espaces groupes et rôles

Objectif : permettre de préparer et utiliser une communauté depuis l'interface, sans insertion SQL manuelle. Le lot 1A est réalisé pour les fonctions décrites ci-dessous, avec couverture par URL ; le lot 1B est réalisé pour l’adhésion et les décisions, avec les limites décrites dans le README ; le lot 1C reste à développer. La recette utilisateur et la vérification mobile du nouveau panneau restent à faire.

### Lot 1A Espaces et groupes implémenté avec limites

Planning : 03.06, 03.07, fondation de 03.12. Disponible : gestion d’un espace autorisé, création/modification des groupes actifs, description, couverture par URL et paramètres de visibilité et d’adhésion. Le catalogue et les adhésions du lot 1B utilisent désormais ces paramètres. Les maquettes administrateur et référent servent de référence, avec états vide, chargement, succès et erreur.

**Décision validée sur l’ouverture des espaces.** Décision utilisateur du 18 octobre : un compte actif demande l’ouverture ; le propriétaire approuve. Implémenté : l’approbation crée l’espace et donne au demandeur le rôle administrateur de cet espace uniquement. La désignation initiale du propriétaire reste une opération explicite sur un compte existant actif.

Critères d'acceptation :

- L'administrateur autorisé crée et modifie un groupe de son espace depuis le web ; les données persistent après rechargement.
- Un autre administrateur, membre ou visiteur ne peut pas modifier ce groupe, y compris par appel direct à l'API.
- Le groupe appartient à un seul espace ; les identifiants fournis par le client ne permettent pas de changer de périmètre.
- Les états d'erreur sont compréhensibles, sans perdre les saisies ; la page fonctionne sur ordinateur et téléphone.
- Les parcours projets existants restent utilisables avec les groupes créés.

### Lot 1B Adhésions et membres implémenté avec limites

Planning : 03.08, 03.09, partie de 03.36 et 03.37. Rejoindre un groupe ouvert, demander l'accès à un groupe sur demande, consulter son statut et traiter les demandes. Règle implémentée : une acceptation crée une appartenance de membre à l’espace si nécessaire et au groupe, sans changer un rôle existant. Une demande en attente ne crée aucune appartenance. Un accès suspendu ou retiré bloque la nouvelle adhésion.

Critères : aucune double adhésion active ; aucune acceptation hors de l'espace autorisé ; aucune inscription à un groupe archivé ; une participation publique à une activité ou un projet n'ajoute pas automatiquement un membre au groupe. L'utilisateur voit un état fiable après rechargement. Les e-mails et notifications sont une dépendance distincte 03.34–03.35 : leur absence doit rester explicite lors de la recette de ce lot.

### Lot 1C Référents et administration déléguée

Planning : 03.10–03.13, partie de 03.38. Désigner un ou plusieurs référents par groupe, gérer leurs permissions et compléter suspension/archivage en préservant l'historique.

Critères : le référent n'agit que dans ses groupes avec les permissions accordées ; le retrait d'une permission prend effet côté serveur ; l'administrateur garde son intervention directe ; le propriétaire ne devient pas approbateur systématique des projets ; aucune suppression de rôle ne doit laisser un espace sans responsable selon la règle retenue.

### Vérification du lot

Tester les accès croisés entre deux espaces, les deux modes d'adhésion, les demandes concurrentes et les changements de rôle. Recetter les écrans avec les rôles membre, référent et administrateur et vérifier la non-régression des projets. Présenter ensuite le résultat à Malaba avant de déclarer ce lot conforme aux maquettes.

## Vérifications déjà disponibles et limites

La suite complète du backend du 18 octobre 2026 à 16 h 58 rapporte 18 tests réussis, sans erreur ni échec (`/tmp/belconnect-space-tests.log`). Compilation et lint web réussis. Recette navigateur isolée réalisée pour la demande, l’approbation, la création/modification de groupe et la conservation des saisies sur erreur. La migration V13 est appliquée au serveur local. Ces résultats ne valident pas les fonctions absentes ni une mise en production. Le redimensionnement navigateur à 390 px n’ayant pas été appliqué par l’outil, le contrôle visuel mobile de ce panneau reste ouvert.

Les paiements réels, e-mails, restauration de sauvegarde, accessibilité complète et parcours natifs sur appareil restent à vérifier après leur implémentation. Le [suivi des 98 tâches](SUIVI_PLANNING.md) distingue également les travaux techniques des décisions commerciales et de la recette utilisateur.

### Vérification complémentaire des adhésions

Le 18 octobre 2026, la suite complète passe à 20 tests backend réussis (`/tmp/belconnect-membership-tests.log`). Compilation et lint web réussis. Parcours navigateur de demande, adhésion ouverte et acceptation vérifiés sur simulation isolée. Catalogue et filtre contrôlés à 390 px sans débordement. Invitations privées, sortie volontaire, renouvellement après refus, notifications et délégation référent restent hors de ce lot. Le propriétaire de la plateforme ne remplace pas l’administrateur pour ces décisions.

### Lot 1C — livraison partielle : référents et adhésions

Désignation/retrait de plusieurs référents par groupe réalisés, avec conservation de l’adhésion, version et historique. Liste limitée aux membres actifs, sans e-mails. Les référents consultent leurs membres et leurs permissions. L’administrateur peut leur déléguer le traitement des adhésions du groupe ; cette permission est désactivée par défaut et s’applique à tous ses référents. Les droits sont revérifiés côté serveur après retrait ou suspension ; l’administrateur garde la décision finale sur les projets.

23 tests backend passent, dont accès croisés, CSRF, révocation, versions périmées et décisions concurrentes avec retrait de permission. Compilation et lint web réussis. Recette navigateur isolée des parcours administrateur/référent ; vue mobile 390 px sans débordement. Migration V15 appliquée, serveur local sain. Aperçus fictifs dans `docs/images/referents-demo.png` et `referents-mobile-demo.png`.

03.10 est réalisé localement ; 03.11, 03.12 et 03.38 restent partiels. Les permissions d’annonces/activités et la suspension/archivage des groupes restent ouverts. Le lot 1C complet et la conformité intégrale aux maquettes ne sont donc pas déclarés terminés.

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
