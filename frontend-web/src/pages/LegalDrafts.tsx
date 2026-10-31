import './LegalDrafts.css';

export function LegalDrafts() {
  return <div className="legal-drafts-page">
    <div className="container">
      <nav className="breadcrumbs" aria-label="Fil d’Ariane"><a href="/">Accueil</a><span>Informations légales</span></nav>
      <p className="eyebrow teal">PRÉPARATION DU LANCEMENT</p>
      <h1 tabIndex={-1}>Confidentialité et règles de Belconnect</h1>
      <p className="legal-drafts-notice" role="status"><strong>Brouillons de la version locale.</strong> Belconnect n’a pas encore de structure enregistrée. Ces informations décrivent le projet en développement ; elles ne sont pas des conditions définitives pour un service ouvert au public.</p>
      <nav className="legal-drafts-nav" aria-label="Rubriques juridiques">
        <a href="#confidentialite">Confidentialité</a><a href="#cookies">Cookies</a><a href="#conditions">Utilisation</a><a href="#paiements">Paiements</a><a href="#mentions">Mentions légales</a>
      </nav>
      <section id="confidentialite" className="legal-drafts-card">
        <h2>Confidentialité et droits sur vos données</h2>
        <p>Pour fonctionner, Belconnect utilise les informations du compte, les inscriptions aux activités, les demandes liées aux espaces et groupes, les projets et les propositions d’aide. Les organisateurs autorisés peuvent consulter les coordonnées nécessaires à la gestion de leurs inscriptions. Les parcours de paiement sont prévus via Stripe, mais aucun paiement réel n’est ouvert dans cette version locale.</p>
        <p>Selon les conditions du RGPD, vous pouvez demander l’accès, la rectification ou l’effacement de vos données, ainsi que l’exercice d’autres droits. Dans « Mon espace → Réglages du compte », vous pouvez modifier votre nom et demander la suppression du compte avec votre mot de passe. Cette suppression désactive l’accès et anonymise le profil ; elle ne supprime pas nécessairement les contenus déjà partagés ni les données à conserver pour les paiements. L’export des données, le contact dédié, les durées de conservation, les prestataires et la procédure complète de demande restent à définir avant l’ouverture publique.</p>
        <p>Pour comprendre vos droits, consultez le <a href="https://www.edpb.europa.eu/topics/key-gdpr-concepts/data-subject-rights_en" target="_blank" rel="noopener noreferrer">Comité européen de la protection des données</a>.</p>
      </section>
      <section id="cookies" className="legal-drafts-card">
        <h2>Cookies</h2>
        <p>Le cookie de session <code>JSESSIONID</code> maintient la connexion et protège l’accès au compte. Le code actuel n’ajoute pas de publicité ciblée ni d’outil d’analyse d’audience. Si des traceurs non nécessaires sont ajoutés, leur usage devra être expliqué et soumis à un choix préalable adapté.</p>
      </section>
      <section id="conditions" className="legal-drafts-card">
        <h2>Règles d’utilisation</h2>
        <p>Les activités sont des rendez-vous auxquels on s’inscrit ; les projets poursuivent un objectif et peuvent recevoir une aide bénévole, une participation à une action payante ou un don. Les organisateurs doivent publier des informations exactes et disposer des droits nécessaires sur leurs textes et images. L’usage frauduleux, les offres trompeuses et la publication de données d’autrui sans autorisation sont interdits.</p>
        <p>Les règles définitives concernant les signalements, les suspensions, les mineurs et les responsabilités respectives de Belconnect et des organisateurs restent à valider.</p>
      </section>
      <section id="paiements" className="legal-drafts-card">
        <h2>Paiements et remboursements prévus</h2>
        <p>Le modèle prévu verse les fonds à l’organisateur via Stripe Connect. Belconnect retient une commission de 8 % en formule Starter ou de 5 % en formule Pro ; l’abonnement Pro est prévu à 10 € HT par mois et par espace. Si l’organisateur annule une activité ou une action payante, un remboursement intégral est prévu. L’annulation par un participant ne déclenche pas de remboursement automatique, sans préjudice des droits légaux applicables.</p>
        <p>Le bénéficiaire exact, les taxes, les frais Stripe, le droit de rétractation applicable et les règles de remboursement des dons doivent être validés et affichés avant tout encaissement réel. Aucun reçu fiscal n’est promis pour un don.</p>
      </section>
      <section id="mentions" className="legal-drafts-card">
        <h2>Mentions légales à compléter</h2>
        <p>L’exploitant légal de Belconnect n’est pas encore enregistré. Sa dénomination, son adresse, son numéro d’entreprise, ses coordonnées de contact et les informations sur l’hébergeur seront affichés ici après leur confirmation. Ces renseignements ne peuvent pas être remplacés par une identité fictive.</p>
      </section>
    </div>
  </div>;
}
