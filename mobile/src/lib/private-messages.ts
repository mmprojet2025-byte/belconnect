import { apiUrl } from '@/lib/api';

export type MessageMember = { id: number; name: string; avatarCode: string | null };
export type Conversation = {
  id: number; groupId: number | null; groupName: string;
  otherUserId: number; otherName: string; otherAvatarCode: string | null; lastMessage: string | null;
  lastAt: string | null; unreadCount: number; blockedByMe: boolean; canSend: boolean;
};
export type PrivateMessage = { id: number; content: string; createdAt: string; readAt: string | null; mine: boolean };
export type ContactProfile = { name: string; email: string; groupName: string; avatarCode: string | null };

const base = `${apiUrl}/api/mobile/messages`;

async function call<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Votre session a expiré. Reconnectez-vous.');
    if (response.status === 403) throw new Error('Cette conversation est bloquée.');
    if (response.status === 404) throw new Error('Cette conversation n’est plus accessible.');
    if (response.status === 429) throw new Error('Attendez un moment avant d’envoyer d’autres messages.');
    throw new Error('La messagerie est momentanément indisponible.');
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export const getConversations = (token: string, signal?: AbortSignal) => call<Conversation[]>('/conversations', token, { signal });
export const getConversation = (id: number, token: string, signal?: AbortSignal) => call<Conversation>(`/conversations/${id}`, token, { signal });
export const getContactProfile = (id: number, token: string) => call<ContactProfile>(`/conversations/${id}/profile`, token);
export const getMessageMembers = (groupId: number, token: string, signal?: AbortSignal) => call<MessageMember[]>(`/groups/${groupId}/members`, token, { signal });
export const startConversation = (groupId: number, recipientId: number, token: string) => call<Conversation>('/conversations', token, { method: 'POST', body: JSON.stringify({ groupId, recipientId }) });
export const getPrivateMessages = (id: number, token: string, before?: number, signal?: AbortSignal) => call<PrivateMessage[]>(`/conversations/${id}/items${before ? `?before=${before}` : ''}`, token, { signal });
export const sendPrivateMessage = (id: number, content: string, requestId: string, token: string) => call<PrivateMessage>(`/conversations/${id}/items`, token, { method: 'POST', body: JSON.stringify({ content, requestId }) });
export const markConversationRead = (id: number, token: string) => call<void>(`/conversations/${id}/read`, token, { method: 'POST' });
export const blockMessageUser = (userId: number, token: string) => call<void>(`/blocks/${userId}`, token, { method: 'PUT' });
export const unblockMessageUser = (userId: number, token: string) => call<void>(`/blocks/${userId}`, token, { method: 'DELETE' });
export const reportPrivateMessage = (messageId: number, reason: string, token: string) => call<void>(`/items/${messageId}/reports`, token, { method: 'POST', body: JSON.stringify({ reason }) });
