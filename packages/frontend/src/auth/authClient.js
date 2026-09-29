// Thin abstraction around the backend's real auth API (packages/backend/src/routes/auth.ts).
// The rest of the app (router, Shell) should only ever call login()/logout()/getSession()/
// isAuthenticated() here — never read the token or localStorage directly — so a later change
// to how auth is implemented (refresh tokens, cookies, SSO, ...) doesn't ripple outward.
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
const STORAGE_KEY = 'archos-auth-session';

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

function writeSession(session) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort: a prototype login session isn't worth failing the app over if
    // storage is unavailable (private browsing, quota, etc.) — same trade-off the
    // rest of the app already makes (see shared/core.js persist()).
  }
}

// Logs in against the real backend and persists the session (JWT + public user
// fields) to localStorage. Throws with a user-facing message on bad credentials.
export async function login(email, password) {
  let res;
  try {
    res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error('Could not reach the server. Is the backend running?');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Unable to sign in.');

  const session = {
    token: body.token,
    userId: body.user.id,
    organizationId: body.user.organizationId,
    name: body.user.name,
    role: body.user.role,
    email: body.user.email,
  };
  writeSession(session);
  return session;
}

export function logout() {
  writeSession(null);
}

// { token, userId, organizationId, name, role, email } | null
export function getSession() {
  return readSession();
}

export function isAuthenticated() {
  return Boolean(readSession()?.token);
}
