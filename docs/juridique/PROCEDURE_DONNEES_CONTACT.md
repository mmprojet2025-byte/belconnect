# Procédure interne — données du formulaire Contact

## Accès et traitement

- Les messages sont accessibles uniquement au compte propriétaire après double authentification.
- Chaque changement de statut est journalisé avec l’auteur, l’ancien statut, le nouveau statut et la date.
- Le statut `TRAITE` enregistre la première date de traitement.

## Demande d’accès, de rectification ou d’effacement

1. Vérifier l’identité du demandeur par un canal adapté aux données demandées.
2. Rechercher le message par son identifiant, son adresse e-mail et sa période d’envoi.
3. Pour un effacement justifié, utiliser l’action d’anonymisation : elle supprime le lien au compte, le nom, l’e-mail, le contenu libre et la demande de réponse, puis archive l’enregistrement.
4. Conserver la trace de l’action d’anonymisation sans recopier les données effacées.
5. Informer le demandeur de l’exécution ou du motif documenté d’un refus.

## Conservation — décision requise avant production

Aucune purge automatique n’est activée tant que le responsable du traitement n’a pas validé :

- la finalité exacte de chaque catégorie de message ;
- la durée de conservation des messages nouveaux, en cours et traités ;
- la durée séparée du journal d’audit ;
- les exceptions nécessaires à la constatation, l’exercice ou la défense de droits en justice.

Après validation, ces durées devront être configurées, documentées dans la politique de confidentialité et couvertes par un test de purge/anonymisation.

## Limitation anti-abus

La limitation utilise une empreinte de l’adresse cliente. Les en-têtes `X-Forwarded-For` ne sont lus que si l’adresse du proxy appartient à `CONTACT_TRUSTED_PROXIES` (liste d’adresses ou de CIDR séparés par des virgules). Cette variable doit correspondre strictement aux proxies contrôlés par l’exploitant.
