export type UserProfile = { id: number; firstName: string; lastName: string; email: string };
export async function result(response: Response) {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || (response.status === 401 ? 'Votre session a expiré. Reconnectez-vous depuis Connexion.' : response.status === 403 ? 'Session expirée. Réessayez.' : 'Connexion au serveur impossible. Réessayez.'));
  }
  return response.json();
}
export async function postJson(path: string, payload?: object) {
  const token = await result(await fetch('/api/auth/csrf', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000) }));
  const response = await fetch(path, {
    method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json', [token.headerName]: token.token },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (response.status === 204) return;
  return result(response);
}
export async function authenticate(mode: 'login' | 'register', payload: object): Promise<UserProfile> { return postJson(`/api/auth/${mode}`, payload); }
export async function currentUser(signal?: AbortSignal): Promise<UserProfile | null> {
  const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store', signal });
  return response.status === 401 ? null : result(response);
}
export async function signOut() { await postJson('/api/auth/logout'); }
