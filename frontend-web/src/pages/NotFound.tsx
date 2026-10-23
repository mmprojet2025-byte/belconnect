import { tr, useLocale } from '../lib/locale';

export function NotFound() {
  const locale = useLocale();
  return <section className="container service-notice">
    <p className="eyebrow teal">{tr(locale, 'PAGE INTROUVABLE', 'PAGE NOT FOUND', 'PAGINA NIET GEVONDEN')}</p>
    <h1 tabIndex={-1}>{tr(locale, 'Cette page n’existe pas ou a été déplacée', 'This page does not exist or has moved', 'Deze pagina bestaat niet of is verplaatst')}</h1>
    <p>{tr(locale, 'Vérifiez l’adresse ou retrouvez les découvertes disponibles sur Belconnect.', 'Check the address or explore what is available on Belconnect.', 'Controleer het adres of ontdek het aanbod op Belconnect.')}</p>
    <a className="button navy" href="/">{tr(locale, 'Retour à l’accueil', 'Back to home', 'Terug naar start')}</a>
  </section>;
}
