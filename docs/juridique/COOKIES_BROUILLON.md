# Notice sur les cookies de Belconnect — brouillon avant lancement

**Statut : document de travail, à vérifier sur l'environnement déployé avant publication.**

Belconnect utilise un cookie de session `JSESSIONID` pour reconnaître une personne connectée. Il est configuré `HttpOnly` et `SameSite=Lax`, avec une expiration de session après 30 minutes d'inactivité. En production HTTPS, l'attribut `Secure` devra être activé. Le jeton CSRF protège les actions du compte. Ces mécanismes sont nécessaires à la connexion et à la sécurité du service.

Le code web examiné ne contient pas de traceur publicitaire ou d'outil d'analyse d'audience. **[Vérifier les cookies et stockages réellement déposés par l'hébergement, les contenus externes et les prestataires avant publication.]** Stripe Checkout, s'il est activé, s'ouvre sur une page hébergée par Stripe avec ses propres informations de confidentialité.

Si Belconnect ajoute un traceur non strictement nécessaire (mesure d'audience non exemptée, publicité ou personnalisation), il devra informer les visiteurs et recueillir leur choix avant son dépôt, avec une possibilité de refus et de retrait. Une bannière ne doit pas être ajoutée uniquement pour le cookie de session nécessaire ; l'information sur ce cookie reste toutefois requise.

Contact : **[adresse e-mail]**. Date d'effet : **[à compléter]**.

Source de préparation : [APD belge, cookies et autres traceurs](https://www.autoriteprotectiondonnees.be/professionnel/themes/internet/cookies).
