import {
  state, svc, user, persist, resetDb, loadDb, go, toast, render,
} from '../shared/core.js';
import { seedFilings } from '../shared/filing.js';
import { seedDesk } from './data.js';
import { first } from './helpers.js';
import { getSession, isAuthenticated, logout as clearAuthSession } from '../auth/authClient';
import { personaForEmail } from '../auth/demoAccounts';

const ALLOWED_USERS = ['u1', 'u5', 'u10', 'u12', 'c1', 'x1'];
let booted = false;

// Points state.userId/state.role at one of the six existing prototype personas — used both
// for a real login (role comes from the authenticated session) and for the dev-only "viewing
// as" switcher below (role comes from the persona itself).
function actAsPersona(id, role) {
  state.userId = id;
  state.role = role;
  state.previewAsClient = false;
  Object.assign(state.desk, {
    thread: null, chatList: true, hi: null, chatHidden: true, chatFilter: 'all', readStorageError: '',
  });
}

export function boot(fresh = false) {
  if (booted && !fresh) return;
  booted = true;
  loadDb();
  state.desk = null;
  seedDesk();
  seedFilings();

  // Authentication (RequireAuth/Login, backed by the local demo-account check in
  // ../auth/authClient.js) decides
  // state.authed. If a valid session exists, resolve which of the six existing
  // personas it maps to and use that persona's data for the rest of the app.
  const session = isAuthenticated() ? getSession() : null;
  const persona = session && personaForEmail(session.email);
  if (persona) {
    state.userId = persona.personaId;
    state.role = session.role;
    state.authed = true;
  } else {
    state.authed = false;
    if (!ALLOWED_USERS.includes(state.userId)) state.userId = 'u1';
  }
}

// Called right after a successful login (see ../auth/Login.jsx). Wires the real
// authenticated session into the same acting-persona fields the rest of the app already
// reads (state.userId/state.role), so no other code needs to know real auth exists.
export function hydrateSessionIntoState(session) {
  const persona = personaForEmail(session.email);
  actAsPersona(persona ? persona.personaId : state.userId, session.role);
  state.authed = true;
  persist();
  render();
}

export function logout() {
  clearAuthSession();
  state.authed = false;
  persist();
  render();
}

// Dev-only "viewing as" switcher (Shell.jsx "Preview options"). This is NOT authentication —
// it only changes which existing persona's data/permissions the currently authenticated
// user previews, and never touches the real session from auth/authClient.js.
export function switchPersona(id) {
  const u = user(id);
  actAsPersona(id, u.role);
  persist();
  go('#/dashboard');
}

export function cycleTheme() {
  state.theme = { system: 'light', light: 'dark', dark: 'system' }[state.theme];
  persist();
  render();
}

export function togglePreviewAsClient() {
  state.previewAsClient = !state.previewAsClient;
  persist();
  go('#/dashboard');
}

// Chat reset hooks: the chat module registers callbacks so reset can clear its private storage.
export const resetHooks = [];
export function resetSampleData() {
  if (!window.confirm('Reset all sample data in this browser?')) return;
  resetDb();
  resetHooks.forEach((fn) => fn());
  state.filings = {};
  state.desk = null;
  boot(true);
  render();
  toast('Sample data reset.');
}

// ---------- dialogs ----------
// A dialog is plain data on state.desk.dialog: { kind, ...props }. <DialogHost/> looks the kind
// up in the dialogs registry. `closeHooks[kind](dialog)` may return the dialog to show next.
export const closeHooks = {};
export function openDialog(d) {
  state.desk.dialog = d;
  render();
}
export function closeDialog() {
  const closing = state.desk.dialog;
  const next = closing && closeHooks[closing.kind] ? closeHooks[closing.kind](closing) : null;
  state.desk.dialog = next || null;
  render();
}

// ---------- chat navigation ----------
export function openThread(id) {
  if (!svc.thread(id)) return toast('That conversation is not available for your role.');
  if (state.desk.chatHidden) state.desk.chatAutoOpened = true;
  Object.assign(state.desk, { thread: id, chatList: false, chatHidden: false, hi: null });
  render();
}
export function openMsg(id) {
  const m = state.db.MESSAGES.find((x) => x.id === id);
  if (!m || !svc.thread(m.threadId)) return toast('That chat is not visible to you.');
  if (state.desk.chatHidden) state.desk.chatAutoOpened = true;
  Object.assign(state.desk, { thread: m.threadId, chatList: false, chatHidden: false, hi: id });
  render();
  toast(`Showing ${first(m.by)}'s message in ${svc.thread(m.threadId).name}.`);
}
// A pane opened by an in-page action (a "From chat" link, a message template) is temporary and closes when you leave
// that page. A pane opened or closed with the Chats button is the user's own choice and is left alone.
export function toggleChatPane() {
  state.desk.chatAutoOpened = false;
  state.desk.chatHidden = !state.desk.chatHidden;
  persist();
  render();
}

// Forms in the prototype read values with FormData; same helper for React onSubmit handlers.
export const formData = (form) => Object.fromEntries(new FormData(form));
