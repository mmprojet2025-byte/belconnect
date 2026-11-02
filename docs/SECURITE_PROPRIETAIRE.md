# Double authentification du propriétaire

## Parcours utilisateur

1. Se connecter sur le web avec le compte propriétaire. Les anciennes sessions passent aussi par le contrôle.
2. Confirmer son mot de passe et ajouter manuellement la clé affichée à une application d’authentification (compte BelConnect, code basé sur le temps, six chiffres).
3. Entrer le code courant du téléphone. L’accès n’est pas ouvert tant que cette confirmation échoue.
4. Conserver les dix codes de récupération affichés une fois, dans un endroit sûr. Chaque code est à usage unique.
5. Aux connexions suivantes, saisir le code du téléphone. En cas de perte, utiliser un code de récupération ; cette action invalide les validations des autres sessions.
6. Après récupération ou pour changer de téléphone, ouvrir Profil → Réglages du compte → Remplacer mon application et mes codes. La nouvelle configuration exige le mot de passe et une session déjà validée. L’ancien second facteur reste actif jusqu’à confirmation du nouveau, qui remplace aussi tous les codes de secours.

Ne pas partager la clé ni les codes par chat. Le propriétaire utilise le web : les nouveaux accès mobiles ainsi que les anciens jetons mobiles sont refusés pour ce rôle tant qu’un parcours mobile équivalent n’existe pas. Les membres et administrateurs d’espace ne sont pas concernés par cette exigence.

## Consulter les logs

Menu vertical du propriétaire → Sécurité affiche les événements du compte connecté, après validation du second facteur. Les vues Connexions et protection / Actions sensibles séparent les accès du compte des décisions de gestion. Les lignes indiquent la date locale, l’action et le résultat. Les actions sensibles affichent aussi la cible actuelle et le motif disponible. Actualiser recharge les derniers événements ; Voir les événements précédents remonte l’historique par pages de 25. Ce journal ne contient aucun secret et ne remplace pas les logs techniques ni un audit complet des connexions. Il enregistre désormais les mots de passe acceptés (avant second facteur), les refus de mot de passe sur un compte propriétaire identifié, les déconnexions volontaires et les réinitialisations du mot de passe. Les tentatives refusées ne prouvent pas l’identité de leur auteur. Les traces antérieures à cette mise à jour ne peuvent pas être reconstituées.

Les actions sensibles sont lues depuis les historiques existants : modération, interventions sur les administrateurs, décisions et révisions de demandes, signalements examinés. Les doublons de correction/ouverture présents dans plusieurs sources sont exclus. La dernière décision d’une demande est lue depuis son état actuel ; ce n’est pas une archive immuable de toutes ses anciennes décisions. Les refus d’autorisation, les expirations de session et les prises en charge Pro ne sont pas encore couverts. Les API de consultation sont protégées par le rôle propriétaire et le second facteur ; elles ne proposent aucune modification ni suppression des logs. Un administrateur technique de la base reste capable de modifier ces données : protection indépendante contre l’altération et politique de conservation restent à définir.

## Sessions et confirmation des actions sensibles

Sécurité → Sessions ouvertes affiche les sessions web utilisées dans les quinze dernières minutes, leur navigateur/appareil indicatifs, l’ouverture, la dernière activité et la session actuelle. Plusieurs onglets partagent souvent une session. Le propriétaire peut révoquer une autre session ou toutes les autres ; le serveur refuse leur prochaine requête. La session actuelle est exclue. Les révocations sont journalisées. Une réinitialisation de mot de passe révoque les sessions enregistrées.

Le registre conserve une empreinte d’un identifiant aléatoire distinct du cookie, jamais le cookie de connexion. Les sessions antérieures à l’installation sont enregistrées à leur prochaine requête. Après un arrêt brutal du serveur, une ancienne session peut rester visible jusqu’à quinze minutes, même si sa session serveur est perdue. Ce registre n’implémente pas à lui seul des sessions partagées entre plusieurs serveurs.

Une validation du second facteur de moins de cinq minutes est requise avant les décisions/corrections/réexamens de demandes, interventions sur les administrateurs, modération, prise en charge Pro et révocations de sessions. Sinon, le serveur refuse l’action et le web ouvre une confirmation ; les saisies sont conservées et l’utilisateur doit relancer l’action après validation. Aucune action n’est automatiquement rejouée.

## Limitation persistante du mot de passe

Les connexions web et mobile partagent une limite en base : cinq échecs sur une adresse de compte déclenchent trente secondes d’attente, puis le délai augmente aux échecs suivants, jusqu’à quinze minutes. Une requête pendant le blocage ne repousse pas son échéance. Une authentification réussie remet les échecs du compte à zéro. Vingt essais par minute et par adresse réseau sont autorisés ; ce compteur n’est pas effacé par une connexion réussie.

La réponse de limitation contient le délai et l’en-tête Retry-After. Les comptes inexistants suivent le même mécanisme. Les compteurs utilisent des empreintes des identifiants et des adresses, sans valeurs en clair ; il ne s’agit pas d’une anonymisation irréversible. Les entrées inactives depuis plus de vingt-quatre heures sont supprimées à l’occasion d’une connexion suivante. Les échecs sont validés en transaction avant de renvoyer l’erreur HTTP ; les accès concurrents au même compteur sont sérialisés.

L’adresse utilisée est celle de la connexion reçue par le serveur, pas un en-tête fourni librement par le client. Un déploiement derrière proxy doit configurer explicitement la transmission fiable de l’adresse source, sinon plusieurs visiteurs partageront la limite du proxy. Un attaquant peut provoquer des délais temporaires sur un compte connu ; il n’existe pas de verrouillage permanent, mais cette limite ne remplace pas la protection réseau contre les attaques distribuées. Les limites de création de compte et de récupération de mot de passe restent, pour l’instant, en mémoire.

## Fonctionnement et exploitation

- TOTP HMAC-SHA1, six chiffres, périodes de trente secondes, tolérance d’une période de part et d’autre, rejet d’un code déjà utilisé. Référence : https://www.rfc-editor.org/rfc/rfc6238
- Secret chiffré AES-256-GCM, avec identifiant utilisateur comme donnée authentifiée. `OWNER_MFA_ENCRYPTION_KEY` doit contenir une clé aléatoire de 32 octets encodée en Base64, conservée hors Git dans le gestionnaire de secrets du déploiement. Sauvegarder cette clé séparément de la base ; la perdre rend les secrets TOTP illisibles. Ne pas la régénérer lors d’un redémarrage.
- Codes de secours aléatoires à 128 bits, stockés uniquement sous forme d’empreinte SHA-256 ; consommation atomique en transaction.
- Tentatives du second facteur et de confirmation du mot de passe persistées en base. Après cinq erreurs, délai progressif de trente secondes jusqu’à quinze minutes ; une vérification réussie remet le compteur à zéro.
- Contrôle serveur global des API du propriétaire avant accès ; expiration de sa session après quinze minutes d’inactivité. Renouvellement de l’identifiant de session après vérification.
- Événements d’activation, vérification, échec et récupération journalisés sans secret ni code.
- Une réinitialisation du mot de passe ne supprime pas le second facteur.

## Limites de cette première étape

L’enrôlement initial repose sur la connexion et une nouvelle saisie du mot de passe : il doit être effectué par le titulaire avant l’exposition publique. Aucun second facteur n’est activé automatiquement pour un compte réel.

La récupération sans téléphone **et sans aucun code** n’a pas de bouton de contournement : une procédure d’assistance avec preuve d’identité et traçabilité reste à définir. Les alertes de connexion et la couverture exhaustive des opérations sensibles restent des étapes suivantes. L’application d’authentification TOTP ne protège pas contre tout phishing.

La clé locale est configurée dans le fichier privé de développement. Pour un autre déploiement, configurer une clé dédiée et HTTPS avant activation. Les anciens tests propriétaires nécessitent désormais un parcours MFA ; la suite complète n’est pas déclarée validée sur la seule base des tests ciblés.
