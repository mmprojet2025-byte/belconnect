import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { postJson } from '../lib/auth';
export function OwnerReverification({onClose}:{onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[recovery,setRecovery]=useState(false);
 useEffect(()=>{dialog.current?.showModal();},[]);
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;const code=String(new FormData(event.currentTarget).get('code'));setBusy(true);setError('');try{await postJson('/api/auth/owner-mfa/verify',{code,recovery});onClose();}catch(cause){setError(cause instanceof Error?cause.message:'Vérification impossible.');}finally{setBusy(false);}}
 return <dialog ref={dialog} className="owner-security owner-reverification" aria-labelledby="owner-reverification-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}><h2 id="owner-reverification-title">Confirmer cette action sensible</h2><p>Votre dernière vérification date de plus de cinq minutes. Confirmez votre code, puis relancez l’action souhaitée. Elle n’a pas été effectuée ; vos saisies restent conservées.</p><form onSubmit={submit} key={recovery?'recovery':'app'}><label>{recovery?'Code de récupération':'Nouveau code à six chiffres'}<input autoFocus name="code" autoComplete={recovery?'off':'one-time-code'} inputMode={recovery?'text':'numeric'} pattern={recovery?'[a-fA-F0-9]{32}':'[0-9]{6}'} maxLength={recovery?32:6} required /></label>{error&&<p role="alert">{error}</p>}<button className="button" disabled={busy}>Confirmer</button><button className="text-link" type="button" disabled={busy} onClick={()=>setRecovery(x=>!x)}>{recovery?'Utiliser Authenticator':'Utiliser un code de récupération'}</button><button className="button outline" type="button" disabled={busy} onClick={onClose}>Annuler</button></form></dialog>;
}
