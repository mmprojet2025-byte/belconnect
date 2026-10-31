import { GroupMembers } from './GroupMembers';
import { SpaceAdministrators } from './SpaceAdministrators';
import { OwnerMembers } from './OwnerMembers';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { postJson, result } from '../lib/auth';
import { tr, useLocale } from '../lib/locale';
import { confirmLeavingEditor, useUnsavedChanges } from '../lib/unsavedChanges';

type SpaceContent = { name: string; type: string; description: string };
type OpeningDetails = { organizerName: string; city: string; targetAudience: string; plannedContent: string };
type Space = SpaceContent & { id: number; version: number };
type Opening = SpaceContent & OpeningDetails & { id: number; status: string; version: number; spaceId: number | null; reason: string; applicant: string; createdAt: string; desiredPlan: 'STARTER' | 'PRO' };
type SpaceQuota = { used: number; max: number; pro: boolean };
type GroupContent = { name: string; description: string; coverUrl: string; openMembership: boolean; visibility: string; memberTarget: number | null };
type Group = GroupContent & { id: number; spaceId: number; status: string; version: number; invitationCode: string };
type Management = { space: Space; groups: Group[]; groupQuota?: { used: number; max: number; pro: boolean } };
const spaceTypes = { ASSOCIATION: 'Association', PARTICULIER: 'Particulier', ORGANISATEUR: 'Organisateur' };
const requestStatuses: Record<string, string> = { EN_ATTENTE: 'En attente', APPROUVEE: 'Approuvée', REFUSEE: 'Refusée' };
const message = (e: unknown) => e instanceof Error ? e.message : 'Impossible de joindre le serveur. Réessayez.';
const load = (path: string, signal?: AbortSignal) => fetch(`/api/workspace${path}`, { credentials: 'same-origin', cache: 'no-store', signal }).then(result);
const invitationLink = (code: string) => `${import.meta.env.VITE_INVITATION_ORIGIN || window.location.origin}/groupes?invitation=${code}`;

function SpaceFields({ value, onChange, opening = false }: { value: SpaceContent; onChange: (value: SpaceContent) => void; opening?: boolean }) {
  const locale = useLocale();
  return <>
    <label>{tr(locale, 'Nom de l’espace', 'Space name', 'Naam van de ruimte')}<input required minLength={3} maxLength={180} value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} /></label>
    <label>{tr(locale, 'Type d’organisateur', 'Organiser type', 'Type organisator')}<select value={value.type} onChange={e => onChange({ ...value, type: e.target.value })}>{Object.entries(spaceTypes).map(([key, text]) => <option value={key} key={key}>{key === 'ASSOCIATION' ? tr(locale, 'Association', 'Association', 'Vereniging') : key === 'PARTICULIER' ? tr(locale, 'Particulier', 'Individual', 'Particulier') : tr(locale, text, 'Organiser', 'Organisator')}</option>)}</select></label>
    <label>{tr(locale, opening ? 'Présentation de votre espace' : 'Présentation', 'Description', 'Beschrijving')}<textarea rows={4} required={opening} maxLength={3000} placeholder={opening ? 'Qui êtes-vous ? À qui s’adresse cet espace ? Quels groupes, activités ou projets souhaitez-vous organiser, et dans quelle ville ?' : undefined} value={value.description} onChange={e => onChange({ ...value, description: e.target.value })} /></label>
  </>;
}

function OpeningForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const locale = useLocale();
  const [content, setContent] = useState<SpaceContent>({ name: '', type: 'ORGANISATEUR', description: '' });
  const [details, setDetails] = useState<OpeningDetails>({ organizerName: '', city: '', targetAudience: '', plannedContent: '' });
  const [privacyNoticeRead, setPrivacyNoticeRead] = useState(false);
  const [desiredPlan, setDesiredPlan] = useState<'STARTER' | 'PRO'>('STARTER');
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await postJson('/api/workspace/requests', { requestId, content, details, privacyNoticeRead, desiredPlan }); onDone(); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <form className="draft-editor" onSubmit={submit} onChange={() => setDirty(true)}>
    <h3>{tr(locale, 'Demander un espace organisateur', 'Request an organiser space', 'Een organisatieruimte aanvragen')}</h3>
    <p>{tr(locale, 'Présentez votre projet d’organisation. Le propriétaire de Belconnect examinera la demande avant toute ouverture.', 'Describe your plans. Belconnect’s owner reviews the request before it opens.', 'Beschrijf uw plannen. De eigenaar van Belconnect beoordeelt de aanvraag vóór de opening.')}</p>
    <p className="workspace-description">{tr(locale, 'Cette approbation ne vérifie pas votre identité professionnelle et n’autorise pas encore les encaissements. Avant tout paiement réel, l’identité de l’organisateur et son compte Stripe devront être vérifiés séparément.', 'Approval does not verify your business identity or authorise payments. Before any live payment, the organiser’s identity and Stripe account must be checked separately.', 'Goedkeuring verifieert uw professionele identiteit niet en staat betalingen nog niet toe. Vóór echte betalingen moeten de identiteit van de organisator en diens Stripe-account afzonderlijk worden gecontroleerd.')}</p>
    <fieldset disabled={busy}>
      <label>Nom de l’espace demandé<input required minLength={3} maxLength={180} value={content.name} onChange={e => setContent({ ...content, name: e.target.value })} /></label>
      <label>Type d’organisateur<select value={content.type} onChange={e => setContent({ ...content, type: e.target.value })}>{Object.entries(spaceTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Nom de la personne ou structure responsable<input required maxLength={180} value={details.organizerName} onChange={e => setDetails({ ...details, organizerName: e.target.value })} /></label>
      <label>Ville ou commune principale<input required maxLength={120} value={details.city} onChange={e => setDetails({ ...details, city: e.target.value })} /></label>
      <label>Public concerné<input required maxLength={500} placeholder="Par exemple : jeunes du quartier, familles, habitants de la commune" value={details.targetAudience} onChange={e => setDetails({ ...details, targetAudience: e.target.value })} /></label>
      <label>Activités ou projets envisagés<textarea required rows={3} maxLength={1500} placeholder="Que souhaitez-vous organiser concrètement ?" value={details.plannedContent} onChange={e => setDetails({ ...details, plannedContent: e.target.value })} /></label>
      <label>Présentation de l’espace<textarea required rows={3} maxLength={3000} placeholder="Pourquoi souhaitez-vous ouvrir cet espace sur Belconnect ?" value={content.description} onChange={e => setContent({ ...content, description: e.target.value })} /></label>
      <label>Formule souhaitée<select value={desiredPlan} onChange={e => setDesiredPlan(e.target.value as 'STARTER' | 'PRO')}><option value="STARTER">Starter — gratuit</option><option value="PRO">Pro — abonnement payant</option></select></label>
      <p className="workspace-description">Ce choix indique votre préférence. L’ouverture d’un espace démarre en Starter ; Pro nécessite une activation distincte après approbation. Aucun paiement n’est demandé ici.</p>
      <label className="space-privacy-ack"><input type="checkbox" required checked={privacyNoticeRead} onChange={e => setPrivacyNoticeRead(e.target.checked)} /> <span>J’ai pris connaissance des <a href="/informations-legales#confidentialite" target="_blank" rel="noopener noreferrer">informations de confidentialité</a> concernant cette demande. Ce document est encore un brouillon de la version locale.</span></label>
      <div className="management-actions"><button className="button coral">{busy ? 'Envoi…' : 'Envoyer la demande'}</button><button type="button" className="button outline" onClick={() => { if (window.confirm('Fermer cette demande et abandonner les saisies non envoyées ?')) onCancel(); }}>Annuler</button></div>
    </fieldset>
    {error && <p className="draft-error" role="alert">{error} Vos saisies sont conservées.</p>}
  </form>;
}

function RequestDecision({ request, onDone }: { request: Opening; onDone: () => void }) {
  const [decision, setDecision] = useState<'APPROUVEE' | 'REFUSEE' | null>(null);
  const [reason, setReason] = useState('');
  const [checks, setChecks] = useState([false, false, false]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reviewItems = [
    'Le nom, le type et la présentation de l’espace sont cohérents.',
    'La demande explique les activités ou projets envisagés et leur public.',
    'Aucun indice manifeste d’usurpation ou de contenu trompeur n’apparaît dans la demande.',
  ];
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (decision === 'APPROUVEE' && !checks.every(Boolean)) { setError('Terminez les trois contrôles avant d’approuver.'); return; }
    setBusy(true); setError('');
    const recordedReason = decision === 'APPROUVEE'
      ? 'Contrôle déclaratif effectué : présentation cohérente, objet et public décrits, aucun indice manifeste d’usurpation ou de contenu trompeur. Identité et tenue des activités non vérifiées.'
      : reason.trim();
    try { await postJson(`/api/workspace/opening-requests/${request.id}/decision`, { version: request.version, status: decision, reason: recordedReason }); onDone(); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  if (!decision) return <div className="management-actions"><button className="button coral" onClick={() => setDecision('APPROUVEE')}>Approuver l’ouverture</button><button className="button outline" onClick={() => setDecision('REFUSEE')}>Refuser</button></div>;
  return <form className="draft-editor" onSubmit={submit}><p>{decision === 'APPROUVEE' ? `L’espace sera créé et ${request.applicant} en deviendra administrateur. Cette décision n’autorise pas les paiements réels : ils nécessitent une vérification distincte.` : 'Le demandeur pourra consulter votre motif de refus.'}</p><fieldset disabled={busy}>
    {decision === 'APPROUVEE' && <div className="workspace-card"><h4>Contrôle avant ouverture</h4><p className="workspace-description">Examinez uniquement les informations fournies. Ce contrôle ne prouve ni l’identité du demandeur ni la tenue future de ses activités.</p>{reviewItems.map((item, index) => <label key={item} className="workspace-description"><input type="checkbox" checked={checks[index]} onChange={event => setChecks(current => current.map((value, position) => position === index ? event.target.checked : value))} /> {item}</label>)}</div>}
    {decision === 'REFUSEE' && <label>Motif du refus<textarea required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>}
    <div className="management-actions"><button className="button coral" disabled={decision === 'APPROUVEE' && !checks.every(Boolean)}>{busy ? 'Traitement…' : decision === 'APPROUVEE' ? 'Confirmer l’ouverture' : 'Confirmer le refus'}</button><button type="button" className="button outline" onClick={() => { setDecision(null); setReason(''); setChecks([false, false, false]); setError(''); }}>Annuler</button></div>
  </fieldset>{error && <p role="alert" className="draft-error">{error}</p>}</form>;
}

function OpeningReviewCard({ request, onDone }: { request: Opening; onDone: () => void }) {
  return <article className="workspace-card opening-review-card" aria-label={`Demande ${request.name}`}>
    <header className="opening-review-header"><div><span className="opening-review-kicker">Demande d’ouverture</span><h3>{request.name}</h3></div><span className="account-status">En attente</span></header>
    <div className="opening-review-sections">
      <section aria-label="Organisateur" className="opening-review-section"><h4>Organisateur</h4><dl>
        <div><dt>Demandeur</dt><dd>{request.applicant}</dd></div>
        <div><dt>Type</dt><dd>{spaceTypes[request.type as keyof typeof spaceTypes]}</dd></div>
        <div><dt>Responsable déclaré</dt><dd>{request.organizerName || request.applicant}</dd></div>
        {request.city && <div><dt>Ville</dt><dd>{request.city}</dd></div>}
        <div><dt>Formule souhaitée</dt><dd>{request.desiredPlan === 'PRO' ? 'Pro' : 'Starter gratuit'}</dd></div>
      </dl></section>
      <section aria-label="Projet proposé" className="opening-review-section"><h4>Projet proposé</h4><dl>
        {request.targetAudience && <div><dt>Public</dt><dd>{request.targetAudience}</dd></div>}
        {request.plannedContent && <div><dt>Activités ou projets</dt><dd>{request.plannedContent}</dd></div>}
        <div><dt>Présentation</dt><dd>{request.description || 'Aucune présentation renseignée.'}</dd></div>
      </dl></section>
    </div>
    <div className="opening-review-decision"><h4>Décision</h4><RequestDecision request={request} onDone={onDone} /></div>
  </article>;
}

function OpeningCorrectionForm({ request, onDone, onCancel }: { request: Opening; onDone: () => void; onCancel: () => void }) {
  const [content, setContent] = useState<SpaceContent>({ name: request.name, type: request.type, description: request.description });
  const [details, setDetails] = useState<OpeningDetails>({ organizerName: request.organizerName || '', city: request.city || '', targetAudience: request.targetAudience || '', plannedContent: request.plannedContent || '' });
  const [desiredPlan, setDesiredPlan] = useState(request.desiredPlan);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await postJson(`/api/workspace/opening-requests/${request.id}/edit`, { version: request.version, content, details, desiredPlan, reason: reason.trim() }); onDone(); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <form className="draft-editor opening-correction-form" onSubmit={submit}>
    <h4>Corriger la demande « {request.name} »</h4>
    {request.status === 'APPROUVEE' && <p className="workspace-description">Le nom, le type et la présentation seront aussi corrigés sur l’espace déjà ouvert. Cette correction ne change pas la formule active ni la décision.</p>}
    <fieldset disabled={busy}>
      <label>Nom de l’espace<input required minLength={3} maxLength={180} value={content.name} onChange={e => setContent({ ...content, name: e.target.value })} /></label>
      <label>Type d’organisateur<select value={content.type} onChange={e => setContent({ ...content, type: e.target.value })}>{Object.entries(spaceTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Responsable déclaré<input maxLength={180} value={details.organizerName} onChange={e => setDetails({ ...details, organizerName: e.target.value })} /></label>
      <label>Ville<input maxLength={120} value={details.city} onChange={e => setDetails({ ...details, city: e.target.value })} /></label>
      <label>Public concerné<input maxLength={500} value={details.targetAudience} onChange={e => setDetails({ ...details, targetAudience: e.target.value })} /></label>
      <label>Activités ou projets envisagés<textarea maxLength={1500} value={details.plannedContent} onChange={e => setDetails({ ...details, plannedContent: e.target.value })} /></label>
      <label>Présentation<textarea required maxLength={3000} value={content.description} onChange={e => setContent({ ...content, description: e.target.value })} /></label>
      <label>Formule souhaitée<select value={desiredPlan} onChange={e => setDesiredPlan(e.target.value as 'STARTER' | 'PRO')}><option value="STARTER">Starter gratuit</option><option value="PRO">Pro</option></select></label>
      <label>Motif de la correction<textarea required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} placeholder="Pourquoi corriger ce dossier ?" /></label>
      <div className="management-actions"><button className="button coral">{busy ? 'Enregistrement…' : 'Enregistrer la correction'}</button><button type="button" className="button outline" onClick={onCancel}>Annuler</button></div>
    </fieldset>
    {error && <p role="alert" className="draft-error">{error}</p>}
  </form>;
}

function ReopenRequestButton({ request, onDone }: { request: Opening; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!open) return <button className="text-link" onClick={() => setOpen(true)}>Réexaminer</button>;
  return <form className="opening-reopen-form" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError('');
    try { await postJson(`/api/workspace/opening-requests/${request.id}/reopen`, { version: request.version, reason: reason.trim() }); onDone(); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }}><fieldset disabled={busy}><label>Motif du réexamen<input required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label><div className="management-actions"><button className="button coral">Remettre en examen</button><button type="button" className="button outline" onClick={() => setOpen(false)}>Annuler</button></div></fieldset>{error && <p role="alert" className="draft-error">{error}</p>}</form>;
}

export function SpaceRequests({ owner, onChanged, mode = 'all' }: { owner: boolean; onChanged: () => void; mode?: 'all' | 'combined' | 'inbox' }) {
  const [mine, setMine] = useState<Opening[]>([]);
  const [queue, setQueue] = useState<Opening[]>([]);
  const [quota, setQuota] = useState<SpaceQuota | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(mode === 'combined');
  const [requestTab, setRequestTab] = useState<'form' | 'tracking'>('form');
  const [historyLimit, setHistoryLimit] = useState(10);
  const [historyQuery, setHistoryQuery] = useState('');
  const [editingRequestId, setEditingRequestId] = useState<number | null>(null);
  const [ownerTab, setOwnerTab] = useState<'pending' | 'reviewed'>('pending');
  const [requestFilter, setRequestFilter] = useState('ALL');
  const [requestLimit, setRequestLimit] = useState(5);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
    Promise.all([owner ? Promise.resolve([]) : load('/requests', signal), owner ? load('/opening-requests', signal) : Promise.resolve([]), owner ? Promise.resolve(null) : load('/requests/quota', signal)])
      .then(([own, all, currentQuota]) => { setMine(own); setQueue(all); setQuota(currentQuota); setLoaded(true); setError(''); })
      .catch(e => { if (!controller.signal.aborted) setError(message(e)); });
    return () => controller.abort();
  }, [owner, attempt]);
  const refresh = () => { setAttempt(n => n + 1); onChanged(); };
  const filteredMine = mine
    .filter(request => requestFilter === 'ALL' || request.status === requestFilter)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const reviewedRequests = queue.filter(request => request.status !== 'EN_ATTENTE')
    .filter(request => `${request.name} ${request.applicant} ${request.organizerName} ${request.city}`.toLocaleLowerCase('fr').includes(historyQuery.trim().toLocaleLowerCase('fr')))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return <section id={mode === 'combined' ? 'demander-espace' : undefined} aria-labelledby="space-requests-title">
    <div className={owner ? 'opening-review-intro' : undefined}>
      <div className="account-section-heading"><h2 id="space-requests-title">{owner ? 'Demandes d’ouverture d’espace' : 'Demander un espace'}</h2><button className="text-link" onClick={refresh}>Actualiser</button></div>
      <p className="workspace-description">{owner ? 'Examinez le dossier avant de décider. L’approbation ouvre l’espace et nomme son premier administrateur.' : 'Remplissez la fiche, puis consultez sa réponse dans « Suivi demande ».'}</p>
    </div>
    {!owner && <nav className="requests-side-nav" aria-label="Fiche et suivi de demande"><button aria-current={requestTab === 'form' ? 'page' : undefined} onClick={() => setRequestTab('form')}>Mes demandes</button><button aria-current={requestTab === 'tracking' ? 'page' : undefined} onClick={() => { if (confirmLeavingEditor()) setRequestTab('tracking'); }}>Suivi demande</button></nav>}
    {!owner && requestTab === 'form' && quota && <p className="workspace-description">{quota.pro ? 'Pro : jusqu’à 2 espaces organisateurs.' : 'Starter : 1 espace organisateur. Un abonnement Pro actif sur votre espace permet d’en ouvrir jusqu’à 2.'} {quota.used}/{quota.max} place{quota.max > 1 ? 's' : ''} utilisée{quota.used > 1 ? 's' : ''}, demandes en attente comprises.</p>}
    {notice && <p className="account-notice" role="status">{notice}</p>}
    {error && <p className="draft-error" role="alert">{error}</p>}
    {!loaded && !error && <p role="status">Chargement des demandes…</p>}
    {!owner && requestTab === 'form' && (quota && quota.used >= quota.max ? <p className="account-notice">Limite d’espaces atteinte. Consultez le suivi de vos demandes.</p> : editing ? <OpeningForm onCancel={() => setEditing(false)} onDone={() => { setEditing(false); setRequestTab('tracking'); setNotice('Demande envoyée. Retrouvez son statut ci-dessous.'); refresh(); }} /> : <button className="button outline workspace-create" disabled={!loaded} onClick={() => setEditing(true)}>Faire une nouvelle demande</button>)}
    {!owner && requestTab === 'tracking' && <h3>Suivi de mes demandes</h3>}
    {!owner && requestTab === 'tracking' && (mine.length > 0 ? <>
      <div className="account-filters" aria-label="Filtrer mes demandes d’espace">{Object.entries({ ALL: 'Toutes', EN_ATTENTE: 'En attente', APPROUVEE: 'Approuvées', REFUSEE: 'Refusées' }).map(([status, label]) => <button key={status} aria-pressed={requestFilter === status} onClick={() => { setRequestFilter(status); setRequestLimit(5); }}>{label} ({status === 'ALL' ? mine.length : mine.filter(request => request.status === status).length})</button>)}</div>
      {filteredMine.length > 0 ? <><div className="workspace-grid">{filteredMine.slice(0, requestLimit).map(request => <article className="workspace-card" key={request.id}><span className="account-status">{requestStatuses[request.status]}</span><h3>{request.name}</h3><p>{spaceTypes[request.type as keyof typeof spaceTypes]} · Formule souhaitée : {request.desiredPlan === 'PRO' ? 'Pro' : 'Starter gratuit'}</p>{request.status === 'APPROUVEE' && <p>Votre espace est ouvert. Retrouvez-le dans « Mes espaces ».</p>}{request.status === 'EN_ATTENTE' && <p>La demande est en cours d’examen. Elle ne donne pas encore de droits d’administration.</p>}{request.reason && <p className="management-copy">Motif : {request.reason}</p>}</article>)}</div>{filteredMine.length > requestLimit && <button className="button outline workspace-create" onClick={() => setRequestLimit(value => value + 5)}>Voir 5 demandes de plus</button>}</> : <p className="workspace-description">Aucune demande avec ce statut.</p>}
    </> : loaded && <p className="workspace-description">Aucune demande d’espace pour le moment.</p>)}
    {owner && <div className="management-review">
      <nav className="opening-review-tabs" aria-label="Demandes d’ouverture">
        <button aria-pressed={ownerTab === 'pending'} onClick={() => { setOwnerTab('pending'); setEditingRequestId(null); }}>À examiner ({queue.filter(r => r.status === 'EN_ATTENTE').length})</button>
        <button aria-pressed={ownerTab === 'reviewed'} onClick={() => { setOwnerTab('reviewed'); setEditingRequestId(null); }}>Examinées ({queue.filter(r => r.status !== 'EN_ATTENTE').length})</button>
      </nav>
      {ownerTab === 'pending' && <>
      {loaded && !queue.some(r => r.status === 'EN_ATTENTE') && <p>Aucune demande en attente.</p>}
      {queue.filter(r => r.status === 'EN_ATTENTE').map(request => <div key={request.id}>
        <OpeningReviewCard request={request} onDone={() => { setNotice('Décision enregistrée. Le demandeur peut la consulter dans son espace.'); refresh(); }} />
        <button className="text-link opening-review-edit" onClick={() => setEditingRequestId(request.id)}>Corriger cette demande</button>
        {editingRequestId === request.id && <OpeningCorrectionForm request={request} onCancel={() => setEditingRequestId(null)} onDone={() => { setEditingRequestId(null); setNotice('Correction enregistrée.'); refresh(); }} />}
      </div>)}</>}
      {ownerTab === 'reviewed' && <section className="opening-review-history" aria-label="Demandes examinées">
        <label className="opening-review-search">Rechercher une demande<input type="search" value={historyQuery} onChange={event => { setHistoryQuery(event.target.value); setHistoryLimit(10); }} placeholder="Nom de l’espace, demandeur ou ville" /></label>
        {reviewedRequests.length ? <div className="opening-review-history-list">{reviewedRequests.slice(0, historyLimit).map(request => <article key={request.id} className="opening-review-history-item">
          <div className="opening-review-history-top"><strong>{request.name}</strong><span className="account-status">{requestStatuses[request.status]}</span></div>
          <span>{request.applicant} · {new Date(request.createdAt).toLocaleDateString('fr-BE')}</span>
          {request.city && <span>{request.city}</span>}
          {request.reason && <p>Motif : {request.reason}</p>}
          <div className="opening-review-history-actions">
            <button className="text-link" onClick={() => setEditingRequestId(request.id)}>Corriger la demande</button>
            {request.status === 'REFUSEE' && <ReopenRequestButton request={request} onDone={() => { setNotice('Demande remise en examen.'); refresh(); }} />}
            {request.status === 'APPROUVEE' && <a className="text-link" href="/mon-espace#espaces">Gérer l’espace ouvert</a>}
          </div>
          {editingRequestId === request.id && <OpeningCorrectionForm request={request} onCancel={() => setEditingRequestId(null)} onDone={() => { setEditingRequestId(null); setNotice('Correction enregistrée.'); refresh(); }} />}
        </article>)}</div> : <p className="workspace-description">Aucune demande ne correspond à cette recherche.</p>}
        {reviewedRequests.length > historyLimit && <button className="button outline" onClick={() => setHistoryLimit(value => value + 10)}>Voir 10 demandes de plus</button>}
      </section>}
    </div>}
  </section>;
}

function SpaceEditor({ space, onSaved, onCancel }: { space: Space; onSaved: (space: Space) => void; onCancel: () => void }) {
  const [content, setContent] = useState<SpaceContent>({ name: space.name, type: space.type, description: space.description });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { onSaved(await postJson(`/api/workspace/spaces/${space.id}`, { version: space.version, content })); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <form className="draft-editor" onSubmit={submit} onChange={() => setDirty(true)}><h3>Modifier l’espace</h3><fieldset disabled={busy}><SpaceFields value={content} onChange={setContent} /><div className="management-actions"><button className="button coral">{busy ? 'Enregistrement…' : 'Enregistrer l’espace'}</button><button className="button outline" type="button" onClick={() => { if (window.confirm('Abandonner les modifications non enregistrées ?')) onCancel(); }}>Annuler</button></div></fieldset>{error && <p className="draft-error" role="alert">{error} Vos saisies sont conservées. Fermez puis rouvrez le formulaire pour recharger la version enregistrée.</p>}</form>;
}

function GroupEditor({ group, spaceId, onSaved, onCancel }: { group: Group | null; spaceId: number; onSaved: (group: Group) => void; onCancel: () => void }) {
  const [content, setContent] = useState<GroupContent>(group ? { name: group.name, description: group.description, coverUrl: group.coverUrl, openMembership: false, visibility: group.visibility, memberTarget: group.memberTarget ?? null } : { name: '', description: '', coverUrl: '', openMembership: false, visibility: 'PRIVEE', memberTarget: null });
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { onSaved(await postJson(`/api/workspace/spaces/${spaceId}/groups${group ? `/${group.id}` : ''}`, group ? { version: group.version, content } : { requestId, content })); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <form className="draft-editor" onSubmit={submit} onChange={() => setDirty(true)}><h3>{group ? 'Modifier le groupe' : 'Créer un groupe'}</h3><fieldset disabled={busy}>
    <label>Nom du groupe<input required minLength={3} maxLength={150} value={content.name} onChange={e => setContent({ ...content, name: e.target.value })} /></label>
    <label>Description<textarea rows={4} maxLength={3000} value={content.description} onChange={e => setContent({ ...content, description: e.target.value })} /></label>
    <label>Nombre de membres souhaité (facultatif)<input type="number" min="1" max="100000" step="1" value={content.memberTarget ?? ''} onChange={e => setContent({ ...content, memberTarget: e.target.value === '' ? null : Number(e.target.value) })} /></label>
    <p className="management-hint">Ce nombre est indicatif : les demandes d’adhésion restent possibles si le groupe le dépasse.</p>
    <details className="group-extra-options" open={Boolean(content.coverUrl)}><summary>Ajouter une image (facultatif)</summary><label>Adresse de l’image de couverture<input type="url" pattern="https://.*" maxLength={2048} placeholder="https://…" value={content.coverUrl} onChange={e => setContent({ ...content, coverUrl: e.target.value })} /><span className="management-hint">Lien HTTPS vers une image.</span></label></details>
    <div className="draft-columns"><label>Visibilité<select value={content.visibility} onChange={e => setContent({ ...content, visibility: e.target.value })}><option value="PRIVEE">Privée</option><option value="PUBLIQUE">Publique</option></select></label></div>
    <p className="management-hint">Public : visible dans le catalogue. Privé : accessible sur invitation. Dans les deux cas, l’adhésion doit être approuvée.</p>
    <div className="management-actions"><button className="button coral">{busy ? 'Enregistrement…' : group ? 'Enregistrer le groupe' : 'Créer le groupe'}</button><button type="button" className="button outline" onClick={() => { if (window.confirm('Abandonner les saisies non enregistrées ?')) onCancel(); }}>Annuler</button></div>
  </fieldset>{error && <p className="draft-error" role="alert">{error} Vos saisies sont conservées.</p>}</form>;
}

function GroupLifecycle({ group, spaceId, disabled, onSaved, onReload }: { group: Group; spaceId: number; disabled: boolean; onSaved: (group: Group) => void; onReload: () => void }) {
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const labels: Record<string, string> = { ACTIF: 'Réactiver le groupe', SUSPENDU: 'Suspendre le groupe', ARCHIVE: 'Archiver le groupe' };
  async function save() {
    setBusy(true); setError('');
    try { onSaved(await postJson(`/api/workspace/spaces/${spaceId}/groups/${group.id}/status`, { version: group.version, status: target })); setTarget(null); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  if (group.status === 'ARCHIVE') return <p className="management-hint">Groupe archivé : données et historique conservés. La réactivation n’est pas disponible.</p>;
  return <div className="group-lifecycle"><fieldset disabled={disabled || busy}>
    {target ? <div className="group-role-confirm">
      <h4>{labels[target]} : {group.name}</h4>
      <p>{target === 'ACTIF' ? 'Le groupe retrouvera sa visibilité et ses accès précédents. Les rôles et permissions sont conservés.' : target === 'SUSPENDU' ? 'Le groupe et ses projets seront masqués du catalogue. Les adhésions et actions sur les projets seront bloquées jusqu’à sa réactivation.' : 'Le groupe sera fermé et masqué du catalogue, ainsi que ses projets. Ses membres, projets, demandes et historique seront conservés. Aucune réactivation ne sera proposée.'}</p>
      <div className="management-actions"><button className="button coral" onClick={save}>{busy ? 'Enregistrement…' : 'Confirmer'}</button><button className="button outline" onClick={() => { setTarget(null); setError(''); }}>Annuler</button></div>
    </div> : <div className="management-actions"><button className="button outline" onClick={() => setTarget(group.status === 'ACTIF' ? 'SUSPENDU' : 'ACTIF')}>{labels[group.status === 'ACTIF' ? 'SUSPENDU' : 'ACTIF']}</button><button className="text-link" onClick={() => setTarget('ARCHIVE')}>Archiver le groupe</button></div>}
  </fieldset>{error && <div role="alert"><p className="draft-error">{error}</p><button className="text-link" disabled={busy} onClick={onReload}>Actualiser les groupes</button></div>}</div>;
}

export function SpaceManagement({ spaceId, section, onChanged, onSettingsTabChange }: { spaceId: number; section: 'groups' | 'settings'; onChanged: () => void; onSettingsTabChange?: (tab: 'information' | 'admins' | 'members') => void }) {
  const [data, setData] = useState<Management | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [membersGroup, setMembersGroup] = useState<number | null>(null);
  const [inviteGroup, setInviteGroup] = useState<number | null>(null);
  const [editingSpace, setEditingSpace] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | 'new' | null>(null);
  const [detailTab, setDetailTab] = useState<'information' | 'admins' | 'members'>('information');
  const [groupView, setGroupView] = useState<'current' | 'archived'>('current');
  useEffect(() => {
    const controller = new AbortController();
    load(`/spaces/${spaceId}/management`, AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]))
      .then(value => { setData(value); setError(''); }).catch(e => { if (!controller.signal.aborted) setError(message(e)); });
    return () => controller.abort();
  }, [spaceId, attempt]);
  const reload = () => { setData(null); setError(''); setAttempt(n => n + 1); };
  return <section className="management-panel" aria-labelledby={section === 'settings' ? 'manage-space-title' : undefined} aria-label={section === 'groups' ? 'Groupes de l’espace' : undefined}>
    {section === 'settings' && <div className="account-section-heading"><h2 id="manage-space-title">Réglages de l’espace</h2></div>}
    {error ? <div role="alert"><p className="draft-error">{error}</p><button className="button outline" onClick={reload}>Réessayer</button></div> : !data ? <p role="status">Chargement de l’espace…</p> : <>
      {section === 'settings' && <nav className="workspace-subnav" aria-label="Réglages de l’espace"><button aria-pressed={detailTab === 'information'} disabled={editingSpace} onClick={() => { if (confirmLeavingEditor()) { setDetailTab('information'); onSettingsTabChange?.('information'); } }}>Informations</button><button aria-pressed={detailTab === 'admins'} disabled={editingSpace} onClick={() => { if (confirmLeavingEditor()) { setDetailTab('admins'); onSettingsTabChange?.('admins'); } }}>Équipe de l’espace</button><button aria-pressed={detailTab === 'members'} disabled={editingSpace} onClick={() => { if (confirmLeavingEditor()) { setDetailTab('members'); onSettingsTabChange?.('members'); } }}>Membres de l’espace</button></nav>}
      {notice && <p className="account-notice" role="status">{notice}</p>}
      {section === 'settings' && detailTab === 'information' && <section aria-label="Informations de l’espace">{editingSpace ? <SpaceEditor space={data.space} onCancel={() => { setEditingSpace(false); reload(); }} onSaved={space => { setData({ ...data, space }); setEditingSpace(false); setNotice('Les informations de l’espace sont enregistrées.'); onChanged(); }} /> : <div className="workspace-card"><h3>{data.space.name}</h3><span className="account-status">{spaceTypes[data.space.type as keyof typeof spaceTypes]}</span><p>{data.space.description || 'Aucune présentation renseignée.'}</p><button className="button outline workspace-resume" onClick={() => { setNotice(''); setEditingSpace(true); }}>Modifier les informations</button></div>}</section>}
      {section === 'settings' && detailTab === 'admins' && <SpaceAdministrators spaceId={spaceId} onChanged={() => { onChanged(); reload(); }} />}
      {section === 'settings' && detailTab === 'members' && <OwnerMembers spaceId={spaceId} />}
      {section === 'groups' && <section aria-label="Groupes de l’espace"><div className="account-section-heading"><h3 className="management-groups-title">Groupes ({data.groupQuota?.used ?? data.groups.filter(group => group.status !== 'ARCHIVE').length}/{data.groupQuota?.max ?? 2})</h3><button className="button coral" disabled={editingGroup !== null || membersGroup !== null || (data.groupQuota?.used ?? data.groups.filter(group => group.status !== 'ARCHIVE').length) >= (data.groupQuota?.max ?? 2)} onClick={() => { setNotice(''); setEditingGroup('new'); }}>Créer un groupe</button></div>
      <p className="workspace-description">{data.groupQuota?.pro ? 'Jusqu’à 4 groupes avec la formule Pro.' : 'Jusqu’à 2 groupes avec la formule Starter.'} Les groupes archivés ne comptent pas.</p>
      <div className="account-filters" aria-label="Afficher les groupes"><button aria-pressed={groupView === 'current'} onClick={() => setGroupView('current')}>En cours ({data.groups.filter(group => group.status !== 'ARCHIVE').length})</button><button aria-pressed={groupView === 'archived'} onClick={() => setGroupView('archived')}>Archives ({data.groups.filter(group => group.status === 'ARCHIVE').length})</button></div>
      {editingGroup !== null && <GroupEditor key={editingGroup === 'new' ? 'new' : editingGroup.id} group={editingGroup === 'new' ? null : editingGroup} spaceId={spaceId} onCancel={() => { setEditingGroup(null); reload(); }} onSaved={() => { setEditingGroup(null); setNotice('Le groupe est enregistré.'); reload(); onChanged(); }} />}
      {membersGroup !== null && <GroupMembers key={membersGroup} groupId={membersGroup} onChanged={() => { setAttempt(n => n + 1); onChanged(); }} onClose={() => { setMembersGroup(null); reload(); }} invitationUrl={data.groups.some(group => group.id === membersGroup && group.status === 'ACTIF' && group.visibility === 'PRIVEE') ? invitationLink(data.groups.find(group => group.id === membersGroup)!.invitationCode) : undefined} />}
      {!data.groups.some(group => groupView === 'archived' ? group.status === 'ARCHIVE' : group.status !== 'ARCHIVE') ? <div className="account-empty"><h3>{groupView === 'archived' ? 'Aucun groupe archivé' : 'Votre premier groupe'}</h3>{groupView === 'current' && <p>Créez un groupe pour rassembler votre communauté autour d’un thème ou d’un projet.</p>}</div> : <div className="workspace-grid">{data.groups.filter(group => groupView === 'archived' ? group.status === 'ARCHIVE' : group.status !== 'ARCHIVE').map(group => <article className="workspace-card" key={group.id}>
        {group.coverUrl && <img key={group.coverUrl} className="management-cover" src={group.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.display = 'none'; }} />}
        <span className="account-status">{group.status === 'ACTIF' ? 'Actif' : group.status === 'ARCHIVE' ? 'Archivé' : 'Suspendu'}</span><h3>{group.name}</h3><p className="management-copy">{group.description || 'Aucune description renseignée.'}</p><p>{group.visibility === 'PUBLIQUE' ? 'Visibilité publique' : 'Visibilité privée'} · Adhésion sur demande{group.memberTarget ? ` · Objectif indicatif : ${group.memberTarget} membres` : ''}</p>
        {group.status === 'ACTIF' && group.visibility === 'PRIVEE' && <><button className="button coral workspace-resume" aria-expanded={inviteGroup === group.id} onClick={() => setInviteGroup(value => value === group.id ? null : group.id)}>Inviter une personne</button>{inviteGroup === group.id && <label className="group-invite-link">Lien d’invitation<input readOnly value={invitationLink(group.invitationCode)} onFocus={event => event.currentTarget.select()} onClick={event => event.currentTarget.select()} /></label>}</>}
        {group.status === 'ACTIF' && <button className="button outline workspace-resume" disabled={editingSpace || editingGroup !== null || membersGroup !== null} onClick={() => setMembersGroup(group.id)}>Membres du groupe</button>}
        {group.status === 'ACTIF' && <button className="text-link workspace-resume" disabled={editingSpace || editingGroup !== null || membersGroup !== null} onClick={() => { setNotice(''); setEditingGroup(group); }}>Modifier le groupe</button>}
        <details className="group-extra-options group-card-options"><summary>Plus d’options</summary><div className="group-options-inline">
          <GroupLifecycle key={`${group.id}-${group.version}`} group={group} spaceId={spaceId} disabled={editingSpace || editingGroup !== null || membersGroup !== null} onReload={reload} onSaved={() => { setNotice('Le statut du groupe est enregistré.'); reload(); onChanged(); }} />
        </div></details>
      </article>)}</div>}</section>}
    </>}
  </section>;
}
