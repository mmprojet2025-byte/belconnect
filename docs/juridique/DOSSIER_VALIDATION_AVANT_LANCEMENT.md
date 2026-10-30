# BelConnect — dossier à compléter et faire valider avant ouverture

**Statut : préparation interne, 30 octobre 2026.** Ce dossier ne constitue pas des conditions en vigueur ni un avis juridique. Il rassemble les décisions nécessaires pour finaliser les brouillons du dossier `docs/juridique`, puis les faire vérifier par un juriste belge avant publication.

## 1. Informations de l’exploitant à fournir

- Dénomination ou nom de l’exploitant, forme juridique, adresse professionnelle, numéro BCE et numéro TVA si applicable : **à compléter**.
- Adresse e-mail professionnelle pour les questions générales et les réclamations : **à compléter**.
- Contact dédié aux demandes sur les données personnelles et responsable qui y répond : **à compléter**.
- Hébergeur, fournisseur d’e-mail, fournisseur des images et autres prestataires qui auront accès aux données : **à confirmer**.
- Public visé : décider si les mineurs peuvent créer un compte et, dans ce cas, les protections nécessaires.

Ces informations alimenteront les [mentions légales](MENTIONS_LEGALES_BROUILLON.md), la [politique de confidentialité](POLITIQUE_CONFIDENTIALITE_BROUILLON.md) et les [conditions d’utilisation](CONDITIONS_UTILISATION_BROUILLON.md). Ne pas inventer de coordonnées pour remplir les champs.

## 2. Décisions sur les données personnelles

Pour chaque catégorie ci-dessous, documenter la finalité, la base juridique, qui y accède, les prestataires, le lieu de traitement, la durée de conservation active, le sort des sauvegardes et l’action à effectuer après une demande d’effacement :

- Compte et authentification : nom, e-mail, mot de passe haché, sessions web et mobile, récupération du mot de passe.
- Activités : réservations, contacts communiqués à l’organisateur, commentaires, mentions « J’aime » et notifications.
- Groupes : adhésions, invitations, publications et messages privés.
- Projets : propositions d’aide, inscriptions et contenus publiés.
- Paiements éventuels : références Stripe, factures, remboursements et justificatifs que la loi impose de conserver.
- Journaux techniques, signalements, modération et sauvegardes.

Décider qui répond aux demandes d’accès, de rectification, de portabilité et d’effacement, comment l’identité du demandeur est vérifiée, et comment la réponse est suivie. Préparer une adresse et une procédure avant d’ouvrir au public. La politique devra être accessible au moment de la collecte, pas seulement dans Réglages.

## 3. Suppression du compte : parcours à construire

Le mobile permet la création de compte, mais n’offre pas encore sa suppression. Une simple désactivation ne répond pas à cette exigence. Le code montre que les comptes sont référencés par les réservations, paiements, espaces, groupes, projets, publications, messages et historiques de modération ; une suppression SQL directe casserait ces relations ou retirerait des informations aux autres membres.

Parcours proposé pour validation :

1. Dans « Réglages → Compte », action distincte « Supprimer mon compte » avec explication des conséquences et des données éventuellement conservées pour une obligation légale.
2. Vérification de l’identité, confirmation explicite et traitement idempotent de la demande côté API. Aucune suppression sur un simple clic.
3. Révocation des sessions et des appareils push ; arrêt des nouvelles réservations, messages et notifications destinés au compte.
4. Traitement documenté des réservations, participations, rôles d’administration, projets, contenus, messages, paiements, journaux et sauvegardes. Définir ce qui est supprimé, anonymisé ou conservé et pourquoi.
5. Confirmation de réception et de clôture de la demande, avec traçabilité minimale sans conserver indéfiniment les données effacées.
6. Même possibilité de demande sur le web pour les personnes qui n’ont plus l’application. Si une version Android est publiée sur Google Play, prévoir aussi l’URL de demande exigée dans la fiche du store.

**Décisions bloquantes :** durée de conservation par catégorie ; sort des contenus partagés et des messages chez les autres membres ; transfert ou fermeture d’un espace dont le demandeur est seul responsable ; gestion des paiements et obligations comptables ; délai et canal de confirmation. Ne pas activer un bouton de suppression avant que ce parcours soit opérationnel et testé.

## 4. Conditions commerciales à valider

- Pour chaque activité ou action payante : identifier le vendeur, le prix total, les frais, les modalités d’annulation, le remboursement et l’information sur le droit de rétractation applicable.
- Pour les dons : déterminer le bénéficiaire, la qualification juridique, les frais et les règles de remboursement. Ne pas promettre d’avantage fiscal sans validation.
- Pour les abonnements organisateurs : préciser TVA, renouvellement, résiliation et effet sur les commissions.
- Définir qui traite les réclamations : BelConnect, l’organisateur ou les deux selon les cas.

Voir le [brouillon paiements et remboursements](PAIEMENTS_REMBOURSEMENTS_BROUILLON.md). Les informations essentielles doivent figurer dans le parcours avant l’engagement ou le paiement, pas uniquement dans Réglages.

## 5. Vérifications avant publication

- Faire compléter et relire les cinq brouillons juridiques par un professionnel compétent en droit belge du numérique, consommation et données personnelles.
- Mettre les versions finales datées dans l’app, sur le web et aux étapes de création de compte ou de paiement pertinentes. Conserver la version acceptée des conditions si une acceptation contractuelle est utilisée.
- Tester le parcours réel de suppression du compte, puis vérifier les données restantes, les sauvegardes et les accès des autres membres.
- Vérifier les règles de publication d’Apple et Google Play, notamment confidentialité, suppression du compte et déclarations de données.

Sources de cadrage : [RGPD, article 13](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32016R0679), [APD, droit à l’information](https://www.autoriteprotectiondonnees.be/professionnel/rgpd-/droits-des-citoyens/droit-a-l-information), [Apple, suppression du compte](https://developer.apple.com/support/offering-account-deletion-in-your-app/), [Google Play, suppression du compte](https://support.google.com/googleplay/android-developer/answer/13327111?hl=fr).
