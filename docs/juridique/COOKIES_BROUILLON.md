# Notice cookies et stockages locaux — brouillon interne

> **NON PUBLIABLE — audit du déploiement requis.** Version de travail du 3 novembre 2026.

## État observé dans le code

Le site utilise `JSESSIONID`, cookie strictement nécessaire à l’authentification. Il est configuré `HttpOnly`, `SameSite=Lax` et expire avec la session après 30 minutes d’inactivité. L’attribut `Secure` dépend de `SESSION_COOKIE_SECURE` et **doit être vérifié à `true` en production HTTPS**. Un mécanisme CSRF protège les actions authentifiées.

La version web de l’application mobile conserve dans `localStorage` le jeton de session et la langue. Sur iOS/Android, ces éléments utilisent le stockage sécurisé de l’appareil. Ces stockages fonctionnels doivent être décrits même lorsqu’aucun consentement n’est requis.

L’examen du dépôt ne révèle aucun outil publicitaire ou de mesure d’audience. Stripe Checkout et le portail Stripe sont externes et peuvent utiliser leurs propres cookies.

## Inventaire à valider en production

- `JSESSIONID` : authentification et sécurité ; durée de session ; destinataire Belconnect.
- jeton CSRF : sécurité ; **[confirmer support et durée exacts]**.
- jeton mobile-web : authentification ; jusqu’à déconnexion, révocation ou expiration serveur.
- langue : confort ; **[confirmer la durée]**.
- **[inventorier tout ajout de l’hébergeur, CDN, contenu intégré, Stripe ou futur prestataire]**.

Aucun bandeau d’acceptation n’est requis pour les seuls mécanismes strictement nécessaires, mais l’information l’est. Tout futur traceur non nécessaire devra être bloqué avant un choix libre, spécifique, éclairé et révocable ; refuser doit être aussi simple qu’accepter, sans mur de cookies ni interface trompeuse.

Contact : **[adresse e-mail]**. Date d’effet et version : **[à compléter]**.

Source : [Autorité de protection des données — cookies](https://autoriteprotectiondonnees.be/professionnel/themes/internet/cookies).
