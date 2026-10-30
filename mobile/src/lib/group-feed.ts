import { apiUrl } from '@/lib/api';

export type GroupPost = { id: number; author: string; content: string; createdAt: string; mine: boolean };
export type GroupAnnouncement = { id: number; author: string; content: string; createdAt: string };

async function call<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Votre session a expiré. Reconnectez-vous.');
    if (response.status === 404) throw new Error('Ce groupe ou cette publication n’est plus accessible.');
    throw new Error('Le fil du groupe est momentanément indisponible.');
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

const base = (id: number) => `/api/groups/${id}`;

export function getGroupPosts(id: number, token: string, before?: number, signal?: AbortSignal) {
  return call<GroupPost[]>(`${base(id)}/posts${before ? `?before=${before}` : ''}`, token, { signal });
}

export function getGroupAnnouncements(id: number, token: string, signal?: AbortSignal) {
  return call<GroupAnnouncement[]>(`${base(id)}/announcements`, token, { signal });
}

export function publishGroupPost(id: number, token: string, content: string, requestId: string) {
  return call<GroupPost>(`${base(id)}/posts`, token, { method: 'POST', body: JSON.stringify({ content, requestId }) });
}

export function deleteGroupPost(id: number, postId: number, token: string) {
  return call<void>(`${base(id)}/posts/${postId}`, token, { method: 'DELETE' });
}
