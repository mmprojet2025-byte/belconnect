import { ProposeHelp } from '../components/ProjectParticipations';
import { ProjectDonation } from '../components/ProjectDonation';
import { PaidProjectParticipation } from '../components/PaidProjectParticipation';
import { Icon } from '../components/Icon';
import { helpTypes } from '../lib/helpTypes';
import { useEffect, useState } from 'react';
import { result } from '../lib/auth';
import './Projects.css';
import './ProjectShowcase.css';
import './Catalogue.css';

type Project = {
  id: number; title: string; description: string; objective: string; spaceName: string;
  groupName: string | null; visibility: string; startsOn: string | null; endsOn: string | null;
  imageUrl: string | null; helpTypes: string[]; participationPriceCents: number | null; meetingPlace: string | null; publishedAt: string;
};
type OfferPreview = { active: boolean; paymentReady: boolean; priceCents: number; placesLeft: number };
const euro = (cents: number) => (cents / 100).toLocaleString('fr-BE', { style: 'currency', currency: 'EUR' });
const date = (value: string) => new Intl.DateTimeFormat('fr-BE', { dateStyle: 'long' }).format(new Date(`${value}T12:00:00`));
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');

function ProjectCard({ project, compact }: { project: Project; compact: boolean }) {
  return <article className="published-card">
    <div className="project-card-photo">
      <a href={`/projets/${project.id}`} aria-label={`Découvrir : ${project.title}`}>
        {project.imageUrl ? <img src={project.imageUrl} alt="" loading="lazy" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/visuel-indisponible.svg'; }} /> : <span className="project-photo-empty"><Icon name="users" /></span>}
      </a>
      <span className="project-photo-badge">Projet dans la durée</span>
    </div>
    <div className="project-card-content">
      <p className="project-card-kicker">{project.visibility === 'GROUPE' ? 'Réservé au groupe' : 'Ouvert à tous'}{project.startsOn && ` · Du ${date(project.startsOn)}${project.endsOn ? ` au ${date(project.endsOn)}` : ''}`}</p>
      {compact ? <h3><a href={`/projets/${project.id}`}>{project.title}</a></h3>
        : <h2><a href={`/projets/${project.id}`}>{project.title}</a></h2>}
      <p className="project-card-description">{project.objective}</p>
      <p className="project-card-place"><Icon name="pin" />{project.meetingPlace || 'Lieu à préciser'}</p>
      <div className="project-card-bottom"><span>{project.spaceName}</span><strong>{project.participationPriceCents == null ? 'À découvrir' : project.participationPriceCents === 0 ? 'Gratuit' : euro(project.participationPriceCents)}</strong></div>
    </div>
  </article>;
}

export function Projects({ id, compact = false, signedIn = false, userId }: { id?: string; compact?: boolean; signedIn?: boolean; userId?: number }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [draftQuery, setDraftQuery] = useState('');
  const [place, setPlace] = useState('');
  const [draftPlace, setDraftPlace] = useState('');
  const [price, setPrice] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [help, setHelp] = useState('');
  const [sort, setSort] = useState('start');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [offerPreview, setOfferPreview] = useState<OfferPreview | null>(null);
  const [shareMessage, setShareMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(id ? `/api/projects/${encodeURIComponent(id)}` : '/api/projects', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(result).then(value => { if (!controller.signal.aborted) setProjects(id ? [value] : value); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Les projets sont indisponibles.'); });
    return () => controller.abort();
  }, [id, attempt]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    fetch(`/api/project-paid-participations/offer/${encodeURIComponent(id)}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(value => { if (!controller.signal.aborted) setOfferPreview(value); })
      .catch(() => { if (!controller.signal.aborted) setOfferPreview(null); });
    return () => controller.abort();
  }, [id]);

  const helpOptions = [...new Set((projects ?? []).flatMap(item => item.helpTypes))];
  const filtered = (projects ?? []).filter(item => {
    const searchable = `${item.title} ${item.spaceName} ${item.description} ${item.objective} ${item.meetingPlace ?? ''}`;
    if (query && !normalize(searchable).includes(normalize(query))) return false;
    if (place && !normalize(item.meetingPlace ?? '').includes(normalize(place))) return false;
    if (price === 'free' && item.participationPriceCents !== 0) return false;
    if (price === 'paid' && (item.participationPriceCents == null || item.participationPriceCents <= 0)) return false;
    if (help && !item.helpTypes.includes(help)) return false;
    if (from && item.endsOn && item.endsOn < from) return false;
    if (to && item.startsOn && item.startsOn > to) return false;
    if ((from || to) && !item.startsOn && !item.endsOn) return false;
    return true;
  }).sort((a, b) => {
    if (sort === 'newest') return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
    if (sort === 'price') return (a.participationPriceCents ?? Number.MAX_SAFE_INTEGER) - (b.participationPriceCents ?? Number.MAX_SAFE_INTEGER);
    return (a.startsOn ?? '9999-12-31').localeCompare(b.startsOn ?? '9999-12-31');
  });
  const invalidRange = Boolean(from && to && to < from);
  const activeFilters = [price, from, to, help, place].filter(Boolean).length;
  const resetFilters = () => { setPrice(''); setFrom(''); setTo(''); setHelp(''); setPlace(''); setDraftPlace(''); };
  const project = id ? projects?.[0] : null;
  const retry = () => { setError(''); setProjects(null); setAttempt(value => value + 1); };
  const shareProject = async () => {
    if (!project) return;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: project.title, text: project.objective, url });
        setShareMessage('Projet partagé.');
      } else {
        await navigator.clipboard.writeText(url);
        setShareMessage('Lien du projet copié.');
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setShareMessage('Copiez l’adresse de cette page pour partager le projet.');
    }
  };

  useEffect(() => {
    if (!project) return;
    document.title = `${project.title} — Belconnect`;
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.project-detail-heading h1')?.focus({ preventScroll: true }));
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previous = description?.content;
    if (description) description.content = project.objective.slice(0, 155);
    return () => { if (description && previous !== undefined) description.content = previous; };
  }, [project]);

  if (id) return <div className="project-detail-page container">
    <nav className="breadcrumbs" aria-label="Fil d’Ariane"><a href="/">Accueil</a><Icon name="chevron" /><a href="/projets">Projets</a></nav>
    {error ? <div role="alert"><p>{error}</p><button className="button outline" onClick={retry}>Réessayer</button></div>
      : projects === null ? <p role="status">Chargement du projet…</p>
      : project && <>
        <div className="project-detail-heading"><span className="project-tag">{project.visibility === 'GROUPE' ? 'Réservé au groupe' : 'Projet public'}</span><h1 tabIndex={-1}>{project.title}</h1><p>Proposé par <strong>{project.spaceName}</strong>{project.groupName && ` · ${project.groupName}`}</p><button className="project-share-button" type="button" onClick={shareProject}><Icon name="arrow" /> Partager ce projet</button><p className="project-share-feedback" role="status">{shareMessage}</p></div>
        <div className="project-detail-layout">
          <div className="project-detail-hero">{project.imageUrl ? <img src={project.imageUrl} alt={`Illustration du projet ${project.title}`} onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/visuel-indisponible.svg'; event.currentTarget.alt = 'Visuel indisponible'; }} /> : <div className="project-photo-empty"><Icon name="users" /></div>}<span>Une expérience à vivre dans la durée</span></div>
          <aside className="project-detail-aside" aria-label="Participer au projet">
            <p className="eyebrow teal">VIVEZ CE PROJET</p>
            <h2>{project.title.startsWith('[Démo]') && offerPreview?.priceCents ? 'Essayez la simulation' : offerPreview?.active ? 'Inscrivez-vous' : 'Découvrez le projet'}</h2>
            <p className="project-aside-intro">{project.title.startsWith('[Démo]') && offerPreview?.priceCents ? 'Découvrez le parcours payant sans paiement ni réservation.' : offerPreview?.active ? 'Une inscription pour participer au projet dans sa durée.' : 'Découvrez l’objectif du projet et les façons d’y prendre part.'}</p>
            <div className="project-aside-fact"><Icon name="calendar" /><div><strong>Période du projet</strong><span>{project.startsOn ? date(project.startsOn) : 'Début à préciser'}{project.endsOn ? ` — ${date(project.endsOn)}` : ''}</span></div></div>
            <div className="project-aside-fact"><Icon name="users" /><div><strong>Organisé par</strong><span>{project.spaceName}</span></div></div>
            {offerPreview?.active && <p className="project-aside-price">{offerPreview.priceCents === 0 ? 'Inscription gratuite' : `Inscription · ${euro(offerPreview.priceCents)}`}</p>}
            {offerPreview?.active && (project.title.startsWith('[Démo]') && offerPreview.priceCents > 0 || offerPreview.paymentReady && offerPreview.placesLeft > 0)
              ? <a className="button coral project-aside-primary" href="#paid-project-title">{project.title.startsWith('[Démo]') && offerPreview.priceCents > 0 ? 'Essayer la simulation' : offerPreview.priceCents === 0 ? 'M’inscrire gratuitement' : `M’inscrire · ${euro(offerPreview.priceCents)}`} <Icon name="arrow" /></a>
              : <a className="button coral project-aside-primary" href="#paid-project-title">Voir les inscriptions <Icon name="arrow" /></a>}
            {project.participationPriceCents != null && (!offerPreview?.paymentReady || offerPreview.placesLeft < 1) && !(project.title.startsWith('[Démo]') && offerPreview?.priceCents) && <p className="project-aside-note">{offerPreview?.placesLeft === 0 ? 'Toutes les places sont réservées.' : 'Les inscriptions ne sont pas encore ouvertes. Leurs modalités figurent plus bas.'}</p>}
            <a className="project-aside-link" href="#help-title">Proposer une aide <Icon name="arrow" /></a>
            <a className="project-aside-link" href="#project-donation-title">Découvrir le soutien financier <Icon name="arrow" /></a>
            <p className="project-aside-note">{project.title.startsWith('[Démo]') && offerPreview?.priceCents ? 'La simulation ne réserve aucune place. Proposer une aide ou faire un don ne réserve pas non plus de place.' : 'S’inscrire réserve une place. Proposer une aide ou faire un don ne réserve pas de place.'}</p>
          </aside>
          <div className="project-detail-main">
            <section className="project-detail-panel project-detail-copy"><h2>Le projet dans la durée</h2><div className="project-objective-box"><h3><Icon name="leaf" /> L’objectif collectif</h3><p>{project.objective}</p></div><h3>Comment le projet se déroule</h3><p>{project.description}</p><p className="project-period-summary"><Icon name="calendar" /> {project.startsOn ? `Du ${date(project.startsOn)}` : 'Début à préciser'}{project.endsOn ? ` au ${date(project.endsOn)}` : ''}</p><h3>Les aides recherchées</h3><ul className="project-help-list">{project.helpTypes.map(type => <li key={type}><Icon name="users" />{helpTypes[type] ?? type}</li>)}</ul></section>
            <PaidProjectParticipation projectId={project.id} signedIn={signedIn} userId={userId} demonstration={project.title.startsWith('[Démo]')} demoProject={{ projectTitle: project.title, spaceName: project.spaceName, imageUrl: project.imageUrl, startsOn: project.startsOn, endsOn: project.endsOn }} />
            <ProposeHelp key={project.id} projectId={project.id} signedIn={signedIn} availableTypes={project.helpTypes} />
            <ProjectDonation projectId={project.id} signedIn={signedIn} />
          </div>
        </div>
        <a className="text-link project-back-link" href="/projets">← Voir tous les projets</a>
      </>}
  </div>;

  return <section className={`published-projects ${compact ? 'projects-compact' : ''}`}>
    <div className={compact ? '' : 'project-catalogue-intro'}><div className={compact ? '' : 'container'}>
      {!compact && <nav className="breadcrumbs" aria-label="Fil d’Ariane"><a href="/">Accueil</a><Icon name="chevron" /><span>Projets</span></nav>}
      <p className="eyebrow teal">DES IDÉES QUI NOUS RAPPROCHENT</p>
      {compact ? <h2>Des projets qui rapprochent</h2> : <h1 tabIndex={-1}>Découvrez les projets</h1>}
      <p>Un projet se vit sur une période plus longue, comme un voyage ou une initiative collective. Quand les inscriptions sont ouvertes, réservez votre place ; vous pouvez aussi proposer une aide ou soutenir le projet.</p>
      {!compact && <form className="search-bar catalogue-search project-search-bar" role="search" aria-label="Rechercher un projet" onSubmit={event => { event.preventDefault(); setQuery(draftQuery.trim()); setPlace(draftPlace.trim()); }}>
        <label className="search-field keyword"><Icon name="search" /><span><span className="field-label">QUEL PROJET VOUS INTÉRESSE ?</span><input type="search" value={draftQuery} onChange={event => setDraftQuery(event.target.value)} placeholder="Voyage, jardin, solidarité…" aria-label="Mot-clé du projet" /></span></label>
        <label className="search-field"><Icon name="pin" /><span><span className="field-label">OÙ ?</span><input type="search" value={draftPlace} onChange={event => setDraftPlace(event.target.value)} placeholder="Ville ou lieu de rendez-vous" aria-label="Lieu du projet" /></span></label>
        <button className="button coral" type="submit"><Icon name="search" /> Explorer</button>
      </form>}
    </div></div>
    {compact ? <div>{error ? <p role="alert">{error}</p> : projects === null ? <p role="status">Chargement des projets…</p> : <><div className="published-grid">{filtered.slice(0, 3).map(item => <ProjectCard key={item.id} project={item} compact />)}</div><a className="button outline" href="/projets">Tous les projets</a></>}</div>
      : <div className="container catalogue-layout project-catalogue-layout">
        <button className="mobile-filter-toggle button outline" aria-expanded={filtersOpen} aria-controls="project-filters" onClick={() => setFiltersOpen(value => !value)}><Icon name={filtersOpen ? 'close' : 'menu'} />{filtersOpen ? 'Masquer les filtres' : 'Afficher les filtres'}{activeFilters > 0 && <span>{activeFilters}</span>}</button>
        <aside id="project-filters" className={`catalogue-filters ${filtersOpen ? 'expanded' : ''}`} aria-label="Filtres des projets">
          <div className="filter-heading"><h2>Filtres</h2><button type="button" onClick={resetFilters}>Réinitialiser</button></div>
          <fieldset><legend>Tarif d’inscription</legend><div className="price-options">{[['', 'Tous'], ['free', 'Gratuit'], ['paid', 'Payant']].map(([value, label]) => <label key={value} className={price === value ? 'checked' : ''}><input type="radio" name="project-price" value={value} checked={price === value} onChange={() => setPrice(value)} />{label}</label>)}</div><p className="project-filter-hint">Les projets sans inscription ouverte restent visibles dans « Tous ».</p></fieldset>
          <fieldset><legend>Période du projet</legend><div className="date-fields"><label>À partir du<input type="date" value={from} onChange={event => setFrom(event.target.value)} aria-label="Projet actif à partir du" aria-invalid={invalidRange} /></label><label>Jusqu’au<input type="date" value={to} onChange={event => setTo(event.target.value)} aria-label="Projet actif jusqu’au" aria-invalid={invalidRange} /></label></div>{invalidRange && <p className="date-error" role="alert">La date de fin doit suivre la date de début.</p>}</fieldset>
          {helpOptions.length > 0 && <fieldset><legend>Aides recherchées</legend><label className="check-option"><input type="radio" name="project-help" checked={!help} onChange={() => setHelp('')} />Toutes</label>{helpOptions.map(type => <label className="check-option" key={type}><input type="radio" name="project-help" checked={help === type} onChange={() => setHelp(type)} /><span>{helpTypes[type] ?? type}</span><small>{projects?.filter(item => item.helpTypes.includes(type)).length}</small></label>)}</fieldset>}
          <button className="button navy apply-mobile" onClick={() => { setFiltersOpen(false); document.getElementById('project-results')?.scrollIntoView({ behavior: 'smooth' }); }}>Voir les {filtered.length} résultats</button>
        </aside>
        <div className="catalogue-results" id="project-results" aria-label="Résultats des projets">
          <div className="results-toolbar"><h2 role="status">{filtered.length} {filtered.length > 1 ? 'projets trouvés' : 'projet trouvé'}</h2><label>Trier par<select value={sort} onChange={event => setSort(event.target.value)} aria-label="Trier les projets"><option value="start">Début le plus proche</option><option value="newest">Publication récente</option><option value="price">Prix croissant</option></select></label></div>
          <p className="project-results-note">Un projet se déroule dans la durée. L’inscription réserve une place quand elle est ouverte ; le don et l’aide sont facultatifs.</p>
          {error ? <div role="alert"><p>{error}</p><button className="button outline" onClick={retry}>Réessayer</button></div> : projects === null ? <p role="status">Chargement des projets…</p> : filtered.length === 0 ? <div className="published-empty"><h3>Aucun projet trouvé</h3><p>Essayez d’autres critères ou réinitialisez les filtres.</p><button className="button outline" onClick={() => { setQuery(''); setDraftQuery(''); resetFilters(); }}>Voir tous les projets</button></div> : <div className="published-grid">{filtered.map(item => <ProjectCard key={item.id} project={item} compact={false} />)}</div>}
        </div>
      </div>}
  </section>;
}
