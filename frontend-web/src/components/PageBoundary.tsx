import { Component } from "react";
import type { ReactNode } from "react";

export class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <section className="container service-notice" role="alert">
      <h1 tabIndex={-1}>Cette page ne peut pas être affichée</h1>
      <p>Une erreur est survenue. La navigation reste disponible. Si vous aviez envoyé une demande, vérifiez son état dans Mon espace avant de recommencer.</p>
      <button className="button outline" onClick={() => this.setState({ failed: false })}>Réessayer l’affichage</button>{" "}
      <a className="button navy" href="/">Retour à l’accueil</a>
    </section>;
  }
}
