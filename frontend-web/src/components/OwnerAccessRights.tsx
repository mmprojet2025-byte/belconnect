import './OwnerAccessRights.css';
export function OwnerAccessRights() {
  return <section className="owner-access-rights" aria-labelledby="owner-rights-title">
    <h3 id="owner-rights-title">Droits d’accès</h3><span className="rights-label">Comprendre les autorisations</span>
    <p>Les autorisations sont contrôlées par le serveur, même lorsqu’une personne essaie d’ouvrir directement une adresse réservée.</p>
    <div className="rights-panel">
      <h4>Qui peut faire quoi ?</h4>
      <details><summary>Membre : participer</summary><p>Le membre utilise ses participations personnelles. Il ne peut pas consulter les finances globales, la liste globale des membres ou les journaux du propriétaire, ni suspendre un espace.</p></details>
      <details><summary>Administrateur : gérer ses espaces</summary><p>L’administrateur gère les espaces pour lesquels il est autorisé. Ce rôle ne donne pas accès aux fonctions du propriétaire. Il peut aussi participer avec le même compte. La suppression d’un droit local doit prendre effet sur la session déjà ouverte.</p></details>
      <details><summary>Référent : gérer son groupe délégué</summary><p>Le référent prépare les activités et projets de son groupe. La publication, gratuite ou payante, nécessite la validation de l’administrateur. Il ne gère ni l’espace entier ni son compte Stripe. Ce rôle n’est pas inclus dans le contrôle propriétaire résumé ci-dessous.</p></details>
      <details><summary>Propriétaire : superviser la plateforme</summary><p>Le propriétaire accède aux fonctions de supervision après sa double authentification. Certaines actions sensibles exigent une vérification récente. Ce rôle ne lui donne pas automatiquement le rôle d’administrateur d’un espace. L’accès mobile du propriétaire reste bloqué tant qu’un parcours de double authentification mobile n’est pas disponible.</p></details>
    </div>
    <div className="rights-panel rights-checks">
      <h4>Dernier contrôle documenté : <time dateTime="2026-11-02">2 novembre 2026</time></h4>
      <p><strong className="rights-result">Tests ciblés réussis</strong> Ce bilan est enregistré dans cette version du site ; il ne s’actualise pas automatiquement et ne constitue pas une surveillance en direct.</p>
      <ul>
        <li>Quinze accès de lecture réservés : refus pour une personne non connectée, un membre et un administrateur. Les comptes membre et administrateur ont aussi été testés avec un jeton mobile.</li>
        <li>Refus des actions testées : suspendre ou réactiver un espace, prendre en charge une demande Pro, récupérer son administration, décider ou rouvrir une demande d’espace.</li>
        <li>Propriétaire sans double authentification : accès refusé aux quinze fonctions de lecture testées.</li>
        <li>Retrait du rôle d’administrateur : l’ancienne session perd l’accès à la gestion des administrateurs de cet espace.</li>
        <li>Tests complémentaires réussis : codes de secours à usage unique, révocation d’une autre session, accès après double authentification et confirmation récente d’une action sensible.</li>
      </ul>
      </div><aside className="rights-next"><h4>À examiner ensuite</h4><p>L’isolation complète entre espaces, groupes et documents, ainsi que les actions non couvertes par ces tests.</p><p className="rights-note">Les contrôles utilisent des comptes dédiés et ne constituent pas un audit complet.</p></aside>
  </section>;
}
