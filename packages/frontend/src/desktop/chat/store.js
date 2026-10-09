// Chat-private storage: per thread+user drafts, local unread markers, list helpers.
import { useSyncExternalStore } from 'react';
import { state, svc, messageAttachment } from '../../shared/core.js';
import { resetHooks } from '../session';

const DRAFT_KEY = 'archos-desktop-drafts';
const READ_KEY = 'archos-desktop-read';

const loadObj = (key) => {
  let v = {};
  try { v = JSON.parse(localStorage.getItem(key) || '{}'); } catch (_) { /* unavailable */ }
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
};

// Drafts belong to the sender AND recipient; navigating work must never retarget a draft.
let drafts = loadObj(DRAFT_KEY);
// Local unseen markers are private to this browser/persona, never sender read receipts.
let readMarks = loadObj(READ_KEY);
let readDirty = false;

// Subscription so draft labels / status text update while typing without re-rendering the shell.
let tick = 0;
let rev = 0;
const subs = new Set();
const notify = () => { tick += 1; subs.forEach((f) => f()); };
export const useDraftTick = () =>
  useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => tick);
// Bumps only when a draft changes from outside the composer (AI suggestion, template, send).
export const draftRev = () => rev;

export const draftKey = (thread, userId = state.userId) => `${userId}:${thread}`;
export const chatDraft = (thread) => (typeof drafts[draftKey(thread)] === 'string' ? drafts[draftKey(thread)] : '');
export function setChatDraft(thread, value, userId = state.userId, typing = false) {
  if (!thread) return;
  drafts[draftKey(thread, userId)] = value;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
    state.desk.draftStorageError = '';
  } catch (_) {
    state.desk.draftStorageError = 'Draft is kept for this session only. Browser storage is full or unavailable; keep this window open.';
  }
  if (!typing) rev += 1;
  notify();
}
export const hasDraft = (thread, userId = state.userId) => Boolean(drafts[draftKey(thread, userId)]);

const incoming = (thread) => svc.messages(thread).filter((m) => m.by !== state.userId && !m.deleted && !m.pending && !(m.hiddenFor || []).includes(state.userId));
export function unreadCount(thread) {
  const seen = readMarks[draftKey(thread)];
  return incoming(thread).filter((m) => !Array.isArray(seen) || !seen.includes(m.id)).length;
}
// Idempotent; returns true when markers changed.
export function markChatRead(thread) {
  if (!thread || !svc.thread(thread)) return false;
  const ids = incoming(thread).map((m) => m.id);
  if (!readDirty && JSON.stringify(readMarks[draftKey(thread)]) === JSON.stringify(ids)) return false;
  readMarks[draftKey(thread)] = ids;
  readDirty = true;
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(readMarks));
    readDirty = false;
    state.desk.readStorageError = '';
  } catch (_) {
    state.desk.readStorageError = 'Read status is kept for this session only. Browser storage is unavailable.';
  }
  return true;
}

export function conversationPreview(m) {
  if (!m) return 'No messages yet';
  if (m.deleted) return 'Message deleted';
  return m.text || messageAttachment(m)?.title || (m.voice ? 'Voice note' : m.transcript || m.link?.title || 'Message');
}

export const conversationThreads = () =>
  svc.threads().sort((a, b) => {
    const last = (t) => svc.messages(t.id).at(-1)?.at || '';
    return last(b).localeCompare(last(a));
  });

// One-shot focus request consumed by the pane after the next render.
export const pendingFocus = { current: null };

resetHooks.push(() => {
  drafts = {};
  readMarks = {};
  readDirty = false;
  try { localStorage.removeItem(READ_KEY); } catch (_) { /* ignore */ }
  try { localStorage.removeItem(DRAFT_KEY); } catch (_) { /* ignore */ }
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('archos-desktop-assist:') || k.startsWith('archos-office-reply:'))
      .forEach((k) => localStorage.removeItem(k));
  } catch (_) { /* ignore */ }
  notify();
});
