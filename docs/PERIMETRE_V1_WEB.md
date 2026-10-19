# Belconnect — périmètre de lancement du site web

État de travail au 19 octobre 2026. Ce document sert à terminer **le site web** sans confondre fonctionnalités codées en local et lancement public validé. Les décisions explicites du fondateur prévalent.

## Inclus dans la V1 web

- Visiteur : consulter les activités, groupes et projets effectivement publiés, selon leur visibilité.
- Participant : créer un compte, se connecter, récupérer son mot de passe, gérer son profil, réserver et modifier/annuler une inscription gratuite, suivre ses inscriptions et ses aides aux projets.
- Organisateur et référent autorisé : gérer espace, groupes, adhésions, annonces simples, activités et inscriptions ; soumettre, examiner, approuver et publier des projets dans les droits déjà définis.
- Paiements dès le lancement : activités payantes, dons libres aux projets, participations payantes aux projets et abonnement organisateur Starter/Pro. Tous ces parcours doivent passer une recette Stripe **en mode test** avant toute activation réelle. Starter : 8 % ; Pro : 10 € HT/mois et 5 % sur les transactions. L'annulation d'une activité ou d'une offre payante par l'organisateur entraîne le remboursement intégral des participants concernés. Si un participant annule sa propre inscription à une activité, aucun remboursement automatique n'est prévu.
- E-mail de récupération du mot de passe vers une vraie boîte, HTTPS, base sauvegardée, pages d'information validées et parcours critiques vérifiés sur l'adresse pilote.

## À reporter pour garder un site simple

Application mobile Expo, PWA, publicité et suivi publicitaire, commentaires de groupe et leur modération, annonces épinglées, tableaux de bord avancés et capacité illimitée. L'import de photos peut aussi attendre : les espaces, groupes et projets utilisent des URL HTTPS ; les activités ont actuellement une galerie locale. Ces reports sont des **choix de périmètre proposés**, pas des fonctions terminées.

## Écarts bloquants à lever

1. Recette web complète par rôle, sur ordinateur et téléphone, avec corrections des anomalies constatées. Les tests automatisés actuels ne remplacent pas cette recette.
2. Raccordement Stripe test : Connect des organisateurs, Checkout, trois types de paiement, abonnement Pro, webhooks signés, paiements échoués et différés, annulations, remboursements et réconciliation. Examiner le cas documenté d'une tentative d'activité sans identifiant de session conservé. Les secrets restent hors de Git et du navigateur.
3. Service SMTP réel et domaine d'expédition vérifié. Mailpit ne sert qu'aux essais locaux.
4. Hébergement, domaine, configuration HTTPS, base et secrets de production, sauvegarde **et restauration vérifiée**, supervision et procédure d'incident.
5. Conditions d'utilisation, confidentialité, mentions légales, règles de paiement et remboursement, et premiers contenus réels validés.
6. Supprimer ou dépublier les exemples dans la **base de lancement**. Le profil `local` insère sept activités fictives ; le profil `prod` ne les insère pas sur une base neuve, mais ne nettoie pas une base qui les contient déjà. Ne pas effacer les données de développement pendant la préparation.

## Décisions et préparations du fondateur hors code

- Choisir domaine, hébergement, service d'e-mail dédié et compte de facturation associé ; valider le domaine d'envoi.
- Activer Stripe Connect en mode test et préparer les comptes d'organisateurs pilotes. Créer le prix Stripe mensuel Pro à 10 € et les endpoints de webhook test. Fournir les clés uniquement à l'environnement privé du serveur.
- Décider qui prend en charge les frais Stripe, la politique de remboursement des dons et le traitement des reçus ; faire valider les textes commerciaux et juridiques avant la mise en ligne.
- Fournir de vraies activités et projets avec dates, prix, lieux, organisateurs, images et droits d'utilisation ; choisir des comptes pilotes pour chaque rôle.
- Confirmer que les fonctions proposées ci-dessus pour report peuvent attendre après la V1 web.

## Critère de fin de la V1 web

Une personne pilote peut accomplir les parcours inclus sur l'adresse HTTPS du site, avec les droits appropriés, des contenus réels et un suivi exact des paiements et remboursements. Les tests automatisés et la recette par rôle passent ; l'envoi de récupération, les webhooks, une restauration de sauvegarde et les parcours après déploiement ont été observés en conditions pilotes. Les écarts restants sont documentés et acceptés avant ouverture publique.
