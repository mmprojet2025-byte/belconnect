import { ActivityRegistrations } from './ActivityRegistrations';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { HttpError, postJson, result } from '../lib/auth';
import { categories } from '../data/activities';
import { useUnsavedChanges } from '../lib/unsavedChanges';

type Space = { id: number; name: string; role: string };
type Group = { id: number; spaceId: number; name: string };
type Content = { title: string; category: string; city: string; location: string; price: number; image: string; startsAt: string; endsAt: string; closesAt: string; description: string; duration: string; capacity: number; audience: string; meetingPoint: string; preparation: string; visibility: string };
type Managed = { id: number; slug: string; spaceId: number; groupId: number | null; spaceName: string; groupName: string | null; published: boolean; cancelled: boolean; demonstration: boolean; version: number; bookings: number; pendingCancellation: number; content: Content };
const images = ['balade', 'brasserie', 'ceramique', 'chocolat', 'cinema', 'potager', 'randonnee', 'street-art', 'velo'];
const errorText = (e: unknown) => e instanceof Error ? e.message : 'Le serveur est indisponible. Réessayez.';
const localTime = (value: string) => { if (!value) return ''; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const displayDate = (value: string) => new Date(value).toLocaleString('fr-BE', { timeZone: 'Europe/Brussels', dateStyle: 'medium', timeStyle: 'short' });

function ActivityEditor({ activity, spaces, groups, onSaved, onClose }: { activity: Managed | null; spaces: Space[]; groups: Group[]; onSaved: (saved: Managed) => void; onClose: () => void }) {
  const [spaceId, setSpaceId] = useState(activity?.spaceId ?? spaces[0]?.id ?? 0);
  const [groupId, setGroupId] = useState(activity ? activity.groupId?.toString() ?? '' : spaces[0]?.role === 'ADMINISTRATEUR' ? '' : groups.find(g => g.spaceId === spaces[0]?.id)?.id.toString() ?? '');
  const [content, setContent] = useState<Content>(activity ? { ...activity.content, startsAt: localTime(activity.content.startsAt), endsAt: localTime(activity.content.endsAt), closesAt: localTime(activity.content.closesAt) } : { title: '', category: 'nature', city: '', location: '', price: 0, image: 'balade', startsAt: '', endsAt: '', closesAt: '', description: '', duration: '', capacity: 20, audience: 'Tout public', meetingPoint: '', preparation: '', visibility: 'PUBLIQUE' });
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);
  const patch = (change: Partial<Content>) => setContent(c => ({ ...c, ...change }));
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const minutes = Math.round((new Date(content.endsAt).getTime() - new Date(content.startsAt).getTime()) / 60000);
      if (minutes <= 0) throw new Error('La fin doit être après le début.');
      const duration = `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60}` : ''}`;
      const saved = { ...content, duration, startsAt: new Date(content.startsAt).toISOString(), endsAt: new Date(content.endsAt).toISOString(), closesAt: new Date(content.closesAt).toISOString() };
      const response = await postJson(`/api/managed-activities${activity ? `/${activity.id}` : ''}`, activity ? { version: activity.version, content: saved } : { requestId, spaceId, groupId: groupId ? Number(groupId) : null, content: saved }) as Managed;
      onSaved(response);
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <form className="draft-editor activity-editor" onSubmit={submit} onChange={() => setDirty(true)}>
    <p className="eyebrow teal">PRÉPARER UNE RENCONTRE</p><h3>{activity ? 'Modifier le brouillon' : 'Créer une activité'}</h3>
    <p>Le brouillon est partagé avec l’administrateur et les référents autorisés du groupe. Il ne sera visible par les participants qu’après publication.</p>
    <fieldset disabled={busy}>
      <div className="draft-columns"><label>Espace organisateur<select disabled={!!activity} value={spaceId} onChange={e => { const id = Number(e.target.value); setSpaceId(id); setGroupId(spaces.find(s => s.id === id)?.role === 'ADMINISTRATEUR' ? '' : groups.find(g => g.spaceId === id)?.id.toString() ?? ''); }}>{spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Groupe<select disabled={!!activity} value={groupId} onChange={e => setGroupId(e.target.value)}>{spaces.find(s => s.id === spaceId)?.role === 'ADMINISTRATEUR' && <option value="">Sans groupe</option>}{groups.filter(g => g.spaceId === spaceId).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label></div>
      <label>Titre de l’activité<input required minLength={5} maxLength={250} value={content.title} onChange={e => patch({ title: e.target.value })} /></label>
      <div className="draft-columns"><label>Catégorie<select value={content.category} onChange={e => patch({ category: e.target.value })}>{categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label><label>Visibilité<select value={content.visibility} onChange={e => patch({ visibility: e.target.value })}><option value="PUBLIQUE">Publique</option><option value="PRIVEE">Privée</option></select></label></div>
      <p className="management-hint">Une activité publique est ouverte aux comptes Belconnect, sans adhésion au groupe. Une activité privée est réservée aux membres actifs du groupe choisi, ou de l’espace si aucun groupe n’est choisi.</p>
      <label>Description<textarea required maxLength={10000} rows={4} value={content.description} onChange={e => patch({ description: e.target.value })} /></label>
      <div className="draft-columns"><label>Ville<input required maxLength={120} value={content.city} onChange={e => patch({ city: e.target.value })} /></label><label>Lieu et adresse<input required maxLength={250} value={content.location} onChange={e => patch({ location: e.target.value })} /></label></div>
      <label>Point de rendez-vous<input required maxLength={250} value={content.meetingPoint} onChange={e => patch({ meetingPoint: e.target.value })} /></label>
      <div className="draft-columns"><label>Date et heure de début<input type="datetime-local" required value={content.startsAt} onChange={e => patch({ startsAt: e.target.value })} /></label><label>Date et heure de fin<input type="datetime-local" required min={content.startsAt || undefined} value={content.endsAt} onChange={e => patch({ endsAt: e.target.value })} /></label></div>
      <label>Clôture des inscriptions<input type="datetime-local" required max={content.startsAt || undefined} value={content.closesAt} onChange={e => patch({ closesAt: e.target.value })} /></label>
      <p className="management-hint">Heures saisies dans votre fuseau : {Intl.DateTimeFormat().resolvedOptions().timeZone}. La clôture doit précéder le début ou lui être égale.</p>
      <label>Nombre de places<input type="number" required min={1} max={100000} step={1} value={content.capacity} onChange={e => patch({ capacity: Number(e.target.value) })} /></label>
      <label>Prix par participant (€)<input type="number" required min={0} max={99999999.99} step="0.01" value={content.price} onChange={e => patch({ price: Number(e.target.value) })} /></label>
      <p className="management-hint">0 € pour une activité gratuite ; au moins 0,50 € par place pour une activité payante. Sa publication demande Stripe test, son webhook et un compte organisateur prêt.</p>
      <label>Public cible<input required maxLength={200} value={content.audience} onChange={e => patch({ audience: e.target.value })} /></label>
      <label>À prévoir (facultatif)<textarea maxLength={3000} value={content.preparation} onChange={e => patch({ preparation: e.target.value })} /></label>
      <label>Image de la galerie<select value={content.image} onChange={e => patch({ image: e.target.value })}>{images.map(image => <option key={image} value={image}>{image}</option>)}</select></label>
      <img className="activity-editor-cover" src={`/images/${content.image}.jpg`} alt="Aperçu de la couverture sélectionnée" />
      <p className="management-hint">L’ajout de vos propres images sera disponible ultérieurement.</p>
      <div className="management-actions"><button className="button coral">{busy ? 'Enregistrement…' : 'Enregistrer le brouillon'}</button><button type="button" className="button outline" onClick={() => { if (window.confirm('Fermer et abandonner les modifications non enregistrées ?')) onClose(); }}>Annuler</button></div>
    </fieldset>
    {error && <p role="alert" className="draft-error">{error} Vos saisies sont conservées. Pour recharger une version plus récente, fermez ce formulaire puis actualisez la liste.</p>}
  </form>;
}

export function ManagedActivities({ spaces, groups, startCreating = false, onCreationFinished, settlementOnly = false, highlightId }: { spaces: Space[]; groups: Group[]; startCreating?: boolean; onCreationFinished?: (id?: number) => void; settlementOnly?: boolean; highlightId?: number | null }) {
  const [now] = useState(() => Date.now());
  const [activities, setActivities] = useState<Managed[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<Managed | 'new' | null>(startCreating ? 'new' : null);
  const [confirm, setConfirm] = useState<Managed | null>(null);
  const [demoPublish, setDemoPublish] = useState(false);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [historyPage, setHistoryPage] = useState(0);
  const [registrationsId, setRegistrationsId] = useState<number | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/managed-activities/paged?filter=${filter}&page=${historyPage}`, { cache: 'no-store', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]) }).then(result).then(value => { setActivities(value.items); setTotal(value.total); setLoaded(true); setError(''); }).catch(e => { if (!abort.signal.aborted) setError(errorText(e)); });
    return () => abort.abort();
  }, [attempt, filter, historyPage]);
  const refresh = () => { setConfirm(null); setCancelId(null); setHistoryPage(0); setLoaded(false); setAttempt(n => n + 1); };
  async function publish() {
    if (!confirm) return; setBusy(true); setError('');
    try {
      await postJson(`/api/managed-activities/${confirm.id}/publication`, { version: confirm.version, published: !confirm.published, demonstration: demoPublish });
      setNotice(confirm.published ? 'La publication est retirée. Le brouillon est conservé.' : demoPublish ? 'Activité publiée en démonstration. Le paiement est simulé et aucune réservation payante réelle n’est créée.' : 'Activité publiée. Elle est accessible aux participants autorisés.');
      refresh(); window.dispatchEvent(new Event('catalog-refresh'));
    } catch (e) { setError(e instanceof HttpError && e.status === 503 && !demoPublish ? 'La publication payante demande Stripe. Pour tester le catalogue sans paiement réel, utilisez « Publier en démonstration ».' : errorText(e)); } finally { setBusy(false); }
  }
  async function cancelActivity(a: Managed) {
    setBusy(true); setError('');
    try {
      await postJson(`/api/managed-activities/${a.id}/${a.content.price > 0 ? 'cancel-paid' : 'cancel'}`, { version: a.version });
      setNotice(a.content.price > 0
        ? `« ${a.content.title} » est annulée. Les inscriptions payées ont été remboursées intégralement.`
        : `« ${a.content.title} » est annulée. Les inscriptions concernées apparaissent comme annulées dans « Mes inscriptions ».`);
      refresh(); window.dispatchEvent(new Event('catalog-refresh'));
    } catch (e) { setError(errorText(e)); refresh(); } finally { setBusy(false); }
  }
  const isHistory = (a: Managed) => a.cancelled || new Date(a.content.endsAt).getTime() < now;
  const visible = activities.filter(a => spaces.some(space => space.id === a.spaceId));
  const editingActivity = editing && editing !== 'new' ? editing : null;
  const currentActivity = registrationsId === null ? null : activities.find(activity => activity.id === registrationsId);
  const activitySection = editing === 'new' ? 'Créer une activité' : editing ? 'Modifier le brouillon' : currentActivity ? 'Inscriptions' : { ALL: 'En cours et à venir', DRAFT: 'Brouillons', PUBLISHED: 'Publiées', HISTORY: 'Historique' }[filter] ?? 'En cours et à venir';
  return <section aria-labelledby="managed-activities-title">
    <div className="account-section-heading"><h2 id="managed-activities-title">Mes activités</h2><button className="text-link" disabled={busy || editing !== null} onClick={refresh}>Actualiser</button></div>
    <nav className="workspace-context-location" aria-label="Chemin des activités"><span>Mes activités</span><span aria-hidden="true">›</span><span>J’organise</span><span aria-hidden="true">›</span>{editingActivity || currentActivity && !editing ? <><span>{editingActivity?.content.title ?? currentActivity?.content.title}</span><span aria-hidden="true">›</span></> : null}<strong aria-current="page">{activitySection}</strong></nav>
    <p className="workspace-description">{settlementOnly ? 'L’espace est suspendu. Consultez les inscriptions et traitez les annulations ou remboursements nécessaires. Aucune nouvelle activité ne peut être créée ou publiée.' : 'Préparez une activité, publiez-la et retrouvez vos inscrits ici.'}</p>
    {!settlementOnly && editing === null && <button className="button coral workspace-create" disabled={busy} onClick={() => setEditing('new')}>Créer une activité</button>}
    {(notice || highlightId) && <p className="account-notice" role="status">{notice || 'Votre activité a été enregistrée. Retrouvez-la ci-dessous dans « Mes activités » ; elle reste un brouillon tant que vous ne la publiez pas.'}</p>}
    {error && <p className="draft-error" role="alert">{error}</p>}
    {editing && !settlementOnly && <ActivityEditor key={editing === 'new' ? 'new' : editing.id} activity={editing === 'new' ? null : editing} spaces={spaces} groups={groups} onClose={() => { setEditing(null); if (editing === 'new') onCreationFinished?.(); }} onSaved={saved => { setEditing(null); if (editing === 'new') { onCreationFinished?.(saved.id); return; } setNotice('Brouillon enregistré. Il n’est pas encore publié.'); refresh(); }} />}
    <div className="account-filters" aria-label="Filtrer les activités organisées">{[['ALL', 'En cours et à venir'], ['DRAFT', 'Brouillons'], ['PUBLISHED', 'Publiées'], ['HISTORY', 'Historique']].map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => { setFilter(key); setHistoryPage(0); setLoaded(false); }}>{label}</button>)}</div>
    {!loaded && !error && <p role="status">Chargement des activités…</p>}
    {loaded && !visible.length && <p className="account-empty">Aucune activité dans cette catégorie.</p>}
    {registrationsId !== null && <ActivityRegistrations key={registrationsId} activityId={registrationsId} onClose={() => setRegistrationsId(null)} />}
    <div className="workspace-grid">{visible.map(a => <article className={`workspace-card${a.id === highlightId ? ' workspace-card--new' : ''}`} key={a.id}>
      <img className="management-cover" src={`/images/${a.content.image}.jpg`} alt="" />
      <span className="account-status">{a.cancelled ? 'Annulée' : isHistory(a) ? 'Terminée' : a.published ? a.demonstration ? 'Publiée · Démonstration' : 'Publiée' : 'Brouillon'}</span><h3>{a.content.title}</h3><p>{a.spaceName}{a.groupName ? ` · ${a.groupName}` : ' · Sans groupe'}</p>
      <p>Du {displayDate(a.content.startsAt)} au {displayDate(a.content.endsAt)} (Bruxelles) · {a.content.city}</p><p>{a.content.capacity} places · {a.content.price === 0 ? 'Gratuit' : `${a.content.price} €`} · {a.content.visibility === 'PUBLIQUE' ? 'Publique' : 'Privée'}</p><p>Clôture : {displayDate(a.content.closesAt)}</p>
      <button className="button outline workspace-resume" disabled={registrationsId === a.id} onClick={() => setRegistrationsId(a.id)}>Voir les inscriptions</button>
      {a.cancelled ? <div className="account-notice"><p>{a.content.price > 0 && a.pendingCancellation > 0 ? 'Activité fermée. Des paiements ou remboursements restent à vérifier.' : 'Activité annulée. Les inscriptions sont conservées dans l’historique.'}</p>{a.content.price > 0 && a.pendingCancellation > 0 && <button className="text-link" disabled={busy} onClick={() => cancelActivity(a)}>Revérifier les remboursements</button>}</div> : isHistory(a) ? <p className="management-hint">Activité terminée. Les inscriptions restent consultables.</p> : settlementOnly ? <>
        {a.published && new Date(a.content.startsAt).getTime() > now ? <button className="button outline" disabled={busy || cancelId !== null} onClick={() => setCancelId(a.id)}>Annuler et traiter les inscriptions</button> : <p className="management-hint">{a.published ? 'L’activité a déjà commencé : contactez l’assistance pour le traitement de ses paiements.' : 'Brouillon conservé jusqu’à la réactivation de l’espace.'}</p>}
        {cancelId === a.id && <div className="group-role-confirm"><p>Annuler « {a.content.title} » ? Les inscriptions seront fermées et les paiements seront remboursés intégralement.</p><div className="management-actions"><button className="button coral" disabled={busy} onClick={() => cancelActivity(a)}>{busy ? 'Annulation…' : 'Confirmer l’annulation'}</button><button className="button outline" disabled={busy} onClick={() => setCancelId(null)}>Conserver l’activité</button></div></div>}
      </> : a.groupId !== null && !groups.some(g => g.id === a.groupId) ? <p className="account-notice">Groupe inactif : activité masquée et gestion bloquée jusqu’à réactivation du groupe.</p> : <>
        {a.published && <a className="text-link" href={`/activites/${a.slug}`}>Voir la fiche de l’activité</a>}
        <p className="management-hint">{a.bookings} inscription{a.bookings === 1 ? '' : 's'} confirmée{a.bookings === 1 ? '' : 's'}. {a.published ? 'Pour modifier, retirez d’abord la publication. Le retrait est bloqué si des inscriptions sont confirmées.' : 'Enregistrez vos modifications avant de publier.'}</p>
        {confirm?.id === a.id ? <div className="group-role-confirm"><p>{a.published ? 'Retirer cette activité du catalogue ? Elle redeviendra un brouillon.' : demoPublish ? `Publier « ${a.content.title} » en démonstration ? Le tarif sera visible, mais le paiement sera simulé et aucune place payante réelle ne sera réservée.` : `Publier « ${a.content.title} » et ouvrir ses inscriptions ${a.content.visibility === 'PRIVEE' ? 'aux membres autorisés' : 'aux comptes Belconnect'} ?`}</p><div className="management-actions"><button className="button coral" disabled={busy} onClick={publish}>{busy ? 'Traitement…' : 'Confirmer'}</button><button className="button outline" disabled={busy} onClick={() => setConfirm(null)}>Annuler</button></div></div> : <div className="management-actions">
          {!a.published && <button className="button outline" disabled={editing !== null || busy || confirm !== null || cancelId !== null} onClick={() => setEditing(a)}>Modifier le brouillon</button>}
          <button className="button outline" disabled={editing !== null || busy || confirm !== null || cancelId !== null || (a.published && a.bookings > 0)} onClick={() => { setError(''); setDemoPublish(false); setConfirm(a); }}>{a.published ? 'Retirer la publication' : 'Publier l’activité'}</button>
          {!a.published && a.content.price > 0 && import.meta.env.DEV && <button className="button outline" disabled={editing !== null || busy || confirm !== null || cancelId !== null} onClick={() => { setError(''); setDemoPublish(true); setConfirm(a); }}>Publier en démonstration</button>}
          {a.published && new Date(a.content.startsAt).getTime() > now && <button className="text-link" disabled={editing !== null || busy || confirm !== null || cancelId !== null} onClick={() => { setError(''); setCancelId(a.id); }}>Annuler l’activité</button>}
        </div>}
        {cancelId === a.id && <div className="group-role-confirm"><p>{a.content.price > 0 ? `Annuler « ${a.content.title} » ? L’activité sera immédiatement fermée. Chaque paiement sera remboursé intégralement, commission comprise ; les inscriptions seront annulées après confirmation des remboursements.` : `Annuler « ${a.content.title} » ? L’activité disparaîtra du catalogue et les ${a.bookings} inscription${a.bookings === 1 ? '' : 's'} confirmée${a.bookings === 1 ? '' : 's'} seront annulée${a.bookings === 1 ? '' : 's'}. Cette action est définitive.`}</p><div className="management-actions"><button className="button coral" disabled={busy} onClick={() => cancelActivity(a)}>{busy ? 'Annulation…' : 'Confirmer l’annulation'}</button><button className="button outline" disabled={busy} onClick={() => setCancelId(null)}>Garder l’activité</button></div></div>}
      </>}
    </article>)}</div>
    {total > 12 && <div className="management-actions"><button className="button outline" disabled={historyPage === 0} onClick={() => {setLoaded(false);setHistoryPage(page => page - 1);}}>Précédent</button><span>Page {historyPage + 1} sur {Math.ceil(total / 12)}</span><button className="button outline" disabled={(historyPage + 1) * 12 >= total} onClick={() => {setLoaded(false);setHistoryPage(page => page + 1);}}>Suivant</button></div>}
  </section>;
}
