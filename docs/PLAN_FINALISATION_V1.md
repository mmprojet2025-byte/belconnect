# Plan de finalisation de la V1 web Belconnect

Référence de sortie au 20 octobre 2026. Fondé sur l’[audit critique](AUDIT_V1_2026_10_20.md). **Lot 1 validé localement ; lot 2 à vérifier avec Stripe test ; lot 3 en cours ; lots 4 à 8 à faire.** Les validations locales ne remplacent pas la recette sur l’hébergement cible.

Objectif : permettre à des utilisateurs réels de découvrir, réserver, contribuer et organiser, avec des paiements exacts, des droits respectés et un service exploitable.

## Règles de conduite

- Un lot actif de développement à la fois. Préparations externes du fondateur en parallèle.
- États : à faire → en cours → à vérifier → validé. Un lot reste à vérifier si un compte externe ou une recette manque.
- Pour chaque livraison : changements, preuves, anomalies restantes, décision de validation. L’utilisateur garde la main sur ses commits/push GitHub.
- Pas de publicité, application mobile complète, messagerie, nouveau réseau social, statistiques avancées ou refonte générale dans cette sortie.
- Une nouvelle demande remplace une tâche ou part après V1 ; elle n’allonge pas silencieusement la sortie.

## Ordre des lots

| Lot | Résultat attendu | Responsable principal | Dépendance |
|---|---|---|---|
| 1 — validé localement | Navigation et erreurs fiables, périmètre de sortie figé | Développement | Aucune |
| 2 — à vérifier | Paiements cohérents même en cas d’incident | Développement | Lot 1 pour les retours UI |
| 3 — en cours | Espace personnel et organisateur simple, informations précises | Développement + fondateur | Règles du lot 2 fixées |
| 4 | Comptes, confidentialité, contrats et support prêts | Développement + fondateur + conseil juridique | Identité et décisions externes |
| 5 | Site pilote HTTPS, e-mail, sauvegarde et supervision | Développement + fondateur | Choix hébergement/domaine |
| 6 | Recette Stripe test complète sur le site pilote | Développement + fondateur | Lots 2, 4 et 5 |
| 7 | Recette par rôle, contenus réels et corrections finales | Développement + pilotes | Lots 1 à 6 |
| 8 | Mise en ligne contrôlée et validation finale | Fondateur + développement | Lots 1 à 7 validés |

## Lot 1 — Rendre les parcours fiables

**État : validé localement le 20 octobre 2026.** Preuves et limites dans [la recette du lot 1](RECETTE_WEB.md#lot-1--résistance-aux-erreurs).

Constats : F18, F22, F27.

1. Découpler le chargement des activités de la navigation, connexion, projets et pages légales.
2. Ajouter états d’erreur locaux, réessai et protection contre la page blanche.
3. Différencier erreur de droits, session expirée, page absente, conflit et service indisponible.
4. Tester URL inconnue, lien direct et actualisation sur une fiche.
5. Utiliser ce plan comme suivi unique, avec périmètre web inchangé.

**Terminé quand :** une panne simulée du catalogue ne bloque pas la connexion, les projets ou les informations légales ; l’utilisateur garde ses saisies après une erreur ; les tests et le build passent.

**À fournir par le fondateur :** rien pour commencer.

## Lot 2 — Fermer les risques financiers

**État : à vérifier.** Les correctifs locaux couvrent le rejeu d'abonnement résilié, la retenue de la dernière place, la reprise des dons et participations, les remboursements des offres de projet fermées, la visibilité publique des offres et le rendez-vous obligatoire. Le mode Stripe reste limité aux clés de test. La recette Stripe test avec un vrai compte Connect, puis la configuration live explicite et sa validation, restent ouvertes ; ne pas activer les paiements réels sur cette seule base.

Constats : F01 à F07.

1. Reproduire par tests le rejeu d’un abonnement annulé et la dernière place d’un projet payée avec webhook tardif.
2. Corriger les transitions et verrous, la déduplication et la synchronisation avec Stripe.
3. Ajouter reprise des dons/participations/remboursements ; rendre les incidents détectables et traitables.
4. Corriger les droits des offres publiques de groupes et les retours vers le bon espace.
5. Fixer le contrat simple de l’action payante d’un projet : rendez-vous précis ou activité liée.
6. Vérifier 8 % Starter / 5 % Pro au centime, leur conservation sur les transactions historiques et le remboursement intégral décidé.
7. Préparer un mode live explicitement configuré et cohérent ; le laisser désactivé jusqu’au lot 8.

**Terminé quand :** ni un doublon, ni une notification tardive, ni une annulation concurrente ne créent une double place, une réactivation Pro erronée ou une transaction encaissée oubliée. Un remboursement en attente reste visible et récupérable.

**À décider par le fondateur :** frais Stripe supportés par qui ; remboursement des dons ; plafond V1 ; règles précises de participation payante aux projets. Les droits légaux doivent être validés au lot 4.

## Lot 3 — Simplifier l’usage

**État : en cours.** Les rubriques Participer / Organiser chargent maintenant seulement leur contenu visible ; les réglages d'abonnement et d'encaissement sont repliés. Les favoris éphémères ont été retirés. La fiche projet a un seul repère principal, un titre d'onglet spécifique, un intitulé de catalogue neutre et n'annonce une action payante dans son panneau principal que si elle est réellement ouverte. Les retours des dons et participations sont revérifiés automatiquement. Un visuel neutre remplace les images cassées. Le partage de fiche projet et l'ordre clavier de « Mon espace » sont corrigés ; catalogue Projets, fiche et connexion ont été vérifiés à 390 px. Restent à vérifier : recette complète par rôle sur appareil réel et au clavier, contraste et zoom, précision des contenus réels, vitesse sur réseau mobile et aperçu des liens partagés. Avec quatre projets V1, la pagination n'est pas nécessaire ; la réévaluer si le catalogue grandit.

Constats : F06, F19 à F26.

1. Rendre évidents les parcours « Participer » et « Organiser », avec contexte d’espace et actions adaptées aux droits.
2. Déplacer abonnement et encaissement vers les réglages ; ne charger que la rubrique ouverte.
3. Présenter chaque fiche avec objectif/expérience, organisateur, lieu/date utiles, prix total si achat et action principale.
4. Ne pas proposer comme disponible une action que le serveur ne peut pas réaliser.
5. Retirer les favoris provisoires ou les rendre persistants ; ne pas créer un gros module.
6. Corriger repères HTML, navigation clavier, focus, zoom, contrastes et messages de formulaire.
7. Ajouter secours des images et métadonnées de partage utiles ; mesurer le chargement mobile avant d’optimiser davantage.

**Terminé quand :** un pilote trouve une activité, comprend un projet et trouve son suivi sans explication orale ; un administrateur trouve ses tâches sans parcourir les réglages financiers. Parcours vérifiés à 390 px, au clavier et sur un téléphone réel. Aucune fonction essentielle ne repose seulement sur une couleur ou une icône.

**À fournir :** retours de quelques personnes pilotes et contenus précis. Les maquettes guident l’apparence ; elles ne doivent pas imposer une complexité inutile.

## Lot 4 — Protéger les comptes et préparer la confiance

Constats : F09, F13 à F17.

1. Vérifier les e-mails et durcir la limitation des tentatives ; protéger en priorité les comptes à droits élevés.
2. Revalider la matrice propriétaire/administrateur/référent/membre/participant, y compris révocation et isolation entre espaces.
3. Rendre les demandes d’accès/export/effacement traitables et traçables ; définir purge et conservation.
4. Finaliser confidentialité, cookies, mentions, conditions et remboursements avec les informations de l’exploitant.
5. Publier les pages définitives en production ; les lier aux points de collecte et d’engagement.
6. Ajouter contact/support et signalement simples ; la restriction ciblée avec motif et historique est préparée, mais la procédure de contestation et la revue des réservations/paiements existants restent à terminer avant lancement.
7. Vérifier les contrats des prestataires, les droits sur les images et la politique des mineurs.

**Terminé quand :** un compte ne peut agir hors de ses droits, les informations légales sont accessibles sans session, une demande RGPD fictive a été traitée de bout en bout et le fondateur sait traiter une réclamation. Les brouillons avec champs manquants ne sont pas publiés.

**À faire hors code :** choix/enregistrement du statut de l’exploitant, identité et contact professionnel, relecture juridique belge, fiscalité/facturation avec comptable, responsabilité/assurance et accords organisateurs.

## Lot 5 — Préparer un site qui fonctionne sans le Mac de développement

Constats : F08, F10 à F13, F25.

1. Choisir hébergement, domaine, base et service d’e-mail.
2. Mettre en place un environnement pilote HTTPS séparé de la production ; base sans données personnelles de développement.
3. Exiger les secrets/configurations de production au démarrage ; ne jamais retomber silencieusement sur les valeurs locales.
4. Configurer reverse proxy, cookie Secure, politiques de sécurité, base privée et migrations.
5. Automatiser lint/build/tests et ajouter les scans de dépendances/secrets.
6. Configurer SMTP et domaine d’envoi, puis tester la réception réelle.
7. Planifier sauvegardes chiffrées ; effectuer une restauration séparée et documenter retour arrière.
8. Configurer alertes disponibilité, erreurs, webhooks et remboursements bloqués.

**Terminé quand :** l’adresse pilote fonctionne après redémarrage, l’e-mail arrive, les contrôles automatisés passent, une sauvegarde a été restaurée et une alerte volontairement déclenchée arrive à la bonne personne.

**À faire hors code :** ouvrir/payer les services choisis, DNS, accès privés, domaine d’envoi et destinataire des alertes. Ne transmettre aucune clé dans le chat ; configurer le coffre ou l’environnement serveur.

## Lot 6 — Recette Stripe test

1. Configurer Connect test pour un organisateur pilote, prix Pro mensuel et endpoints de webhook signés.
2. Tester activité payante, don, participation payante projet et abonnement.
3. Pour chaque flux : succès, abandon, refus, double clic, retour tardif, notification répétée et notification manquée.
4. Tester la dernière place en concurrence et l’annulation organisateur pendant un paiement.
5. Vérifier remboursement intégral, remboursement en attente/échec puis reprise ; distinguer l’annulation participant.
6. Vérifier Pro actif, renouvellement, impayé, résiliation et retour à Starter ; vérifier les commissions dans Stripe et dans la base.
7. Vérifier montants, taxes choisies, bénéficiaire et reçus ; simuler les incidents sans argent réel.

**Terminé quand :** une grille conserve pour chaque scénario le résultat du site, le résultat Stripe et l’état en base, sans divergence non résolue. Les tests automatisés seuls ne clôturent pas ce lot.

**À faire hors code :** accès au compte Stripe test, configuration Connect/prix/webhooks/portail et données des organisateurs pilotes.

## Lot 7 — Recette finale par rôle et contenu

| Rôle | Parcours indispensable |
|---|---|
| Visiteur | Recherche, fiche, prix/conditions, erreur 404, lecture des informations légales |
| Participant | Inscription, vérification e-mail, connexion, récupération, réservation gratuite/payante, suivi et annulation |
| Contributeur | Proposition d’aide, réponse, suivi ; don et participation payante clairement distincts |
| Administrateur | Demande d’espace, approbation reçue, publication activité/projet, inscriptions, annulation/remboursement |
| Référent | Voir et exercer uniquement les fonctions déléguées ; perdre l’accès après révocation |
| Propriétaire | Compte de pilotage distinct : approuver/refuser l’ouverture d’un espace, suivre les indicateurs globaux ; aucun parcours participant, membre, auteur de projet ou administrateur local. La gestion du business plan et des aspects techniques reste à définir et à construire avant de la présenter comme disponible. |
| Utilisateur d’un autre espace | Échec des tentatives d’accès aux données et actions qui ne lui appartiennent pas |

1. Remplacer les exemples uniquement dans la base de lancement par des offres réelles validées.
2. Vérifier photos, autorisations, horaires, coordonnées, lieux, prix et organisateurs.
3. Exécuter la matrice sur ordinateur et téléphone réel, avec compte sans droits et comptes pilotes distincts.
4. Tester aussi session expirée, réseau interrompu, onglet doublé et actualisation.
5. Corriger les blocages puis ne rejouer que les scénarios concernés et les contrôles de non-régression utiles.

**Terminé quand :** aucun blocage P0/P1 sans solution vérifiée ; les réserves mineures sont écrites et acceptées. Aucun paiement simulé ou contenu fictif n’est présenté comme réel.

## Lot 8 — Ouverture contrôlée

1. Valider les preuves des sept lots précédents.
2. Configurer les ressources Stripe live distinctes et effectuer un contrôle financier limité, décidé par le fondateur.
3. Déployer la version identifiée, vérifier les migrations, les liens directs et les informations finales.
4. Ouvrir d’abord à un petit groupe d’organisateurs et participants ; surveiller paiements, erreurs et demandes.
5. Conserver un moyen de fermer les nouveaux paiements sans empêcher les remboursements et le support.
6. Corriger les incidents du pilote avant une ouverture plus large.

**V1 terminée quand :** les parcours inclus fonctionnent sur le vrai domaine, les paiements et remboursements sont rapprochés, les droits sont vérifiés, le support sait agir et une restauration est possible. La mise en ligne seule n’est pas ce critère.

## Préparations du fondateur à commencer dès maintenant

| Préparation | Nécessaire pour |
|---|---|
| Identifier l’exploitant, statut, coordonnées professionnelles | Pages légales, contrats, Stripe live |
| Décider frais Stripe, dons, taxes et reçus avec conseil adapté | Finalisation des règles et des textes |
| Choisir domaine, hébergeur, SMTP et budget récurrent | Site pilote |
| Préparer Connect, prix Pro, portail et webhooks test | Recette Stripe |
| Réunir de vraies offres et les droits des images | Catalogue de lancement |
| Choisir comptes pilotes par rôle et contact support | Recette et exploitation |

**Prochain contrôle concret : recette UX du lot 3**, avec un compte participant puis un administrateur sur ordinateur et téléphone. La recette Stripe test du lot 2 reste nécessaire avant validation financière. Le lot 1 sera également revérifié sur l'environnement pilote au moment du déploiement.
