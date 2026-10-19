import { ProposeHelp } from '../components/ProjectParticipations';
import { ProjectDonation } from '../components/ProjectDonation';
import { PaidProjectParticipation } from '../components/PaidProjectParticipation';
import { useEffect, useState } from 'react';
import { result } from '../lib/auth';
import './Projects.css';
type Project = { id: number; title: string; description: string; objective: string; spaceName: string; groupName: string | null; visibility: string; startsOn: string | null; endsOn: string | null; imageUrl: string | null; helpTypes: string[]; publishedAt: string };
export function Projects({ id, compact = false, signedIn = false }: { id?: string; compact?: boolean; signedIn?: boolean }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  useEffect(() => {
    const c = new AbortController();
    fetch(id ? `/api/projects/${encodeURIComponent(id)}` : '/api/projects', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([c.signal, AbortSignal.timeout(15000)]) })
      .then(result).then(value => setProjects(id ? [value] : value)).catch(e => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'Les projets sont indisponibles.'); });
    return () => c.abort();
  }, [id, attempt]);
  const filtered = (projects ?? []).filter(p => `${p.title} ${p.spaceName} ${p.description}`.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')));
  return <section className={`published-projects ${compact ? 'projects-compact' : 'container'}`}>
    {!compact && <a className="text-link" href={id ? '/projets' : '/'}>← {id ? 'Tous les projets' : 'Accueil'}</a>}
    <p className="eyebrow teal">DES IDÉES QUI NOUS RAPPROCHENT</p>
    {compact ? <h2>Des projets qui rapprochent</h2> : <h1 tabIndex={-1}>{id ? projects?.[0]?.title ?? 'Découvrir un projet' : 'Les projets près de vous'}</h1>}
    {!id && <p>Découvrez les projets publiés par les espaces organisateurs. Les projets de groupe sont réservés à leurs membres.</p>}
    {error ? <div role="alert"><p>{error}</p><button className="button outline" onClick={() => { setError(''); setProjects(null); setAttempt(n => n + 1); }}>Réessayer</button></div> : projects === null ? <p role="status">Chargement des projets…</p> : id ? <article className="published-detail">{projects[0].imageUrl && <img className="project-cover-detail" src={projects[0].imageUrl} alt="" referrerPolicy="no-referrer" />}<span className="project-tag">{projects[0].visibility === 'GROUPE' ? 'Réservé au groupe' : 'Projet public'}</span><p>{projects[0].spaceName}{projects[0].groupName && ` · ${projects[0].groupName}`}</p><h2>Le projet</h2><p className="project-copy">{projects[0].description}</p><h2>Notre objectif</h2><p className="project-copy">{projects[0].objective}</p>{(projects[0].startsOn || projects[0].endsOn) && <p>Dates prévues : {projects[0].startsOn || 'à préciser'} — {projects[0].endsOn || 'à préciser'}</p>}<ProposeHelp key={projects[0].id} projectId={projects[0].id} signedIn={signedIn} availableTypes={projects[0].helpTypes} /><PaidProjectParticipation projectId={projects[0].id} signedIn={signedIn} /><ProjectDonation projectId={projects[0].id} signedIn={signedIn} /></article> : <>
      {!compact && <label className="project-search">Rechercher un projet<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Un titre, un espace, une idée…" /></label>}
      {!filtered.length ? <div className="published-empty"><h3>{query ? 'Aucun projet ne correspond à votre recherche' : 'Les prochaines idées prennent forme'}</h3><p>{query ? 'Essayez un autre mot-clé.' : 'Aucun projet publié n’est disponible pour le moment. Revenez découvrir les prochaines initiatives.'}</p></div> : <div className="published-grid">{(compact ? filtered.slice(0, 3) : filtered).map(p => <article className="published-card" key={p.id}>{p.imageUrl && <img className="project-cover-card" src={p.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />}<span className="project-tag">{p.visibility === 'GROUPE' ? 'Réservé au groupe' : 'Projet public'}</span><h3><a href={`/projets/${p.id}`}>{p.title}</a></h3><p>{p.description.length > 180 ? `${p.description.slice(0, 180)}…` : p.description}</p><small>{p.spaceName}</small><a className="text-link" href={`/projets/${p.id}`}>Découvrir le projet →</a></article>)}</div>}
      {compact && <a className="button outline" href="/projets">Tous les projets</a>}
    </>}
  </section>;
}
