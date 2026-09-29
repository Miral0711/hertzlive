// AI helper state shared by the assist dialog, chat pane and site review (no JSX, no cycles).
import { state, svc, toast, render, accessibleMessage } from '../../shared/core.js';
import { role } from '../helpers';
import { resetHooks, closeHooks } from '../session';

export const assistTitles = {
  daily: 'Draft daily report',
  client: 'Draft client update',
  followup: 'Suggest follow-up',
  ask: 'Ask about this project',
  compare: 'Compare materials',
  concept: 'Explore finishes',
};
export const assistAllowed = (kind) => typeof svc.assistKinds === 'function' && svc.assistKinds().includes(kind);

// Drafts survive closing the dialog: in memory for this tab and in localStorage per user + role.
const memory = new Map();
export const assistDraftKey = (kind, options) =>
  `archos-desktop-assist:${state.userId}:${role()}:${kind}:${options.issueId ? 'issue:' + options.issueId : options.projectId || options.siteId || options.messageId}`;
export function saveDesktopAssist(d) {
  memory.set(d.key, d);
  try {
    localStorage.setItem(d.key, JSON.stringify({ ...d, busy: false }));
    d.saveError = '';
    return true;
  } catch (_) {
    d.saveError = 'Draft remains in this tab. This device could not save it; keep this page open.';
    return false;
  }
}
export const forgetDesktopAssist = (d) => {
  memory.delete(d.key);
  try { localStorage.removeItem(d.key); } catch (_) { /* ignore */ }
};

export function openDesktopAssist(kind, options = {}) {
  if (!assistAllowed(kind)) return toast('This helper is unavailable for your role.');
  if ((options.projectId && !svc.project(options.projectId)) || (options.siteId && !svc.site(options.siteId))
    || (options.messageId && !accessibleMessage(options.messageId))) return toast('Source unavailable.');
  if (options.issueId && svc.siteIssueDetails(options.issueId)?.issue.projectId !== options.projectId) return toast('Issue unavailable in this project.');
  const key = assistDraftKey(kind, options);
  let saved = memory.get(key);
  if (!saved) { try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { /* ignore */ } }
  const d = saved || { kind: 'assist', assist: kind, key, options: { ...options }, fields: {}, userId: state.userId, role: role() };
  d.busy = false;
  d.requestId = (d.requestId || 0) + 1;
  state.desk.dialog = d;
  render();
  return d;
}

// Return navigation when the helper / its source viewer closes.
closeHooks.assist = (closing) => {
  saveDesktopAssist(closing);
  return !closing.returnReview && closing.options.issueId && svc.siteIssueDetails(closing.options.issueId)
    ? closing.returnIssue || { kind: 'site-issue', issueId: closing.options.issueId }
    : null;
};
closeHooks['assist-source'] = (closing) => closing.draft;

resetHooks.push(() => memory.clear());

export function fileToMoodboard(msgId) {
  if (!svc.fileToMoodboard(msgId)) return toast(state.storageError || 'Could not save to moodboard. Try again.');
  return toast('Added to moodboard.');
}
