import { apiUrl } from '@/lib/api';

export type ActivityComment = {
  id: number;
  author: string;
  content: string;
  createdAt: string;
  mine: boolean;
};

async function call<T>(path: string, token?: string | null, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Votre session a expiré. Reconnectez-vous.');
    if (response.status === 404) throw new Error('Cette activité est indisponible.');
    throw new Error('Les commentaires sont momentanément indisponibles.');
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

const path = (id: string) => `/api/activities/${encodeURIComponent(id)}/comments`;

export function getActivityComments(id: string, token?: string | null, before?: number, signal?: AbortSignal) {
  return call<ActivityComment[]>(`${path(id)}${before ? `?before=${before}` : ''}`, token, { signal });
}

export function postActivityComment(id: string, token: string, content: string, requestId: string) {
  return call<ActivityComment>(path(id), token, { method: 'POST', body: JSON.stringify({ content, requestId }) });
}

export function deleteActivityComment(id: string, commentId: number, token: string) {
  return call<void>(`${path(id)}/${commentId}`, token, { method: 'DELETE' });
}
