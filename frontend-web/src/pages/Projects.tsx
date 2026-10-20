import { ProposeHelp } from '../components/ProjectParticipations';
import { ProjectDonation } from '../components/ProjectDonation';
import { PaidProjectParticipation } from '../components/PaidProjectParticipation';
import { Icon } from '../components/Icon';
import { helpTypes } from '../lib/helpTypes';
import { useEffect, useState } from 'react';
import { result } from '../lib/auth';
import './Projects.css';
import './ProjectShowcase.css';

type Project = {
  id: number; title: string; description: string; objective: string; spaceName: string;
  groupName: string | null; visibility: string; startsOn: string | null; endsOn: string | null;
  imageUrl: string | null; helpTypes: string[]; participationPriceCents: number | null; publishedAt: string;
};
const euro = (cents: number) => (cents / 100).toLocaleString('fr-BE', { style: 'currency', currency: 'EUR' });
const date = (value: string) => new Intl.DateTimeFormat('fr-BE', { dateStyle: 'long' }).format(new Date(`${value}T12:00:00`));
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');

function ProjectCard({ project }: { project: Project }) {
  return <article className="published-card">
    <div className="project-card-photo">
      <a href={`/projets/${project.id}`} aria-label={`Découvrir : ${project.title}`}>
        {project.imageUrl ? <img src={project.imageUrl} alt="" loading="lazy" /> : <span className="project-photo-empty"><Icon name="users" /></span>}
      </a>
      <span className="project-photo-badge">Projet collectif</span>
    </div>
    <div className="project-card-content">
      <p className="project-card-kicker">{project.visibility === 'GROUPE' ? 'Réservé au groupe' : 'Ouvert à tous'}{project.startsOn && ` · Débute le ${date(project.startsOn)}`}</p>
      <h3><a href={`/projets/${project.id}`}>{project.title}</a></h3>
      <p className="project-card-description">{project.objective}</p>
      <div className="project-card-bottom"><span>{project.spaceName}</span><strong>Découvrir le projet →</strong></div>
    </div>
  </article>;
}

export function Projects({ id, compact = false, signedIn = false }: { id?: string; compact?: boolean; signedIn?: boolean }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(id ? `/api/projects/${encodeURIComponent(id)}` : '/api/projects', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(result).then(value => { if (!controller.signal.aborted) setProjects(id ? [value] : value); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Les projets sont indisponibles.'); });
    return () => controller.abort();
  }, [id, attempt]);

  const filtered = (projects ?? []).filter(project =>
    normalize(`${project.title} ${project.spaceName} ${project.description} ${project.objective}`).includes(normalize(query))
  );
  const project = id ? projects?.[0] : null;
  const retry = () => { setError(''); setProjects(null); setAttempt(value => value + 1); };

  if (id) return <div className="project-detail-page container">
    <nav className="breadcrumbs" aria-label="Fil d’Ariane"><a href="/">Accueil</a><Icon name="chevron" /><a href="/projets">Projets</a></nav>
    {error ? <div role="alert"><p>{error}</p><button className="button outline" onClick={retry}>Réessayer</button></div>
      : projects === null ? <p role="status">Chargement du projet…</p>
      : project && <>
        <div className="project-detail-heading"><span className="project-tag">{project.visibility === 'GROUPE' ? 'Réservé au groupe' : 'Projet public'}</span><h1 tabIndex={-1}>{project.title}</h1><p>Proposé par <strong>{project.spaceName}</strong>{project.groupName && ` · ${project.groupName}`}</p></div>
        <div className="project-detail-layout">
          <div className="project-detail-hero">{project.imageUrl ? <img src={project.imageUrl} alt={`Illustration du projet ${project.title}`} /> : <div className="project-photo-empty"><Icon name="users" /></div>}<span>Un projet à construire ensemble</span></div>
          <aside className="project-detail-aside" aria-label="Participer au projet">
            <p className="eyebrow teal">AGISSEZ AVEC CE PROJET</p>
            <h2>Votre aide compte</h2>
            <p className="project-aside-intro">Choisissez comment contribuer à cet objectif collectif.</p>
            <div className="project-aside-fact"><Icon name="calendar" /><div><strong>Période du projet</strong><span>{project.startsOn ? date(project.startsOn) : 'Début à préciser'}{project.endsOn ? ` — ${date(project.endsOn)}` : ''}</span></div></div>
            <div className="project-aside-fact"><Icon name="users" /><div><strong>Organisé par</strong><span>{project.spaceName}</span></div></div>
            <a className="button coral project-aside-primary" href="#help-title">Proposer mon aide <Icon name="arrow" /></a>
            {project.participationPriceCents != null && <a className="project-aside-link" href="#paid-project-title">Voir l’action à {euro(project.participationPriceCents)} <Icon name="arrow" /></a>}
            <a className="project-aside-link" href="#project-donation-title">Faire un don <Icon name="arrow" /></a>
            <p className="project-aside-note">Une proposition d’aide n’est pas une réservation d’activité.</p>
          </aside>
          <main className="project-detail-main">
            <section className="project-detail-panel project-detail-copy"><h2>Le projet</h2><p>{project.description}</p><div className="project-objective-box"><h3><Icon name="leaf" /> Notre objectif</h3><p>{project.objective}</p></div><h3>Les aides recherchées</h3><ul className="project-help-list">{project.helpTypes.map(type => <li key={type}><Icon name="users" />{helpTypes[type] ?? type}</li>)}</ul></section>
            <ProposeHelp key={project.id} projectId={project.id} signedIn={signedIn} availableTypes={project.helpTypes} />
            <PaidProjectParticipation projectId={project.id} signedIn={signedIn} />
            <ProjectDonation projectId={project.id} signedIn={signedIn} />
          </main>
        </div>
        <a className="text-link project-back-link" href="/projets">← Voir tous les projets</a>
      </>}
  </div>;

  return <section className={`published-projects ${compact ? 'projects-compact' : ''}`}>
    <div className={compact ? '' : 'project-catalogue-intro'}><div className={compact ? '' : 'container'}>
      {!compact && <nav className="breadcrumbs" aria-label="Fil d’Ariane"><a href="/">Accueil</a><Icon name="chevron" /><span>Projets</span></nav>}
      <p className="eyebrow teal">DES IDÉES QUI NOUS RAPPROCHENT</p>
      {compact ? <h2>Des projets qui rapprochent</h2> : <h1 tabIndex={-1}>Les projets près de vous</h1>}
      <p>Un projet poursuit un objectif concret dans la durée. Découvrez comment aider à le réaliser ; les activités, elles, sont des rendez-vous à réserver.</p>
    </div></div>
    <div className={compact ? '' : 'container'}>
      {!compact && <div className="project-catalogue-controls"><label>Rechercher un projet<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Un titre, un espace, une idée…" /></label></div>}
      {error ? <div role="alert"><p>{error}</p><button className="button outline" onClick={retry}>Réessayer</button></div>
        : projects === null ? <p role="status">Chargement des projets…</p>
        : <><p className="project-results-count" role="status">{filtered.length} {filtered.length > 1 ? 'projets trouvés' : 'projet trouvé'}</p>
          {!filtered.length ? <div className="published-empty"><h3>{query ? 'Aucun projet ne correspond à votre recherche' : 'Les prochaines idées prennent forme'}</h3><p>{query ? 'Essayez un autre mot-clé.' : 'Aucun projet publié n’est disponible pour le moment. Revenez découvrir les prochaines initiatives.'}</p></div>
            : <div className="published-grid">{(compact ? filtered.slice(0, 3) : filtered).map(item => <ProjectCard key={item.id} project={item} />)}</div>}
          {compact && <a className="button outline" href="/projets">Tous les projets</a>}
        </>}
    </div>
  </section>;
}
