import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { postJson } from '../lib/auth';
import { navigate } from '../lib/navigation';
import './ContactPage.css';

export function ContactPage({ defaultName = '', defaultEmail = '' }: { defaultName?: string; defaultEmail?: string }) {
  const [name,setName]=useState(defaultName); const [email,setEmail]=useState(defaultEmail); const [category,setCategory]=useState('AVIS'); const [message,setMessage]=useState('');
  const [reply,setReply]=useState(false); const [consent,setConsent]=useState(false); const [website,setWebsite]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [sent,setSent]=useState(false);
  const resultHeading=useRef<HTMLHeadingElement>(null); const errorMessage=useRef<HTMLParagraphElement>(null);
  useEffect(()=>{if(sent)resultHeading.current?.focus();else if(error)errorMessage.current?.focus();},[sent,error]);
  const submit=async(event:FormEvent)=>{event.preventDefault();setError('');setBusy(true);try{await postJson('/api/contact',{name:name.trim(),email:email.trim(),category,message:message.trim(),replyRequested:reply,consent,website});setSent(true);}catch(reason){setError(reason instanceof Error?reason.message:'Le message n’a pas pu être envoyé. Réessayez.');}finally{setBusy(false);}};
  if(sent)return <section className="contact-page"><div className="container contact-shell"><div className="contact-card contact-success" role="status"><span aria-hidden="true">✓</span><p className="eyebrow teal">MESSAGE REÇU</p><h1 ref={resultHeading} tabIndex={-1}>Merci pour votre message.</h1><p>Votre contribution a bien été transmise à l’équipe Belconnect. Elle restera privée et ne sera jamais publiée automatiquement.</p><button className="button navy" onClick={()=>navigate('/')}>Retour à l’accueil</button></div></div></section>;
  return <section className="contact-page"><div className="container contact-shell"><header className="contact-intro"><p className="eyebrow coral-text">CONTACT ET AVIS</p><h1 tabIndex={-1}>Aidons Belconnect à grandir, ensemble.</h1><p>Une idée, une question ou quelque chose qui ne fonctionne pas ? Écrivez-nous. Votre message est transmis uniquement à l’équipe Belconnect.</p></header><form className="contact-card" onSubmit={submit}>
    <div className="contact-grid"><label>Nom ou pseudonyme <span>(facultatif)</span><input maxLength={120} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} /></label><label>Adresse e-mail <span id="contact-email-help">{reply?'(obligatoire si vous souhaitez une réponse)':'(facultatif)'}</span><input type="email" required={reply} maxLength={254} autoComplete="email" aria-describedby="contact-email-help" value={email} onChange={e=>setEmail(e.target.value)} /></label></div>
    <label>Catégorie<select required value={category} onChange={e=>setCategory(e.target.value)}><option value="AVIS">Avis</option><option value="SUGGESTION">Suggestion</option><option value="PROBLEME">Problème</option><option value="QUESTION">Question</option></select></label>
    <label>Votre message <span id="contact-message-help">(10 à 4 000 caractères)</span><textarea required minLength={10} maxLength={4000} rows={8} aria-describedby="contact-message-help contact-message-count" value={message} onChange={e=>setMessage(e.target.value)} placeholder="Expliquez-nous ce que vous souhaitez partager…"/><small id="contact-message-count">{message.trim().length} / 4 000</small></label>
    <label className="contact-check"><input type="checkbox" checked={reply} onChange={e=>setReply(e.target.checked)} /><span>Je souhaite recevoir une réponse par e-mail.</span></label>
    <label className="contact-check"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)} /><span>J’accepte que Belconnect utilise ces informations pour traiter mon message. Elles ne seront pas publiées automatiquement.</span></label>
    <label className="contact-honeypot" aria-hidden="true">Site web<input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)} /></label>
    {error&&<p ref={errorMessage} tabIndex={-1} className="contact-error" role="alert">{error}</p>}<div className="contact-actions"><p>Les champs marqués comme facultatifs peuvent rester vides.</p><button className="button coral" aria-busy={busy} disabled={busy||!consent||message.trim().length<10||(reply&&!email.trim())}>{busy?'Envoi…':'Envoyer mon message'}</button></div>
  </form></div></section>;
}
