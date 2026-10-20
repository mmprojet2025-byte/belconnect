# Recette du site web — état du 20 octobre 2026

## Lot 1 — Résistance aux erreurs

Validé localement le 20 octobre 2026. Le catalogue rend maintenant ses états de chargement/erreur aux pages concernées, sans masquer la navigation, la connexion, la récupération du mot de passe, les projets ou les brouillons légaux. Les entrées invalides sont isolées ; si aucune entrée reçue n’est exploitable, une erreur est affichée plutôt qu’un faux catalogue vide. Un échec d’actualisation conserve les données et formulaires déjà affichés avec un avertissement ; un changement d’identité efface le catalogue précédent.

Une route inconnue affiche une page dédiée. Les erreurs HTTP distinguent droits, session, absence, conflit, limitation et indisponibilité. Une interruption après envoi avertit que l’opération peut avoir été enregistrée, sans relancer automatiquement la demande. Une erreur de rendu dans le contenu de page affiche un recours et laisse la navigation accessible.

Preuves :

- `cd frontend-web && npm test` : 24 tests réussis dans `src/resilience.test.tsx`, avec réponses réseau simulées.
- Scénarios : catalogue 503, attente sans réponse, timeout à 10 secondes, entrée invalide isolée, catalogue entièrement invalide, reprise au réessai, accès indépendant connexion/récupération/projets/informations légales, route inconnue, fiche directe puis remontée, saisie conservée après interruption ou rafraîchissement échoué, effacement au changement de session, statuts HTTP et erreur de rendu.
- `npm run lint` et `npm run build` : réussis.
- Navigateur sur le serveur local réel : catalogue de sept activités chargé ; route inexistante avec navigation conservée, titre approprié et retour accueil.

Les pannes sont simulées dans les tests React, sans arrêter le serveur utilisé par le fondateur. Aucun compte ni paiement réel n’a été modifié. Le backend n’a pas changé ; sa suite n’a pas été relancée pour ce lot. La page introuvable est une réponse de l’interface SPA : le statut HTTP servi par l’hébergeur et les liens directs restent à vérifier au lot de déploiement. Les pages légales définitives restent au lot 4.

## Parcours visiteur vérifié en local

- L'accueil charge les activités de démonstration et les liens de navigation.
- Le catalogue charge sept activités et affiche ses filtres, son tri et sa pagination.
- La fiche gratuite « Fresque participative » présente date, lieu, disponibilité et bouton d'inscription.
- La page Groupes affiche son état vide actuel, sans erreur de chargement. Les projets de démonstration sont décrits ci-dessous.
- La page Connexion affiche le formulaire. « Mon espace » redirige vers cette page sans session.
- Le serveur web, l'API et PostgreSQL répondent en local. Le serveur web a dû être relancé avant la recette.

## À vérifier dans la suite de ce lot

- Avec un compte participant pilote dans le navigateur : inscription gratuite, nombre de places, suivi dans « Mon espace », modification et annulation. Ne pas utiliser les comptes ou données existants sans choisir un scénario de test.
- Formulaires de création de compte et de récupération du mot de passe ; vérifier l'e-mail reçu dans Mailpit pour le test local.
- Affichage et navigation sur écran de téléphone, puis parcours complet sur l'adresse HTTPS pilote.
- Créer des groupes pilotes publiés pour vérifier leurs fiches et interactions ; la base locale n'en présente pas actuellement au visiteur.

Cette recette ne valide pas les paiements Stripe ni l'envoi par un service e-mail réel ; ils sont suivis dans [le périmètre de lancement](PERIMETRE_V1_WEB.md).

## Vérification automatisée du parcours participant

Le 20 octobre, `AuthApiTests` (1 test) et `BookingApiTests` (2 tests) passent sans échec. Ces tests créent leurs propres comptes et activités temporaires, puis les suppriment. Ils vérifient notamment la création de compte, la session, l'accès privé aux inscriptions, la réservation gratuite, la capacité et les tentatives simultanées, la modification, l'annulation et la libération des places. Le parcours complet dans l'interface reste à observer avec un compte pilote avant de le déclarer validé.

## Projets de démonstration

Quatre projets fictifs ont été ajoutés au profil local sous « Belconnect Démo » : jardin partagé, boîtes à livres, accès numérique pour tous et mémoire vivante du quartier. Les deux derniers financent une partie de leur objectif par des ateliers à 12 € ou des balades à 18 € ; ce sont des actions du projet, pas son objectif. Les quatre présentent le don libre. Leur titre et leur description signalent qu'il s'agit d'exemples ; ils ne sont pas chargés par le profil de production. Les offres payantes sont visibles, mais les paiements et dons restent fermés jusqu'au raccordement de Stripe test et d'un compte organisateur Connect. Le catalogue, les quatre fiches et les prix des deux offres payantes sont visibles sans connexion. La lecture publique de ces offres est couverte par un test ciblé, tandis que leur gestion reste protégée.

Le catalogue utilise quatre photos locales, des cartes illustrées et une recherche par titre, espace, description ou objectif. Il présente d'abord le but de chaque projet et évite de le classer par prix : l'aide bénévole reste possible même lorsqu'une action du projet est payante. Chaque fiche présente l'objectif, la démarche, l'organisateur, les dates et les parcours d'aide, de participation payante et de don. Les quatre URL d'images sont enregistrées par le peuplement local, sans modifier une image déjà choisie par un administrateur. Vérification dans le navigateur : quatre cartes et fiches visibles, images chargées ; largeur mobile 390 px sans débordement horizontal. Lint et compilation du frontend réussis ; sept tests API des dons et participations aux projets réussis.

La fiche projet reprend ensuite la structure visuelle de la fiche activité : photo à gauche, panneau d'action à droite, contenu en cartes blanches et objectif mis en évidence. Le panneau propose l'aide bénévole en premier, puis des liens distincts vers l'action payante et le don. Sur mobile, l'ordre est photo, panneau d'action, puis contenu détaillé. Cette présentation ne transforme pas une proposition d'aide en réservation d'activité.
