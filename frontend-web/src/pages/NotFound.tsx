export function NotFound() {
  return <section className="container service-notice">
    <p className="eyebrow teal">PAGE INTROUVABLE</p>
    <h1 tabIndex={-1}>Cette page n’existe pas ou a été déplacée</h1>
    <p>Vérifiez l’adresse ou retrouvez les découvertes disponibles sur Belconnect.</p>
    <a className="button navy" href="/">Retour à l’accueil</a>
  </section>;
}
