# Soutien financier des projets

## Objectif

Ajouter un parcours de don libre à un projet publié, distinct des inscriptions payantes aux activités et des propositions d'aide non financière. Le donateur choisit un montant en euros ; aucun billet, place ou droit d'adhésion n'est créé par ce paiement.

## État actuel

Les projets peuvent être soumis, approuvés et publiés. Les visiteurs autorisés peuvent proposer du bénévolat, des compétences, un partage ou un soutien moral. Le parcours de don en mode test est préparé dans le code, mais aucun don réel, reçu fiscal ou transfert de fonds n'est actuellement effectué par Belconnect. Le cahier initial excluait les dons ; cette extension relève d'une décision plus récente du fondateur.

## Décisions prises

- Tous les projets approuvés et publiés peuvent recevoir un don libre, selon leur visibilité habituelle : public ou membres actifs du groupe.
- Les fonds vont à l'organisateur du projet par Stripe Connect. Belconnect prélève 8 % avec Starter ou 5 % avec Pro du montant total du don.

## Décisions à finaliser

- La prise en charge des frais Stripe, la possibilité de don anonyme et la politique de remboursement. Le premier parcours requiert un compte Belconnect ; aucune promesse d'anonymat n'est faite.
- La formulation des reçus : ne pas promettre de déduction fiscale sans cadre validé.

## Garde-fous de l'implémentation

1. N'afficher le parcours que pour un projet approuvé, publié et actuellement visible au donateur ; vérifier à nouveau ces règles côté serveur au moment du paiement.
2. Enregistrer une intention de don avec son montant en centimes et un identifiant de requête. Contrôler le montant côté serveur et lier l'intention au projet et au donateur, sans la confondre avec `participation_projet`.
3. Créer une session Stripe Checkout en mode test avec un prix calculé côté serveur. Si le bénéficiaire est l'organisateur, exiger son compte Stripe Connect actif.
4. Confirmer le don uniquement après un webhook Stripe signé et vérifié ; gérer les événements répétés, les paiements différés, les échecs et les remboursements.
5. Afficher le suivi du don dans « Mon espace » et un état agrégé sur le projet seulement si son audience et ses règles de confidentialité sont définies.

## Première implémentation en mode test

La migration V22 ajoute les dons avec montant en centimes, commission, espace destinataire, session Stripe et statut. Le formulaire de la fiche projet accepte 1 € à 100 000 € et n'apparaît que si le compte Stripe Connect de l'organisateur est prêt en mode test. Une session Checkout hébergée par Stripe est créée avec un transfert vers ce compte et une commission de 8 % avec Starter ou 5 % avec Pro, arrondie au centime. Le retour navigateur ne confirme pas le don : seul un webhook Stripe signé peut le marquer payé après vérification de la session, du montant et de la devise. « Mon espace » affiche le suivi personnel.

Le serveur n'accepte que `STRIPE_SECRET_KEY` avec le préfixe `sk_test_` et `STRIPE_WEBHOOK_SECRET` pour ce parcours. Ces secrets sont absents de la configuration locale actuelle et ne doivent jamais être ajoutés au dépôt ou au frontend. Il faut ensuite effectuer une recette Stripe test complète, notamment pour les paiements différés, la réconciliation et les remboursements, avant toute activation réelle. Le choix des frais Stripe demeure ouvert. Le premier parcours ne génère aucun reçu fiscal et n'active aucun don en production.
