# Politique de confidentialité — brouillon interne

> **NON PUBLIABLE — RESPONSABLE, RÔLES, PRESTATAIRES ET DURÉES À VALIDER.** Version de travail du 3 novembre 2026.

## Responsable et contacts

Responsable du traitement : **[dénomination, forme, adresse, BCE]**. Contact données : **[e-mail/adresse]**. DPO : **[coordonnées ou décision motivée qu’aucune désignation n’est requise]**.

Pour les données de participants accessibles à un organisateur, **[DÉCISION REQUISE : qualifier, par finalité, Belconnect et l’organisateur comme responsables indépendants, conjoints ou responsable/sous-traitant et fournir l’information/accord approprié]**.

## Traitements à documenter

- **Compte et authentification** : nom, prénom, e-mail, mot de passe haché, avatar, état du compte, sessions web/mobile, réinitialisation et journaux de connexion. Finalités : créer et sécuriser le compte. Base pressentie : contrat et intérêt légitime de sécurité **[valider]**.
- **Activités et projets** : inscriptions, coordonnées, places, aide proposée, offres payantes, dons, statuts et remboursements. Finalités : exécuter la demande et gérer l’offre. Bases : contrat et obligations légales **[valider selon l’acteur]**.
- **Espaces et groupes** : demandes, rôles, adhésions, invitations, publications et historique de gestion. Finalités : collaboration et administration. Base pressentie : contrat.
- **Interactions** : commentaires, mentions J’aime, messages privés, notifications, blocages et signalements. Finalités : communication, fonctionnement et modération. Bases : contrat et intérêt légitime **[documenter la mise en balance]**.
- **Support/contact** : identité, e-mail, catégorie, message, souhait de réponse, adresse réseau/limitation anti-abus et historique de traitement. Bases : mesures précontractuelles/contrat et intérêt légitime de sécurité **[valider]**.
- **Paiements** : références Stripe, montants, commissions, compte connecté, statuts, factures/reçus et litiges ; les cartes sont saisies chez Stripe. Bases : contrat et obligations comptables/fiscales **[valider]**.
- **Sécurité et administration propriétaire** : sessions, MFA, codes de récupération hachés, journaux d’actions et modération. Base : intérêt légitime et obligations de sécurité **[valider]**.
- **Notifications push** : identifiant appareil et jeton Expo lorsque l’utilisateur active/emploie la fonction. **[Identifier Expo et la base juridique ; définir désactivation et durée.]**

Ne pas traiter les appartenances à certains groupes ou projets comme anodines : elles peuvent révéler indirectement des informations sensibles. Limiter strictement l’accès et éviter toute inférence ou ciblage.

## Destinataires et transferts

Accès limité aux utilisateurs concernés, administrateurs/référents habilités, organisateurs pour gérer leurs participants, propriétaire Belconnect pour les fonctions d’assistance/modération dûment protégées, et prestataires nécessaires.

Prestataires à compléter : **[hébergeur/API/base et pays]**, **[e-mail]**, **[Expo/push]**, Stripe pour paiements/abonnements, **[CDN, sauvegardes, surveillance]**. Pour chacun : finalité, rôle, contrat art. 28 le cas échéant, sous-traitants ultérieurs, localisation et mécanisme de transfert hors EEE. Stripe peut aussi agir comme responsable propre pour certaines finalités ; le rôle doit être décrit sans le présenter uniformément comme simple sous-traitant.

## Conservation

**Aucune durée finale n’est décidée.** Avant publication, fixer une durée et une règle d’effacement/anonymisation pour : comptes actifs et supprimés ; sessions/réinitialisations/MFA ; inscriptions et adhésions ; contenus/messages ; signalements et journaux ; contacts/support ; appareils push ; paiements, factures et litiges ; sauvegardes. Les obligations comptables ne justifient que les données nécessaires aux pièces concernées.

Le module contact permet désormais de dater le traitement et d’anonymiser explicitement le nom, l’e-mail, le lien utilisateur et le texte. **[Fixer le délai d’anonymisation automatique ou procédural.]**

## Suppression du compte et droits

Le parcours automatisé réauthentifie l’utilisateur, bloque la suppression si des responsabilités ou paiements actifs subsistent, annule certaines inscriptions gratuites futures, retire les adhésions, révoque les sessions mobiles et pseudonymise le compte. Il ne supprime pas automatiquement tous les contenus, messages, traces de modération ou références financières. Il faut expliquer les exceptions finalité par finalité et offrir un examen manuel.

La personne peut demander accès, rectification, effacement, limitation, portabilité lorsque applicable et opposition aux traitements fondés sur l’intérêt légitime. Demande à **[contact]** ; réponse en principe sous un mois, avec vérification d’identité proportionnée et explication de tout refus. Réclamation possible auprès de l’[Autorité de protection des données](https://www.autoriteprotectiondonnees.be/).

## Sécurité, cookies et incidents

Mesures observées : mots de passe hachés, cookies `HttpOnly`/`SameSite`, CSRF, sessions révocables, limitation de tentatives, MFA des opérations propriétaire sensibles et audit de certaines actions. **[Confirmer `Secure` en production, chiffrement, sauvegardes, habilitations, tests, réponse aux violations et délais de notification.]** Voir la [notice cookies](COOKIES_BROUILLON.md).

## Mineurs et modifications

**[DÉCISION REQUISE : âge minimum, autorisation parentale et protections ; aucune date de naissance n’est collectée aujourd’hui.]** Date d’effet/version : **[à compléter]**. Informer avant toute modification substantielle.

Sources : [RGPD](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32016R0679) ; [Commission européenne — principes](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en) ; [Commission européenne — droits](https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en) ; [APD — effacement](https://www.autoriteprotectiondonnees.be/professionnel/rgpd-/droits-des-citoyens/droit-a-l-effacement) ; [APD — intérêt légitime](https://www.autoriteprotectiondonnees.be/professionnel/rgpd-/bases-juridiques/interet-legitime).
