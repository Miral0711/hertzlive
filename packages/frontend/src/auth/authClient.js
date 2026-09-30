// Frontend-only mock of the former backend auth API (packages/backend/src/routes/auth.ts, now
// removed). The rest of the app (router, Shell) should only ever call login()/logout()/
// getSession()/isAuthenticated() here — never read the token or localStorage directly — so this
// stays the only place that knows login is a local check against the demo accounts below rather
// than a real network call.
import { DEMO_ACCOUNTS } from './demoAccounts';
import { USERS } from '../shared/data.js';

// Matches packages/backend/prisma/seed.ts, which used this password for every demo account.
const DEMO_PASSWORD = 'password';
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

// Validates against the six seeded demo accounts (demoAccounts.js) and synthesizes a session
// with the same shape the real backend used to return. Throws with a user-facing message on
// bad credentials, same as before.
export async function login(email, password) {
  const account = DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === String(email || '').trim().toLowerCase());
  if (!account || password !== DEMO_PASSWORD) throw new Error('Unable to sign in.');
  const persona = USERS.find((u) => u.id === account.personaId);

  const session = {
    token: `mock-token-${account.personaId}`,
    userId: account.personaId,
    organizationId: 'hertz-demo',
    name: persona?.name || account.label,
    role: persona?.role || 'designer',
    email: account.email,
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
