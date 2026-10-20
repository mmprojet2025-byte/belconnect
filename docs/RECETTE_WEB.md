# Recette du site web — état du 19 octobre 2026

## Parcours visiteur vérifié en local

- L'accueil charge les activités de démonstration et les liens de navigation.
- Le catalogue charge sept activités et affiche ses filtres, son tri et sa pagination.
- La fiche gratuite « Fresque participative » présente date, lieu, disponibilité et bouton d'inscription.
- Les pages Projets et Groupes affichent leur état vide actuel, sans erreur de chargement.
- La page Connexion affiche le formulaire. « Mon espace » redirige vers cette page sans session.
- Le serveur web, l'API et PostgreSQL répondent en local. Le serveur web a dû être relancé avant la recette.

## À vérifier dans la suite de ce lot

- Avec un compte participant pilote : inscription gratuite, nombre de places, suivi dans « Mon espace », modification et annulation. Ne pas utiliser les comptes ou données existants sans choisir un scénario de test.
- Formulaires de création de compte et de récupération du mot de passe ; vérifier l'e-mail reçu dans Mailpit pour le test local.
- Affichage et navigation sur écran de téléphone, puis parcours complet sur l'adresse HTTPS pilote.
- Créer des projets et groupes pilotes publiés pour vérifier leurs fiches et interactions ; la base locale n'en présente pas actuellement au visiteur.

Cette recette ne valide pas les paiements Stripe ni l'envoi par un service e-mail réel ; ils sont suivis dans [le périmètre de lancement](PERIMETRE_V1_WEB.md).
