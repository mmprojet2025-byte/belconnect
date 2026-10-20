# Paiements des activités — préparation Stripe

## Décisions prises

- Les activités payantes font partie du lancement initial de Belconnect.
- Stripe est le prestataire choisi.
- Les fonds des activités payantes vont à l'organisateur via Stripe Connect ; Belconnect prélève 8 % avec Starter ou 5 % avec Pro du prix total payé.
- Le fondateur dispose déjà d'un compte Stripe. Son branchement au serveur en mode test reste à effectuer.
- Si l'organisateur annule une activité payante, le participant reçoit un remboursement intégral, commission comprise.
- Si le participant annule lui-même une inscription payante, Belconnect ne déclenche aucun remboursement automatique. Toute décision de remboursement éventuel devra être traitée séparément.
- Le parcours doit rester simple pour le participant : récapitulatif, page de paiement hébergée par Stripe, puis statut de réservation dans « Mon espace ».

## Décisions à obtenir avant l'encaissement

- Qui supporte les frais Stripe ? Le pourcentage de la commission Belconnect est fixé, pas la répartition des frais Stripe.
- Vérifier l'activation Stripe Connect sur le compte du fondateur et l'éligibilité des organisateurs.

## Parcours technique à réaliser

1. Enregistrer une tentative de réservation et retenir temporairement les places sous verrou côté serveur, avec une expiration et une clé d'idempotence. Ne jamais créer directement une inscription confirmée pour une activité payante.
2. Calculer le prix en centimes à partir du tarif enregistré en base et de la quantité autorisée ; ne jamais accepter un montant transmis par le navigateur.
3. Créer une session Stripe Checkout en mode test depuis le backend, liée à la tentative. Si les fonds vont à l'organisateur, vérifier d'abord son compte connecté et sa capacité à recevoir les paiements.
4. Rediriger vers l'URL Checkout de Stripe. La page de retour affiche un état provisoire ; elle ne confirme pas la réservation.
5. Vérifier la signature des webhooks Stripe. Confirmer la réservation seulement après un événement de paiement réussi et une vérification de l'identité de la session, du montant, de la devise et de la tentative. Traiter les événements répétés sans double réservation.
6. Libérer les places retenues si la session expire ou échoue. Prévoir une réconciliation des tentatives restées dans un état incertain après un incident.
7. Pour une annulation par le participant, afficher clairement l'absence de remboursement automatique avant confirmation, annuler l'inscription et libérer les places sans appeler l'API de remboursement. Pour une annulation par l'organisateur, déclencher un remboursement intégral avec restitution de la commission et du transfert, puis suivre son état réel chez Stripe. Ne permettre l'annulation d'une activité payante qu'après ce parcours.
8. Tester la concurrence sur les dernières places, les webhooks en double ou hors ordre, l'expiration, le paiement différé, l'échec et le remboursement.

## État du code au 19 octobre 2026

La migration V26 et `PaidActivityBookingController` préparent les réservations payantes côté serveur : montant calculé depuis le tarif en base, commission Starter/Pro figée au moment de la demande, capacité retenue sous verrou, session Checkout de test avec destination Stripe Connect et consultation privée de l'état. Le webhook signé confirme une inscription une seule fois après vérification du montant, de la devise et de la session ; une expiration ou un échec libère la retenue. Une reprise périodique vérifie auprès de Stripe les sessions enregistrées qui n'ont pas reçu de webhook ; elle applique le même traitement après vérification de l'identité de la session. Une tentative sans identifiant de session conservé en base reste bloquée et est signalée dans les logs pour examen : elle n'est jamais libérée sur la seule base de son ancienneté, car le paiement pourrait avoir réussi chez Stripe. Les tests couvrent ces états et la répétition d'un événement.

L'annulation par l'organisateur est préparée en mode test. L'endpoint `POST /api/managed-activities/{id}/cancel-paid` ferme immédiatement l'activité, tente d'expirer les sessions Checkout ouvertes, traite les paiements terminés et demande à Stripe un remboursement intégral avec inversion du transfert et restitution de la commission. Une clé d'idempotence stable évite les doubles remboursements lors des reprises. L'inscription n'est marquée annulée qu'après succès du remboursement ; les états en attente sont revérifiés périodiquement. « Mon espace » montre au participant le montant payé et l'état du remboursement. L'annulation par le participant ne déclenche aucun remboursement automatique.

L'interface envoie maintenant les activités payantes créées dans Belconnect vers Stripe Checkout et affiche un retour provisoire dans « Mon espace ». Les activités de démonstration gardent la simulation visuelle. Le catalogue soustrait les places retenues par des sessions en attente. La publication d'une activité payante exige une clé Stripe test, un secret de webhook et un compte Stripe Connect dont les paiements et virements sont activés. Aucune clé de production n'est acceptée.

Les tarifs payants doivent atteindre au moins 0,50 € par place et le total d'une réservation ne peut pas dépasser 999 999,99 €, conformément aux [limites de montant documentées par Stripe](https://docs.stripe.com/currencies). Le serveur vérifie ces bornes avant de retenir une place.

**La recette Stripe de bout en bout reste nécessaire avant l'ouverture.** Les clés test ne sont pas configurées localement, donc aucune activité payante ne peut actuellement être publiée ou encaissée ici. Il reste aussi à résoudre les tentatives sans identifiant de session et à vérifier en conditions test réelles le paiement, l'expiration, la concurrence et le remboursement. `PaymentPage.tsx` reste la maquette des seules activités de démonstration.

La migration V21 associe un identifiant Stripe Connect à chaque espace. Seul un administrateur actif peut consulter son état ou ouvrir l'onboarding Stripe depuis « Mon espace ». Le backend exige `STRIPE_SECRET_KEY` avec un préfixe `sk_test_` ; la clé ne doit jamais être placée dans le dépôt, un message ou le frontend. `APP_PUBLIC_URL` définit l'origine de retour (par défaut `http://localhost:5173`). Le bouton reste indisponible tant que la clé de test n'est pas configurée. L'onboarding d'un espace ne publie aucune activité payante.

Références Stripe : [Checkout et webhooks](https://docs.stripe.com/payments/existing-customers?platform=web&ui=stripe-hosted), [sessions Checkout](https://docs.stripe.com/api/checkout/sessions/object), [comptes Connect](https://docs.stripe.com/connect), [remboursements](https://docs.stripe.com/refunds).

## Participations payantes aux projets

Le parcours test de participation aux projets est décrit dans `docs/PARTICIPATION_PAYANTE_PROJETS.md`. Il utilise le même compte Stripe Connect d'espace et le même webhook signé que les dons, avec un identifiant de session préfixé pour distinguer les événements. L'offre impose un prix, une capacité, une date et un lieu. Une reprise périodique vérifie les dons et participations dont le webhook manque. Une tentative sans session enregistrée est signalée et sa place ne se libère pas sans vérification. L'annulation par l'organisateur ferme l'offre puis déclenche un remboursement intégral ; un paiement confirmé après fermeture passe aussi dans la file de remboursement. Aucune clé Stripe de production n'est acceptée par ce parcours.
