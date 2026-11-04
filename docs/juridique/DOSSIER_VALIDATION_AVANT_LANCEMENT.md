# Questions bloquantes avant publication

> **À répondre par l’exploitant, le produit et le conseil juridique.** Version du 3 novembre 2026.

**Contexte confirmé par le porteur du projet :** Belconnect est actuellement développé par une personne seule et la création d’une SRL est envisagée ultérieurement sous la dénomination provisoire « MM Projet ». L’orthographe du nom envisagé est confirmée ; sa disponibilité et la dénomination finalement retenue dans l’acte constitutif doivent encore être vérifiées. Tant que la SRL n’est ni constituée ni enregistrée, aucun brouillon ne doit la présenter comme l’exploitant. Les mentions définitives devront identifier la personne ou l’entité juridiquement responsable au moment de l’ouverture.

**État commercial actuel :** Belconnect est en développement/test. Le backend exige des identifiants Stripe de test (`sk_test_` et sessions `cs_test_`) et la documentation du dépôt confirme qu’aucun paiement réel n’est activé. Aucune vente, souscription ou collecte payante réelle n’est ouverte au public à ce stade.

1. Vérifier la disponibilité de « MM Projet » et confirmer cette dénomination dans l’acte constitutif de la future SRL, puis renseigner BCE, TVA, siège, établissement, e-mail, téléphone, administrateur, représentant, responsable de publication et responsable du traitement.
2. Quels hébergeur, base, e-mail, push, CDN, sauvegarde et surveillance seront utilisés, dans quels pays, avec quels contrats et transferts hors EEE ?
3. L’organisateur est-il le vendeur/prestataire et responsable indépendant des données participants ? Dans quels traitements Belconnect est-il intermédiaire, responsable propre, conjoint ou sous-traitant ?
4. Qui peut s’inscrire : âge minimum, mineurs, autorisation parentale et catégories d’activités ? Comment appliquer la règle sans date de naissance actuelle ?
5. Quelles durées exactes pour comptes supprimés, inscriptions, adhésions, contenus/messages, contacts, signalements, logs/MFA, push, paiements, pièces comptables et sauvegardes ?
6. Les tarifs 8 % Starter, 5 % Pro et 10 €/mois sont-ils définitifs ? Sont-ils HT/TTC, qui paie Stripe, qui facture, et comment traiter TVA, chargebacks et soldes négatifs ?
7. Quelle politique pour annulation participant, annulation organisateur, force majeure, changement d’événement, dons, abonnements et opérations déjà payées ? Pour quelles offres l’exception de rétractation « loisir daté » est-elle applicable ?
8. Quel point de contact et quel workflow couvrent tous les signalements : accusé, examen, motivation, recours, délais, autorités et conservation ? Quelles obligations DSA s’appliquent ?
9. Quel canal manuel complète la suppression automatisée et assure accès, export/portabilité, rectification, opposition et effacement ? Qui répond sous un mois et comment l’identité est-elle vérifiée ?
10. Quelles assurances, licences, contrôles/KYC et obligations de sécurité/accessibilité sont exigés des organisateurs ?
11. Quelles coordonnées de réclamation et quel règlement extrajudiciaire sont applicables ?
12. Qui valide juridiquement les textes finaux, à quelle date, et comment version, preuve d’information/acceptation et confirmation sur support durable sont-elles conservées ?

## Vérifications techniques après réponses

- Exécuter un inventaire réel des cookies/stockages sur le domaine de production et activer `Secure`.
- Tester Stripe de bout en bout : vendeur affiché, total/taxes, bouton payant, confirmation, reçu, annulation, remboursement, échec, webhook et reprise.
- Tester suppression et demande RGPD sur toutes les tables, sauvegardes et accès organisateur ; documenter ce qui reste et pourquoi.
- Vérifier que les pages finales sont accessibles avant inscription/commande, dans web et mobile, sans champ interne.
- Enregistrer la version des conditions acceptées si une acceptation contractuelle est utilisée.
