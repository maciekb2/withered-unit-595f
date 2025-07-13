export interface SessionInfo {
  id: string;
  isNew: boolean;
}

export function getSessionInfo(request: Request): SessionInfo {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)sid=([^;]+)/);
  if (match) {
    return { id: match[1], isNew: false };
  }
  return { id: crypto.randomUUID(), isNew: true };
}

export function appendSessionCookie(response: Response, sessionId: string): void {
  const cookie = `sid=${sessionId}; Path=/; HttpOnly; SameSite=Lax`;
  response.headers.append('Set-Cookie', cookie);
}
