import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import type { UserProfile } from '../lib/auth';
import { navigate } from '../lib/navigation';
import { tr, useLocale } from '../lib/locale';
import '../pages/AccountPage.css';
export function HeaderAccountControls({user, onLogout}: {user: UserProfile; onLogout: () => Promise<void>}) {
 const locale = useLocale();
 const t = (fr:string,en:string,nl:string) => tr(locale,fr,en,nl);
 const profileMenu = useRef<HTMLDetailsElement>(null);
 const [notificationCount,setNotificationCount] = useState(0);
 const [busy,setBusy] = useState(false);
 const [error,setError] = useState('');
 const [isOwner,setIsOwner] = useState(false);
 const [isOrganizer,setIsOrganizer] = useState(false);
 const [isReferent,setIsReferent] = useState(false);
 const openSection = (section:string) => navigate('/mon-espace#'+section);
 async function logout() { setBusy(true); setError(''); try { await onLogout(); } catch { setError(t('Déconnexion impossible. Réessayez.','Sign-out failed. Try again.','Afmelden mislukt. Probeer opnieuw.')); } finally { setBusy(false); } }
 useEffect(() => {
  let active=true;
  const refresh = () => { void fetch('/api/notifications/count',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(v=>{if(active&&v)setNotificationCount(v.unread);}).catch(()=>{}); };
  refresh(); const timer=window.setInterval(refresh,30000);
  window.addEventListener('focus',refresh); window.addEventListener('belconnect:notifications-changed',refresh);
  void fetch('/api/workspace',{credentials:'same-origin'}).then(r=>r.ok?r.json():null).then(v=>{if(!active||!v)return;setIsOwner(v.owner);setIsOrganizer(v.spaces.some((s:{role:string})=>s.role==='ADMINISTRATEUR'));setIsReferent(v.groups.some((g:{role:string})=>g.role==='REFERENT'));}).catch(()=>{});
  const close=(e:MouseEvent)=>{if(profileMenu.current&&!profileMenu.current.contains(e.target as Node))profileMenu.current.open=false;};
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&profileMenu.current?.open){profileMenu.current.open=false;profileMenu.current.querySelector('summary')?.focus();}};
  document.addEventListener('click',close);document.addEventListener('keydown',escape);
  return ()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('belconnect:notifications-changed',refresh);document.removeEventListener('click',close);document.removeEventListener('keydown',escape);};
 },[user.id]);
  const notificationsControl = <a className="account-toolbar-notifications" href="/mon-espace#notifications" aria-label={`${t('Notifications', 'Notifications', 'Meldingen')}${notificationCount ? `, ${notificationCount} ${t('non lues', 'unread', 'ongelezen')}` : ''}`} aria-current={false ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('notifications'); }}><Icon name="bell" />{notificationCount > 0 && <span className="account-toolbar-badge">{notificationCount > 99 ? '99+' : notificationCount}</span>}</a>;
  const profileControl = <details className="account-profile-menu" ref={profileMenu}><summary aria-label={t('Ouvrir le profil', 'Open profile', 'Profiel openen')} title={t('Profil', 'Profile', 'Profiel')}>{user.firstName.slice(0, 1)}{user.lastName.slice(0, 1)}</summary><div className="account-profile-popover"><div className="account-profile-identity"><strong>{user.firstName} {user.lastName}</strong><span>{user.email}</span><small>{isOwner ? t('Propriétaire de Belconnect', 'Belconnect owner', 'Eigenaar van Belconnect') : isOrganizer ? t('Organisateur', 'Organiser', 'Organisator') : isReferent ? t('Référent', 'Group lead', 'Groepsverantwoordelijke') : t('Membre', 'Member', 'Lid')}</small></div><a href="/mon-espace#mon-profil" onClick={event => { event.preventDefault(); if (profileMenu.current) profileMenu.current.open = false; openSection('mon-profil'); }}>{t('Mon profil', 'My profile', 'Mijn profiel')}</a><a href="/mon-espace#reglages-compte" onClick={event => { event.preventDefault(); if (profileMenu.current) profileMenu.current.open = false; openSection('reglages-compte'); }}>{t('Réglages du compte', 'Account settings', 'Accountinstellingen')}</a><a href="/mon-espace#guide" onClick={event => { event.preventDefault(); if (profileMenu.current) profileMenu.current.open = false; openSection('guide'); }}>{t('Guide organisateur', 'Organiser guide', 'Organisatorgids')}</a><button disabled={busy} onClick={() => { if (profileMenu.current) profileMenu.current.open = false; void logout(); }}>{busy ? t('Déconnexion…', 'Signing out…', 'Afmelden…') : t('Se déconnecter', 'Sign out', 'Afmelden')}</button>{error && <p role="alert">{error}</p>}</div></details>;
 return <>{notificationsControl}{profileControl}</>;
}
