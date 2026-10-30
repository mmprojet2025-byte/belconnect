import { apiUrl } from '@/lib/api';

export type ProjectEntry = {
  id:number;
  projectId:number;
  projectTitle:string;
  title:string;
  imageUrl:string|null;
  spaceName:string;
  status:string;
  createdAt:string;
  startsOn?:string|null;
  type?:string;
  kind:'free'|'paid'|'help';
};

type Enrollment = Omit<ProjectEntry,'kind'|'title'>;
type Help = {id:number;projectId:number;title:string;imageUrl:string|null;spaceName:string;status:string;createdAt:string;type:string};

async function request<T>(path:string,token:string):Promise<T>{
  const response=await fetch(`${apiUrl}${path}`,{headers:{Accept:'application/json',Authorization:`Bearer ${token}`}});
  if(!response.ok)throw new Error('Impossible de charger vos projets.');
  return response.json() as Promise<T>;
}

export async function getMyProjectEntries(token:string):Promise<ProjectEntry[]>{
  const [free,paid,help]=await Promise.all([
    request<Enrollment[]>('/api/project-paid-participations/free',token),
    request<Enrollment[]>('/api/project-paid-participations',token),
    request<Help[]>('/api/project-participations',token),
  ]);
  const entries:ProjectEntry[]=[
    ...free.map(item=>({...item,title:item.projectTitle,kind:'free' as const})),
    ...paid.map(item=>({...item,title:item.projectTitle,kind:'paid' as const})),
    ...help.map(item=>({...item,projectTitle:item.title,kind:'help' as const})),
  ];
  entries.sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
  const byProject=new Map<number,ProjectEntry>();
  for(const entry of entries){
    const current=byProject.get(entry.projectId);
    const priority=(item:ProjectEntry)=>(item.kind==='help'?0:2)+(['ANNULEE','REFUSEE','REMBOURSE'].includes(item.status)?0:1);
    if(!current||priority(entry)>priority(current))byProject.set(entry.projectId,entry);
  }
  return [...byProject.values()].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
}
