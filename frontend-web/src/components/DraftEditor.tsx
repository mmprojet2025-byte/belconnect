import { useEffect, useRef, useState } from 'react';
import { ReviewHistory } from './ReviewHistory';
import type { Review } from './ReviewHistory';
import { postJson, result } from '../lib/auth';
import { helpTypes } from '../lib/helpTypes';
import { useUnsavedChanges } from '../lib/unsavedChanges';

export type Draft = { id: number; spaceId: number; groupId: number | null; spaceName: string; groupName: string | null; title: string; description: string; objective: string; startsOn: string | null; endsOn: string | null; imageUrl: string | null; helpTypes: string[]; visibility: 'PUBLIQUE' | 'GROUPE'; version: number; status: string; reviews: Review[] };
type Props = {
  id: number | 'new';
  spaces: { id: number; name: string }[];
  groups: { id: number; spaceId: number; name: string }[];
  onSaved: (draft: Draft) => void;
  onSubmitted: (project: { id: number; title: string; spaceName: string; status: string; reviewStage: string }) => void;
  onClose: () => void;
};
export function DraftEditor({ id, spaces, groups, onSaved, onSubmitted, onClose }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [space, setSpace] = useState(spaces.length === 1 ? String(spaces[0].id) : '');
  const [group, setGroup] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIQUE' | 'GROUPE'>('PUBLIQUE');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [objective, setObjective] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedHelp, setSelectedHelp] = useState(() => Object.keys(helpTypes));
  const [loading, setLoading] = useState(id !== 'new');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [closing, setClosing] = useState(false);
  const [retry, setRetry] = useState(0);
  const requestId = useRef(crypto.randomUUID());
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    if (id === 'new') return;
    const controller = new AbortController();
    fetch(`/api/project-drafts/${id}`, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(result).then((value: Draft) => {
        setDraft(value); setSpace(String(value.spaceId)); setGroup(value.groupId === null ? '' : String(value.groupId)); setVisibility(value.visibility);
        setTitle(value.title); setDescription(value.description); setObjective(value.objective);
        setStartsOn(value.startsOn ?? ''); setEndsOn(value.endsOn ?? ''); setImageUrl(value.imageUrl ?? ''); setSelectedHelp(value.helpTypes); setLoading(false);
      }).catch(e => { if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : 'Brouillon indisponible.'); setLoading(false); } });
    return () => controller.abort();
  }, [id, retry]);
  async function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    if (!selectedHelp.length) { setBusy(false); setError('Choisissez au moins une forme d’aide recherchée.'); return; }
    const content = { title: title.trim(), description: description.trim(), objective: objective.trim(), startsOn: startsOn || null, endsOn: endsOn || null, imageUrl: imageUrl.trim() || null, helpTypes: selectedHelp, visibility };
    try {
      const saved: Draft = draft ? await postJson(`/api/project-drafts/${draft.id}`, { version: draft.version, content }) : await postJson('/api/project-drafts', { spaceId: Number(space), groupId: group ? Number(group) : null, requestId: requestId.current, content });
      setDraft(saved); setDirty(false);
      setTitle(saved.title); setDescription(saved.description); setObjective(saved.objective); setStartsOn(saved.startsOn ?? ''); setEndsOn(saved.endsOn ?? ''); setImageUrl(saved.imageUrl ?? ''); setSelectedHelp(saved.helpTypes); setVisibility(saved.visibility);
      setNotice(saved.status === 'A_CORRIGER' ? 'Corrections enregistrées. Soumettez à nouveau le projet lorsque vous êtes prêt.' : 'Brouillon enregistré. Il reste privé et n’a pas été soumis.'); onSaved(saved);
    } catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement impossible. Vos saisies sont conservées.'); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (!draft || dirty) return;
    setBusy(true); setError(''); setNotice('');
    try { onSubmitted(await postJson(`/api/project-drafts/${draft.id}/submit`, { version: draft.version })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Soumission impossible. Réessayez.'); }
    finally { setBusy(false); }
  }
  const editable = !draft || (spaces.some(s => s.id === draft.spaceId) && (draft.groupId === null || groups.some(g => g.id === draft.groupId && g.spaceId === draft.spaceId)));
  return <section className="draft-editor" aria-labelledby="draft-heading">
    <h3 id="draft-heading" tabIndex={-1} ref={heading}>{draft ? `${draft.status === 'A_CORRIGER' ? 'Corriger le projet' : 'Brouillon'} #${draft.id}` : id === 'new' ? 'Une nouvelle idée' : 'Votre brouillon'}</h3>
    <p>{draft?.status === 'A_CORRIGER' ? 'Reprenez les points signalés ci-dessous. Vos modifications restent privées jusqu’à la nouvelle soumission.' : 'Donnez un titre à votre idée et complétez-la à votre rythme. Seul votre compte peut consulter ce brouillon.'}</p>
    {draft && <ReviewHistory reviews={draft.reviews} />}
    {loading ? <p role="status">Chargement du brouillon…</p> : id !== 'new' && !draft ? <><p role="alert">{error}</p><button className="button outline" onClick={() => { setLoading(true); setError(''); setRetry(n => n + 1); }}>Réessayer</button></> :
      <form onSubmit={save} onChange={() => { setDirty(true); setNotice(''); setConfirmSubmit(false); }}>
        {!editable && <p role="alert">Votre accès à l’espace ou au groupe n’est plus actif. Ce brouillon reste consultable, mais vous ne pouvez plus le modifier.</p>}
        <fieldset disabled={busy || !editable}>
          {draft ? <p className="draft-context">{draft.spaceName}{draft.groupName ? ` · ${draft.groupName}` : ' · Sans groupe'}</p> : <div className="draft-columns"><label>Espace organisateur<select required value={space} onChange={e => { setSpace(e.target.value); setGroup(''); setVisibility('PUBLIQUE'); }}><option value="">Choisir un espace</option>{spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Groupe (facultatif)<select value={group} onChange={e => { setGroup(e.target.value); if (!e.target.value) setVisibility('PUBLIQUE'); }} disabled={!space}><option value="">Sans groupe</option>{groups.filter(g => g.spaceId === Number(space)).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label></div>}
          <label>Qui pourra voir le projet après publication ?<select value={visibility} onChange={e => setVisibility(e.target.value as 'PUBLIQUE' | 'GROUPE')}><option value="PUBLIQUE">Tout le monde</option>{(draft?.groupId || group) && <option value="GROUPE">Uniquement les membres du groupe</option>}</select></label>
          <small>{visibility === 'GROUPE' ? 'Seuls les membres actifs du groupe pourront ouvrir la fiche et proposer leur aide.' : 'La fiche sera visible par tous une fois validée et publiée.'} Le brouillon reste privé avant publication.</small>
          <label>Titre du projet<input required minLength={5} maxLength={180} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex. Un atelier cuisine pour se rencontrer" /></label>
          <label>Description et déroulement (facultatifs au stade du brouillon)<textarea rows={5} maxLength={10000} value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex. Voyage de quatre jours : départ, étapes principales, hébergement et retour." /></label>
          <label>Objectif (facultatif au stade du brouillon)<textarea rows={3} maxLength={3000} value={objective} onChange={e => setObjective(e.target.value)} placeholder="Que souhaitez-vous réaliser ?" /></label>
          <label>Image de couverture (facultative)<input type="url" maxLength={2048} pattern="https://.*" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://exemple.be/photo.jpg" /></label>
          <small>Utilisez une image HTTPS que vous avez le droit de publier. Aucun fichier n’est importé.</small>
          {imageUrl.startsWith('https://') && <img className="draft-cover-preview" src={imageUrl} alt="Aperçu de la couverture du projet" referrerPolicy="no-referrer" />}
          <fieldset className="draft-help-types"><legend>Aides recherchées</legend><p>Choisissez au moins une forme d’aide. Les visiteurs ne pourront proposer que ces aides.</p>{Object.entries(helpTypes).map(([value, label]) => <label key={value}><input type="checkbox" checked={selectedHelp.includes(value)} onChange={e => setSelectedHelp(current => e.target.checked ? [...current, value] : current.filter(item => item !== value))} />{label}</label>)}</fieldset>
          <div className="draft-columns"><label>Premier jour du projet<input type="date" value={startsOn} onChange={e => setStartsOn(e.target.value)} /></label><label>Dernier jour du projet<input type="date" min={startsOn || undefined} value={endsOn} onChange={e => setEndsOn(e.target.value)} /></label></div><small>Précisez la période pour un voyage ou un projet sur plusieurs jours. Le rendez-vous exact et les places se règlent après l’approbation.</small>
          <button type="submit" className="button coral" disabled={busy || (!!draft && !dirty)}>{busy ? 'Enregistrement…' : draft?.status === 'A_CORRIGER' ? 'Enregistrer les corrections' : 'Enregistrer le brouillon'}</button>
        </fieldset>
        {draft && editable && <div className="draft-submission">
          <h4>Prêt à partager votre projet ?</h4>
          <p>La description et l’objectif doivent être complétés et enregistrés. Le projet sera transmis aux référents actifs du groupe, ou directement à l’administrateur de l’espace. Il ne sera pas publié à cette étape.</p>
          {dirty && <p>Enregistrez vos dernières modifications avant de soumettre.</p>}
          {!confirmSubmit ? <button type="button" className="button outline" disabled={busy || dirty || !draft.description.trim() || !draft.objective.trim()} onClick={() => setConfirmSubmit(true)}>{draft.status === 'A_CORRIGER' ? 'Soumettre à nouveau' : 'Soumettre pour validation'}</button> : <div className="account-cancel-confirm">
            <p>Confirmer la soumission de « {draft.title} » ? La version enregistrée sera partagée avec les personnes chargées de la validation. Vous ne pourrez plus la modifier pendant son examen.</p>
            <button type="button" className="button coral" disabled={busy} onClick={submit}>{busy ? 'Soumission…' : 'Confirmer la soumission'}</button>
            <button type="button" className="text-link" disabled={busy} onClick={() => setConfirmSubmit(false)}>Garder en brouillon</button>
          </div>}
        </div>}
        {error && <p role="alert" className="draft-error">{error} Vos saisies restent dans ce formulaire.</p>}
        {notice && <p role="status" className="account-notice">{notice}</p>}
      </form>}
    {!closing ? <button type="button" className="text-link" disabled={busy} onClick={() => dirty ? setClosing(true) : onClose()}>Fermer le brouillon</button> : <div className="account-cancel-confirm"><p>Fermer sans enregistrer les dernières modifications ?</p><button className="button outline" onClick={onClose}>Abandonner les modifications</button><button className="text-link" onClick={() => setClosing(false)}>Continuer la rédaction</button></div>}
  </section>;
}
