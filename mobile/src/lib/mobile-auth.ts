import { apiUrl } from '@/lib/api';

export type Profile={ id:number; firstName:string; lastName:string; email:string; avatarCode:string|null };
export type Credentials={ email:string; password:string };
export type Registration=Credentials & { firstName:string; lastName:string };
type Session={ profile:Profile; token:string };

async function call<T>(path:string,options:RequestInit={}) {
  const response=await fetch(`${apiUrl}/api/mobile/auth/${path}`,{ ...options,headers:{ Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...options.headers } });
  if(!response.ok) {
    if(response.status===401) throw new Error('Adresse e-mail ou mot de passe incorrect.');
    if(response.status===409) throw new Error('Cette adresse e-mail est déjà utilisée.');
    if(response.status===429) throw new Error('Trop de tentatives. Réessayez dans une minute.');
    throw new Error('Le service BelConnect est momentanément indisponible.');
  }
  return response.status===204?undefined as T:response.json() as Promise<T>;
}

export const login=(body:Credentials)=>call<Session>('login',{method:'POST',body:JSON.stringify(body)});
export const register=(body:Registration)=>call<Session>('register',{method:'POST',body:JSON.stringify(body)});
export const currentProfile=(token:string)=>call<Profile>('me',{headers:{Authorization:`Bearer ${token}`}});
export const updateAvatar=(token:string,avatarCode:string)=>call<Profile>('avatar',{method:'PUT',body:JSON.stringify({avatarCode}),headers:{Authorization:`Bearer ${token}`}});
export const logout=(token:string)=>call<void>('logout',{method:'POST',body:'{}',headers:{Authorization:`Bearer ${token}`}});
