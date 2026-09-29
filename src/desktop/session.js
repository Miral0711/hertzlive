import {
  state, svc, user, persist, resetDb, loadDb, go, toast, render,
} from '../shared/core.js';
import { seedFilings } from '../shared/filing.js';
import { seedDesk } from './data.js';
import { first } from './helpers.js';

const ALLOWED_USERS = ['u1', 'u5', 'u10', 'u12', 'c1', 'x1'];
let booted = false;

export function boot(fresh = false) {
  if (booted && !fresh) return;
  booted = true;
  loadDb();
  if (fresh || !ALLOWED_USERS.includes(state.userId)) {
    state.userId = 'u1';
    state.role = 'partner';
  }
  state.authed = true;
  state.desk = null;
  seedDesk();
  seedFilings();
}

export function switchPersona(id) {
  const u = user(id);
  state.userId = id;
  state.role = u.role;
  state.authed = true;
  state.previewAsClient = false;
  Object.assign(state.desk, {
    thread: null, chatList: true, hi: null, chatHidden: true, chatFilter: 'all', readStorageError: '',
  });
  persist();
  go('#/today');
}

export function cycleTheme() {
  state.theme = { system: 'light', light: 'dark', dark: 'system' }[state.theme];
  persist();
  render();
}

export function togglePreviewAsClient() {
  state.previewAsClient = !state.previewAsClient;
  persist();
  go('#/today');
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
  Object.assign(state.desk, { thread: id, chatList: false, chatHidden: false, hi: null });
  render();
}
export function openMsg(id) {
  const m = state.db.MESSAGES.find((x) => x.id === id);
  if (!m || !svc.thread(m.threadId)) return toast('That chat is not visible to you.');
  Object.assign(state.desk, { thread: m.threadId, chatList: false, chatHidden: false, hi: id });
  render();
  toast(`Showing ${first(m.by)}'s message in ${svc.thread(m.threadId).name}.`);
}
export function toggleChatPane() {
  state.desk.chatHidden = !state.desk.chatHidden;
  persist();
  render();
}

// Forms in the prototype read values with FormData; same helper for React onSubmit handlers.
export const formData = (form) => Object.fromEntries(new FormData(form));
