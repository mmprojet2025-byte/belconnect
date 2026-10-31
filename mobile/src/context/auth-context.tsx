import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { currentProfile, Credentials, deleteAccount, login, logout, Profile, register, Registration, updateAvatar } from '@/lib/mobile-auth';
import { readToken, removeToken, saveToken } from '@/lib/session-storage';

type AuthState={ profile:Profile|null; token:string|null; ready:boolean; signIn:(value:Credentials)=>Promise<void>; signUp:(value:Registration)=>Promise<void>; chooseAvatar:(avatarCode:string)=>Promise<void>; signOut:()=>Promise<void>; deleteAccount:(password:string)=>Promise<void> };
const AuthContext=createContext<AuthState|null>(null);

export function AuthProvider({children}:PropsWithChildren) {
  const [profile,setProfile]=useState<Profile|null>(null);
  const [token,setToken]=useState<string|null>(null);
  const [ready,setReady]=useState(false);
  useEffect(()=>{ let active=true; readToken().then(async stored=>{ if(!stored)return; try { const value=await currentProfile(stored); if(active){setToken(stored);setProfile(value);} } catch { await removeToken(); } }).finally(()=>{if(active)setReady(true);}); return()=>{active=false;}; },[]);
  async function accept(action:ReturnType<typeof login>) { const session=await action; await saveToken(session.token); setToken(session.token); setProfile(session.profile); }
  const value=useMemo<AuthState>(()=>({ profile,token,ready,signIn:value=>accept(login(value)),signUp:value=>accept(register(value)),chooseAvatar:async avatarCode=>{if(!token)throw new Error('Connectez-vous pour choisir un avatar.');setProfile(await updateAvatar(token,avatarCode));},signOut:async()=>{try{if(token)await logout(token);}finally{await removeToken();setToken(null);setProfile(null);}},deleteAccount:async password=>{if(!token)throw new Error('Veuillez vous reconnecter.');await deleteAccount(token,password);await removeToken();setToken(null);setProfile(null);} }),[profile,ready,token]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('AuthProvider manquant');return value;}
