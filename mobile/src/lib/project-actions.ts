import { apiUrl } from '@/lib/api';

export type ProjectOffer = { projectId: number; description: string; priceCents: number; placesLeft: number; active: boolean; paymentReady: boolean; startsAt: string; venue: string };
export type FreeProjectEnrollment = { id: number; projectId: number; status: string };
export type ProjectHelp = { id: number; projectId: number; type: string; status: string };

async function call<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, { ...options, headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  if (!response.ok) {
    let message = 'La demande n’a pas pu être traitée.';
    try { const data = await response.json() as { message?: string; detail?: string }; message = data.message || data.detail || message; } catch {}
    if (response.status === 401) message = 'Votre session a expiré. Reconnectez-vous.';
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function getProjectOffer(projectId: number, token: string): Promise<ProjectOffer | null> {
  const response = await fetch(`${apiUrl}/api/project-paid-participations/offer/${projectId}`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Les inscriptions à ce projet sont momentanément indisponibles.');
  return response.json() as Promise<ProjectOffer>;
}

export const getFreeProjectEnrollments = (token: string) => call<FreeProjectEnrollment[]>('/api/project-paid-participations/free', token);
export const getProjectHelp = (token: string) => call<ProjectHelp[]>('/api/project-participations', token);
export const joinFreeProject = (projectId: number, token: string) => call<FreeProjectEnrollment>(`/api/project-paid-participations/free/${projectId}`, token, { method: 'POST' });
export const proposeProjectHelp = (projectId: number, token: string, type: string, message: string, requestId: string) => call<ProjectHelp>('/api/project-participations', token, { method: 'POST', body: JSON.stringify({ projectId, requestId, type, message }) });
