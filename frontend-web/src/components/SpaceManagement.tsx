import { GroupMembers } from './GroupMembers';
import { SpaceAdministrators } from './SpaceAdministrators';
import { OwnerMembers } from './OwnerMembers';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { postJson, result } from '../lib/auth';
import { tr, useLocale } from '../lib/locale';
import { confirmLeavingEditor, useUnsavedChanges } from '../lib/unsavedChanges';

type SpaceContent = { name: string; type: string; description: string };
type Space = SpaceContent & { id: number; version: number };
type Opening = SpaceContent & { id: number; status: string; version: number; spaceId: number | null; reason: string; applicant: string; createdAt: string };
type SpaceQuota = { used: number; max: number; pro: boolean };
type GroupContent = { name: string; description: string; coverUrl: string; openMembership: boolean; visibility: string };
type Group = GroupContent & { id: number; spaceId: number; status: string; version: number; invitationCode: string };
type Management = { space: Space; groups: Group[]; groupQuota?: { used: number; max: number; pro: boolean } };
const spaceTypes = { ASSOCIATION: 'Association', PARTICULIER: 'Particulier', ORGANISATEUR: 'Organisateur' };
const requestStatuses: Record<string, string> = { EN_ATTENTE: 'En attente', APPROUVEE: 'Approuvée', REFUSEE: 'Refusée' };
const message = (e: unknown) => e instanceof Error ? e.message : 'Impossible de joindre le serveur. Réessayez.';
const load = (path: string, signal?: AbortSignal) => fetch(`/api/workspace${path}`, { credentials: 'same-origin', cache: 'no-store', signal }).then(result);
const invitationLink = (code: string) => `${import.meta.env.VITE_INVITATION_ORIGIN || window.location.origin}/groupes?invitation=${code}`;

function SpaceFields({ value, onChange }: { value: SpaceContent; onChange: (value: SpaceContent) => void }) {
  const locale = useLocale();
  return <>
    <label>{tr(locale, 'Nom de l’espace', 'Space name', 'Naam van de ruimte')}<input required minLength={3} maxLength={180} value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} /></label>
    <label>{tr(locale, 'Type d’organisateur', 'Organiser type', 'Type organisator')}<select value={value.type} onChange={e => onChange({ ...value, type: e.target.value })}>{Object.entries(spaceTypes).map(([key, text]) => <option value={key} key={key}>{key === 'ASSOCIATION' ? tr(locale, 'Association', 'Association', 'Vereniging') : key === 'PARTICULIER' ? tr(locale, 'Particulier', 'Individual', 'Particulier') : tr(locale, text, 'Organiser', 'Organisator')}</option>)}</select></label>
    <label>{tr(locale, 'Présentation', 'Description', 'Beschrijving')}<textarea rows={4} maxLength={3000} value={value.description} onChange={e => onChange({ ...value, description: e.target.value })} /></label>
  </>;
}

function OpeningForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const locale = useLocale();
  const [content, setContent] = useState<SpaceContent>({ name: '', type: 'ORGANISATEUR', description: '' });
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await postJson('/api/workspace/requests', { requestId, content }); onDone(); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <form className="draft-editor" onSubmit={submit} onChange={() => setDirty(true)}>
    <h3>{tr(locale, 'Demander un espace organisateur', 'Request an organiser space', 'Een organisatieruimte aanvragen')}</h3>
    <p>{tr(locale, 'Présentez votre organisation. Le propriétaire de Belconnect examine la demande. Si elle est approuvée, vous devenez administrateur de cet espace et pouvez créer vos groupes.', 'Describe your organisation. Belconnect’s owner reviews the request. If approved, you become this space’s administrator and can create groups.', 'Beschrijf uw organisatie. De eigenaar van Belconnect beoordeelt de aanvraag. Na goedkeuring wordt u beheerder van deze ruimte en kunt u groepen aanmaken.')}</p>
    <p className="workspace-description">{tr(locale, 'Cette approbation ne vérifie pas votre identité professionnelle et n’autorise pas encore les encaissements. Avant tout paiement réel, l’identité de l’organisateur et son compte Stripe devront être vérifiés séparément.', 'Approval does not verify your business identity or authorise payments. Before any live payment, the organiser’s identity and Stripe account must be checked separately.', 'Goedkeuring verifieert uw professionele identiteit niet en staat betalingen nog niet toe. Vóór echte betalingen moeten de identiteit van de organisator en diens Stripe-account afzonderlijk worden gecontroleerd.')}</p>
    <fieldset disabled={busy}><SpaceFields value={content} onChange={setContent} /><div className="management-actions"><button className="button coral">{busy ? 'Envoi…' : 'Envoyer la demande'}</button><button type="button" className="button outline" onClick={() => { if (window.confirm('Fermer cette demande et abandonner les saisies non envoyées ?')) onCancel(); }}>Annuler</button></div></fieldset>
    {error && <p className="draft-error" role="alert">{error} Vos saisies sont conservées.</p>}
  </form>;
}

function RequestDecision({ request, onDone }: { request: Opening; onDone: () => void }) {
  const [decision, setDecision] = useState<'APPROUVEE' | 'REFUSEE' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await postJson(`/api/workspace/opening-requests/${request.id}/decision`, { version: request.version, status: decision, reason: reason.trim() }); onDone(); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  if (!decision) return <div className="management-actions"><button className="button coral" onClick={() => setDecision('APPROUVEE')}>Approuver l’ouverture</button><button className="button outline" onClick={() => setDecision('REFUSEE')}>Refuser</button></div>;
  return <form className="draft-editor" onSubmit={submit}><p>{decision === 'APPROUVEE' ? `L’espace sera créé et ${request.applicant} en deviendra administrateur. Cette décision n’autorise pas les paiements réels : ils nécessitent une vérification distincte.` : 'Le demandeur pourra consulter votre motif de refus.'}</p><fieldset disabled={busy}>
    {decision === 'REFUSEE' && <label>Motif du refus<textarea required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>}
    <div className="management-actions"><button className="button coral">{busy ? 'Traitement…' : decision === 'APPROUVEE' ? 'Confirmer l’ouverture' : 'Confirmer le refus'}</button><button type="button" className="button outline" onClick={() => { setDecision(null); setReason(''); setError(''); }}>Annuler</button></div>
  </fieldset>{error && <p role="alert" className="draft-error">{error}</p>}</form>;
}

export function SpaceRequests({ owner, onChanged, mode = 'all' }: { owner: boolean; onChanged: () => void; mode?: 'all' | 'create' | 'list' | 'inbox' }) {
  const [mine, setMine] = useState<Opening[]>([]);
  const [queue, setQueue] = useState<Opening[]>([]);
  const [quota, setQuota] = useState<SpaceQuota | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(10);
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
  return <section id={mode === 'create' ? 'demander-espace' : undefined} aria-labelledby="space-requests-title">
    <div className="account-section-heading"><h2 id="space-requests-title">{owner ? mode === 'inbox' ? 'Demandes d’ouverture à examiner' : 'Demandes d’ouverture d’espace' : mode === 'create' ? 'Demander un espace organisateur' : 'Mes demandes d’espace'}</h2>{mode !== 'create' && <button className="text-link" onClick={refresh}>Actualiser</button>}</div>
    <p className="workspace-description">{owner ? 'L’approbation crée l’espace et nomme son premier administrateur.' : mode === 'create' ? 'Vous pouvez demander un espace pour organiser des groupes et des projets.' : 'Demandez un espace ici et suivez la réponse de Belconnect.'}</p>
    {!owner && mode !== 'list' && quota && <p className="workspace-description">{quota.pro ? 'Pro : jusqu’à 3 espaces organisateurs.' : 'Starter : 1 espace organisateur. Un abonnement Pro actif sur votre espace permet d’en ouvrir jusqu’à 3.'} {quota.used}/{quota.max} place{quota.max > 1 ? 's' : ''} utilisée{quota.used > 1 ? 's' : ''}, demandes en attente comprises.</p>}
    {notice && <p className="account-notice" role="status">{notice}</p>}
    {error && <p className="draft-error" role="alert">{error}</p>}
    {!loaded && !error && <p role="status">Chargement des demandes…</p>}
    {!owner && mode !== 'list' && (editing ? <OpeningForm onCancel={() => setEditing(false)} onDone={() => { setEditing(false); setNotice('Demande envoyée. Suivez sa réponse dans « Mes demandes ».'); refresh(); }} /> : <button className="button outline workspace-create" disabled={!loaded || (quota !== null && quota.used >= quota.max)} onClick={() => setEditing(true)}>{quota && quota.used >= quota.max ? 'Limite atteinte' : 'Demander un espace'}</button>)}
    {!owner && mode !== 'create' && (mine.length > 0 ? <div className="workspace-grid">{mine.map(request => <article className="workspace-card" key={request.id}><span className="account-status">{requestStatuses[request.status]}</span><h3>{request.name}</h3><p>{spaceTypes[request.type as keyof typeof spaceTypes]}</p>{request.status === 'APPROUVEE' && <p>Votre espace est ouvert. Retrouvez-le dans « Espaces et groupes ».</p>}{request.status === 'EN_ATTENTE' && <p>La demande est en cours d’examen. Elle ne donne pas encore de droits d’administration.</p>}{request.reason && <p className="management-copy">Motif : {request.reason}</p>}</article>)}</div> : loaded && <p className="workspace-description">Aucune demande d’espace pour le moment.</p>)}
    {owner && <div className="management-review"><h3>Demandes à examiner</h3><p className="workspace-description">L’approbation attribue des droits dans le nouvel espace uniquement.</p>{loaded && !queue.some(r => r.status === 'EN_ATTENTE') && <p>Aucune demande en attente.</p>}{queue.filter(r => r.status === 'EN_ATTENTE').map(request => <article className="workspace-card" key={request.id}><span className="account-status">En attente</span><h3>{request.name}</h3><p>{request.applicant} · {spaceTypes[request.type as keyof typeof spaceTypes]}</p><p className="management-copy">{request.description || 'Aucune présentation renseignée.'}</p><RequestDecision request={request} onDone={() => { setNotice('Décision enregistrée. Le demandeur peut la consulter dans son espace.'); refresh(); }} /></article>)}{queue.some(r => r.status !== 'EN_ATTENTE') && <details className="workspace-card"><summary>Décisions passées ({queue.filter(r => r.status !== 'EN_ATTENTE').length})</summary>{queue.filter(r => r.status !== 'EN_ATTENTE').slice(0, historyLimit).map(request => <article key={request.id} className="management-copy"><strong>{request.name}</strong> — {requestStatuses[request.status]} · {request.applicant} · demande du {new Date(request.createdAt).toLocaleDateString('fr-BE')}{request.reason && <p>Motif : {request.reason}</p>}</article>)}{queue.filter(r => r.status !== 'EN_ATTENTE').length > historyLimit && <button className="button outline" onClick={() => setHistoryLimit(value => value + 10)}>Voir 10 décisions de plus</button>}</details>}</div>}
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
  const [content, setContent] = useState<GroupContent>(group ? { name: group.name, description: group.description, coverUrl: group.coverUrl, openMembership: false, visibility: group.visibility } : { name: '', description: '', coverUrl: '', openMembership: false, visibility: 'PRIVEE' });
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
    <label>Adresse de l’image de couverture (facultative)<input type="url" pattern="https://.*" maxLength={2048} placeholder="https://…" value={content.coverUrl} onChange={e => setContent({ ...content, coverUrl: e.target.value })} /><span className="management-hint">Utilisez une image accessible en HTTPS. L’import de fichier sera ajouté ultérieurement.</span></label>
    <div className="draft-columns"><label>Visibilité<select value={content.visibility} onChange={e => setContent({ ...content, visibility: e.target.value })}><option value="PRIVEE">Privée</option><option value="PUBLIQUE">Publique</option></select></label></div>
    <p className="management-hint">Un groupe public est visible dans le catalogue. Un groupe privé est réservé aux membres de son espace. Toute nouvelle adhésion doit être approuvée par l’administrateur ou un référent autorisé.</p>
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

export function SpaceManagement({ spaceId, section, onChanged }: { spaceId: number; section: 'groups' | 'settings'; onChanged: () => void }) {
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
      {section === 'settings' && <nav className="workspace-subnav" aria-label="Réglages de l’espace"><button aria-pressed={detailTab === 'information'} disabled={editingSpace} onClick={() => { if (confirmLeavingEditor()) setDetailTab('information'); }}>Informations</button><button aria-pressed={detailTab === 'admins'} disabled={editingSpace} onClick={() => { if (confirmLeavingEditor()) setDetailTab('admins'); }}>Équipe de l’espace</button><button aria-pressed={detailTab === 'members'} disabled={editingSpace} onClick={() => { if (confirmLeavingEditor()) setDetailTab('members'); }}>Membres de l’espace</button></nav>}
      {notice && <p className="account-notice" role="status">{notice}</p>}
      {section === 'settings' && detailTab === 'information' && <section aria-label="Informations de l’espace">{editingSpace ? <SpaceEditor space={data.space} onCancel={() => { setEditingSpace(false); reload(); }} onSaved={space => { setData({ ...data, space }); setEditingSpace(false); setNotice('Les informations de l’espace sont enregistrées.'); onChanged(); }} /> : <div className="workspace-card"><h3>{data.space.name}</h3><span className="account-status">{spaceTypes[data.space.type as keyof typeof spaceTypes]}</span><p>{data.space.description || 'Aucune présentation renseignée.'}</p><button className="button outline workspace-resume" onClick={() => { setNotice(''); setEditingSpace(true); }}>Modifier les informations</button></div>}</section>}
      {section === 'settings' && detailTab === 'admins' && <SpaceAdministrators spaceId={spaceId} onChanged={() => { onChanged(); reload(); }} />}
      {section === 'settings' && detailTab === 'members' && <OwnerMembers spaceId={spaceId} />}
      {section === 'groups' && <section aria-label="Groupes de l’espace"><div className="account-section-heading"><h3 className="management-groups-title">Groupes ({data.groupQuota?.used ?? data.groups.filter(group => group.status !== 'ARCHIVE').length}/{data.groupQuota?.max ?? 3})</h3><button className="button coral" disabled={editingGroup !== null || membersGroup !== null || (data.groupQuota?.used ?? data.groups.filter(group => group.status !== 'ARCHIVE').length) >= (data.groupQuota?.max ?? 3)} onClick={() => { setNotice(''); setEditingGroup('new'); }}>Créer un groupe</button></div>
      <p className="workspace-description">{data.groupQuota?.pro ? 'Pro : jusqu’à 6 groupes actifs ou suspendus.' : 'Starter : jusqu’à 3 groupes actifs ou suspendus.'} Les groupes archivés ne comptent pas. Si l’abonnement Pro prend fin, les groupes déjà créés restent accessibles ; aucune nouvelle création n’est possible au-delà de la limite Starter.</p>
      <div className="account-filters" aria-label="Afficher les groupes"><button aria-pressed={groupView === 'current'} onClick={() => setGroupView('current')}>En cours ({data.groups.filter(group => group.status !== 'ARCHIVE').length})</button><button aria-pressed={groupView === 'archived'} onClick={() => setGroupView('archived')}>Archives ({data.groups.filter(group => group.status === 'ARCHIVE').length})</button></div>
      {editingGroup !== null && <GroupEditor key={editingGroup === 'new' ? 'new' : editingGroup.id} group={editingGroup === 'new' ? null : editingGroup} spaceId={spaceId} onCancel={() => { setEditingGroup(null); reload(); }} onSaved={() => { setEditingGroup(null); setNotice('Le groupe est enregistré.'); reload(); onChanged(); }} />}
      {membersGroup !== null && <GroupMembers key={membersGroup} groupId={membersGroup} onChanged={() => { setAttempt(n => n + 1); onChanged(); }} onClose={() => { setMembersGroup(null); reload(); }} invitationUrl={data.groups.some(group => group.id === membersGroup && group.status === 'ACTIF' && group.visibility === 'PRIVEE') ? invitationLink(data.groups.find(group => group.id === membersGroup)!.invitationCode) : undefined} />}
      {!data.groups.some(group => groupView === 'archived' ? group.status === 'ARCHIVE' : group.status !== 'ARCHIVE') ? <div className="account-empty"><h3>{groupView === 'archived' ? 'Aucun groupe archivé' : 'Votre premier groupe'}</h3>{groupView === 'current' && <p>Créez un groupe pour rassembler votre communauté autour d’un thème ou d’un projet.</p>}</div> : <div className="workspace-grid">{data.groups.filter(group => groupView === 'archived' ? group.status === 'ARCHIVE' : group.status !== 'ARCHIVE').map(group => <article className="workspace-card" key={group.id}>
        {group.coverUrl && <img key={group.coverUrl} className="management-cover" src={group.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.display = 'none'; }} />}
        <span className="account-status">{group.status === 'ACTIF' ? 'Actif' : group.status === 'ARCHIVE' ? 'Archivé' : 'Suspendu'}</span><h3>{group.name}</h3><p className="management-copy">{group.description || 'Aucune description renseignée.'}</p><p>{group.visibility === 'PUBLIQUE' ? 'Visibilité publique' : 'Visibilité privée'} · Adhésion sur demande</p>
        {group.status === 'ACTIF' && group.visibility === 'PRIVEE' && <><button className="button coral workspace-resume" aria-expanded={inviteGroup === group.id} onClick={() => setInviteGroup(value => value === group.id ? null : group.id)}>Inviter une personne</button>{inviteGroup === group.id && <label className="group-invite-link">Lien d’invitation<input readOnly value={invitationLink(group.invitationCode)} onFocus={event => event.currentTarget.select()} onClick={event => event.currentTarget.select()} /></label>}</>}
        {group.status === 'ACTIF' && <button className="text-link workspace-resume" disabled={editingSpace || editingGroup !== null || membersGroup !== null} onClick={() => { setNotice(''); setEditingGroup(group); }}>Modifier ce groupe</button>}
        {group.status === 'ACTIF' && <button className="button outline workspace-resume" disabled={editingSpace || editingGroup !== null || membersGroup !== null} onClick={() => setMembersGroup(group.id)}>Membres du groupe</button>}
        <GroupLifecycle key={`${group.id}-${group.version}`} group={group} spaceId={spaceId} disabled={editingSpace || editingGroup !== null || membersGroup !== null} onReload={reload} onSaved={() => { setNotice('Le statut du groupe est enregistré.'); reload(); onChanged(); }} />
      </article>)}</div>}</section>}
    </>}
  </section>;
}
