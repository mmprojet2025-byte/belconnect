export type UserProfile = { id: number; firstName: string; lastName: string; email: string };
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.name = "HttpError"; this.status = status; }
}
export async function result(response: Response) {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const messages: Record<number, string> = {
      400: "Vérifiez les informations saisies.",
      401: "Votre session a expiré. Reconnectez-vous depuis Connexion.",
      403: "Cette action n’est pas autorisée. Vérifiez vos droits ou actualisez la page si votre session a changé.",
      404: "Cet élément est introuvable ou n’est plus accessible.",
      409: "Cet élément a changé. Vérifiez son état avant de recommencer.",
      429: "Trop de tentatives. Patientez un instant avant de réessayer.",
    };
    throw new HttpError(response.status, response.status < 500 && typeof body?.message === "string" && body.message.trim()
      ? body.message : messages[response.status] ?? "Le service est momentanément indisponible. Réessayez dans un instant.");
  }
  return response.json();
}
export async function postJson(path: string, payload?: object) {
  let csrfResponse: Response;
  try {
    csrfResponse = await fetch('/api/auth/csrf', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000) });
  } catch {
    throw new Error("Impossible de joindre le service. La demande n’a pas été envoyée. Réessayez lorsque la connexion est rétablie.");
  }
  const token = await result(csrfResponse);
  let response: Response;
  try { response = await fetch(path, {
    method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json', [token.headerName]: token.token },
    body: payload ? JSON.stringify(payload) : undefined,
  }); } catch {
    throw new Error("La réponse du serveur n’a pas été reçue. Votre demande a peut-être été enregistrée : vérifiez son état avant de la renvoyer. Vos saisies sont conservées.");
  }
  if (response.status === 204 || response.status === 202) return;
  return result(response);
}
export async function authenticate(mode: 'login' | 'register', payload: object): Promise<UserProfile> { const profile = await postJson(`/api/auth/${mode}`, payload); window.dispatchEvent(new Event("catalog-reset")); return profile; }
export async function currentUser(signal?: AbortSignal): Promise<UserProfile | null> {
  const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store', signal });
  return response.status === 401 ? null : result(response);
}
export async function signOut() { await postJson('/api/auth/logout'); window.dispatchEvent(new Event('catalog-reset')); }
