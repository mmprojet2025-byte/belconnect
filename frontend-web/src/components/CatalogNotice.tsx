import { useCatalog } from "../context/catalogStore";

export function CatalogNotice({ heading = false }: { heading?: boolean }) {
  const { loaded, loading, error, partial, retry } = useCatalog();
  if (loaded && !error && !partial) return null;
  const title = error ? "Les activités sont momentanément indisponibles" : partial ? "Certaines activités ne peuvent pas être affichées" : "Chargement des activités…";
  return <section className="container service-notice" role={error ? "alert" : "status"}>
    {heading ? <h1 tabIndex={-1}>{title}</h1> : <h2>{title}</h2>}
    <p>{error
      ? loaded ? "Les informations affichées n’ont pas pu être actualisées. Vérifiez les disponibilités avant de continuer." : "Réessayez dans un instant. Les autres rubriques du site restent accessibles."
      : partial ? "Les autres activités restent disponibles. Vous pouvez réessayer de charger le catalogue." : "Vous pouvez continuer à explorer les autres rubriques."}</p>
    {(error || partial) && <button className="button outline" disabled={loading} onClick={retry}>{loading ? "Chargement…" : "Réessayer les activités"}</button>}
  </section>;
}
