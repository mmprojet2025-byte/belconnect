# Paiements, remboursements et abonnements — brouillon interne

> **NON PUBLIABLE — VENDEUR, FISCALITÉ ET POLITIQUES COMMERCIALES À VALIDER.** Version de travail du 3 novembre 2026. Le code exige actuellement des identifiants Stripe de test ; aucune ouverture réelle ne doit précéder la validation.

## Architecture observée

Activités payantes, actions de projets et dons utilisent Stripe Checkout avec le compte connecté de l’organisateur. Belconnect calcule une commission de **8 % Starter** ou **5 % Pro**. L’abonnement Pro est configuré à **10 € par mois**. Ces valeurs sont une réalité technique, pas encore une offre contractuelle approuvée.

**[DÉCISIONS REQUISES : vendeur/prestataire et bénéficiaire de chaque flux ; prix TTC/HT ; TVA ; frais Stripe ; facturation des commissions ; devise ; versements ; chargebacks et soldes négatifs.]** Le bouton final doit indiquer sans ambiguïté l’obligation de payer et une confirmation durable doit être fournie.

## Réservation et participation payantes

La confirmation dépend du paiement Stripe vérifié. À l’annulation d’une activité payante par l’organisateur, ou à la fermeture d’une offre payante de projet, le code tente le remboursement intégral du montant payé et suit les états en attente. Les opérations incohérentes sont conservées pour reprise plutôt que déclarées remboursées à tort.

Aucun remboursement automatique général n’est prévu quand le participant annule. **[Décider et afficher avant achat : délai, cas remboursables, frais, transfert éventuel, absence à l’événement, changement substantiel et force majeure.]** Pour un loisir à date/période déterminée, l’exception au droit de rétractation peut s’appliquer, y compris via un intermédiaire, mais elle doit être qualifiée pour chaque offre et annoncée avant contrat. Ne pas généraliser cette exception aux dons ou abonnements.

## Dons

Le don ne réserve pas de place et n’ouvre aucun avantage fiscal promis. **[Qualifier juridiquement le versement ; identifier le bénéficiaire ; décider remboursement, erreur/fraude, frais, justificatif et fiscalité.]** Le terme « don » ne doit pas masquer un achat ou une contrepartie.

## Abonnement organisateur

Stripe Billing gère un abonnement mensuel et son portail. **[Confirmer prix TTC/HT, client professionnel ou consommateur, date/renouvellement, essai, paiement échoué, résiliation, fin de période, effet sur commission/fonctions, rétractation et remboursement.]** Informer clairement avant souscription et confirmer le contrat sur support durable.

## Réclamations

Contact : **[coordonnées]**. **[Définir qui répond — organisateur, Belconnect ou les deux — les délais, preuves, escalade Stripe, médiation et journalisation.]** Les droits impératifs priment toujours.

Sources : [SPF Économie — obligations d’information](https://economie.fgov.be/fr/themes/entreprises/guidance/pratiques-commerciales/obligations-dinformation-dans) ; [SPF Économie — vente à distance de voyages/loisirs datés](https://economie.fgov.be/fr/themes/protection-des-consommateurs/voyages/vente-distance-de-voyages) ; [CJUE — droits des consommateurs](https://curia.europa.eu/site/jcms/qua1_5955/en/consumer-rights) ; [Stripe Connected Account Agreement](https://stripe.com/legal/connect-account).
