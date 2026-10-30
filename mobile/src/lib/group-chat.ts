import { apiUrl } from '@/lib/api';

export type GroupConversation = {
  groupId: number;
  groupName: string;
  spaceName: string;
  lastMessage: string | null;
  lastAt: string | null;
  unreadCount: number;
};

export type GroupMessage = {
  id: number;
  senderId: number;
  senderName: string;
  content: string;
  createdAt: string;
  mine: boolean;
};

const base = `${apiUrl}/api/mobile/group-messages`;

async function call<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Votre session a expiré. Reconnectez-vous.');
    if (response.status === 404) throw new Error('Cette discussion de groupe n’est plus accessible.');
    if (response.status === 429) throw new Error('Attendez un moment avant d’envoyer d’autres messages.');
    throw new Error('La discussion de groupe est momentanément indisponible.');
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export const getGroupConversations = (token: string, signal?: AbortSignal) =>
  call<GroupConversation[]>('/conversations', token, { signal });

export const getGroupMessages = (groupId: number, token: string, before?: number, signal?: AbortSignal) =>
  call<GroupMessage[]>(`/groups/${groupId}/items${before ? `?before=${before}` : ''}`, token, { signal });

export const sendGroupMessage = (groupId: number, content: string, requestId: string, token: string) =>
  call<GroupMessage>(`/groups/${groupId}/items`, token, { method: 'POST', body: JSON.stringify({ content, requestId }) });

export const markGroupMessagesRead = (groupId: number, lastSeenId: number, token: string) =>
  call<void>(`/groups/${groupId}/read`, token, { method: 'POST', body: JSON.stringify({ lastSeenId }) });
