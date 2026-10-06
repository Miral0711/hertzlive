import { state, svc, user, me, can, fmtT, fmtD, fmtDT, uid, persist } from '../shared/core';
import { render } from '../shared/store';
import { NOTIFICATIONS } from '../shared/data2';
import { FILE_KINDS, ROOM_WORDS } from '../shared/filing';
import { TODAY } from '../shared/data';

const KIND = { client: 'Client', internal: 'Studio', site: 'Site' };

export const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const firstName = (id) => (user(id).name || 'Someone').split(' ')[0];

export const audience = (thread) => KIND[thread.kind] || 'Chat';

export const projectOf = (id) => svc.project(id);

export const projectName = (id) => state.db.PROJECTS.find((p) => p.id === id)?.name || 'Project';

export const siteFor = (projectId) => svc.sites().find((s) => s.projectId === projectId) || null;

export function myThreads() {
  return svc.threads()
    .map((t) => ({ t, last: [...svc.messages(t.id)].sort((a, b) => a.at.localeCompare(b.at)).at(-1) || null }))
    .sort((a, b) => ((b.last || {}).at || '').localeCompare((a.last || {}).at || ''));
}

export function threadTitle(t) {
  if (t.projectId && t.kind !== 'dm') return projectName(t.projectId);
  return t.name;
}

export function preview(m) {
  if (!m) return 'No messages yet';
  if (m.deleted) return 'This message was deleted';
  if (m.voice) return `Voice note · ${typeof m.voice === 'string' ? m.voice : m.voice.dur || ''}`.trim();
  if (m.photo) return m.text || 'Photo';
  return m.text || 'Update';
}

export function toggleReaction(message, emoji) {
  message.reactions = message.reactions || {};
  const ids = message.reactions[emoji] || [];
  message.reactions[emoji] = ids.includes(state.userId) ? ids.filter((id) => id !== state.userId) : [...ids, state.userId];
  persist();
  render();
}

export function deleteMessage(message) {
  message.deleted = true;
  if (state.filings) delete state.filings[message.id];
  persist();
  render();
}

export function toggleDecision(message) {
  message.decision = !message.decision;
  persist();
  render();
}

export function editMessage(message, text) {
  const value = text.trim();
  if (!value || value === message.text) return;
  message.text = value;
  message.edited = true;
  persist();
  render();
}

export function unreadCount(threadId, readAt) {
  return svc.messages(threadId).filter((m) => m.by !== state.userId && (!readAt || m.at > readAt)).length;
}

export function messagesOf(threadId) {
  return [...svc.messages(threadId)].sort((a, b) => a.at.localeCompare(b.at));
}

export function siblings(thread) {
  if (!thread?.projectId || !['client', 'internal', 'site'].includes(thread.kind)) return [];
  const list = svc.threads().filter((t) => t.projectId === thread.projectId && ['client', 'internal', 'site'].includes(t.kind));
  return list.length > 1 ? list : [];
}

export function postMessage(threadId, fields) {
  state.db.MESSAGES.push({
    id: uid(),
    threadId,
    by: state.userId,
    at: stamp(),
    ...fields,
  });
  persist();
  render();
}

const VOICE = {
  site_manager: { dur: '0:24', text: 'Bathroom tile batch came today, 40 boxes short. Vendor says balance Friday. Tilers idle from Thursday if it does not come.' },
  contractor: { dur: '0:19', text: 'Column C4 rebar is ready. Need an engineer to check before we pour at 9 tomorrow.' },
  designer: { dur: '0:15', text: 'Sharing the latest drawing. Please confirm on site before the mason starts.' },
  partner: { dur: '0:12', text: 'Good work on the terrace. Send me the sample photo before Saturday.' },
  client: { dur: '0:14', text: 'Can we look at a darker wood for the pantry doors?' },
  hr: { dur: '0:10', text: 'Reminder: check attendance before you leave site.' },
};

export function postVoice(threadId) {
  const v = VOICE[state.role] || VOICE.designer;
  postMessage(threadId, { text: v.text, voice: v.dur });
}

export function attentionItems() {
  const id = state.userId;
  const tasks = (state.db.TASKS || [])
    .filter((t) => t.owner === id && t.status !== 'done' && t.status !== 'closed')
    .map((t) => ({
      key: `task:${t.id}`,
      kind: 'Your task',
      title: t.title,
      meta: [projectName(t.projectId), t.due ? `Due ${fmtD(t.due)}` : ''].filter(Boolean).join(' · '),
      projectId: t.projectId,
      hot: t.critical || t.priority === 'critical',
    }));
  const issues = svc.issues()
    .filter((i) => i.assignee === id && i.status !== 'closed')
    .map((i) => ({
      key: `issue:${i.id}`,
      kind: 'Needs your answer',
      title: i.title,
      meta: [projectName(i.projectId), i.drawing, i.sla ? `Reply in ${i.sla}` : ''].filter(Boolean).join(' · '),
      projectId: i.projectId,
      issueId: i.id,
      hot: true,
    }));
  return [...issues, ...tasks];
}

export function waitingItems() {
  const mine = new Set(attentionItems().map((x) => x.key));
  return svc.issues()
    .filter((i) => i.status !== 'closed' && !mine.has(`issue:${i.id}`))
    .slice(0, 4)
    .map((i) => ({
      key: `wait:${i.id}`,
      title: i.title,
      meta: `${projectName(i.projectId)} · ${firstName(i.assignee)}`,
    }));
}

export function projectWork(projectId) {
  return attentionItems().filter((x) => x.projectId === projectId);
}

export function openIssues(projectId) {
  return svc.issues({ projectId }).filter((i) => i.status !== 'closed');
}

export function updates() {
  const role = state.role;
  const notes = NOTIFICATIONS
    .filter((n) => !n.roles || n.roles.includes(role))
    .map((n) => ({ id: n.id, at: n.at, kind: n.kind, title: n.text, detail: 'Studio update', threadId: null }));
  const decisions = svc.threads().flatMap((t) => messagesOf(t.id)
    .filter((m) => m.decision || m.issueId)
    .map((m) => ({
      id: m.id,
      at: m.at,
      kind: m.decision ? 'decision' : 'issue',
      title: m.text,
      detail: `${projectName(t.projectId)} · ${audience(t)}`,
      threadId: t.id,
    })));
  return [...notes, ...decisions].sort((a, b) => b.at.localeCompare(a.at));
}

export function todayCount() {
  return attentionItems().length;
}

export const staff = () => !['client', 'contractor'].includes(state.role);

export const PEOPLE = [
  { id: 'u1', hint: 'Approves leave, sees every project' },
  { id: 'u5', hint: 'Answers site questions, files drawings' },
  { id: 'u10', hint: 'Both sites. Photos, voice notes, workers' },
  { id: 'u12', hint: 'Leave and attendance' },
  { id: 'c1', hint: 'Approves samples, shares references' },
  { id: 'x1', hint: 'Only the Jagwani site chat' },
];

export function viewAs(id) {
  const u = user(id);
  state.userId = id;
  state.role = u.role;
  state.previewAsClient = false;
  persist();
  render();
}

export function phoneOf(u) {
  const vendor = (state.db.VENDORS || []).find((v) => v.userId === u.id);
  if (vendor?.phone) return vendor.phone;
  const n = String((u.id.charCodeAt(1) * 7919) % 100000000).padStart(8, '0');
  return `+91 98${n.slice(0, 3)} ${n.slice(3)}`;
}

const roomOf = (text) => (ROOM_WORDS.find(([re]) => new RegExp(re, 'i').test(text || '')) || [])[1] || '';

export function photoItems(projectId) {
  const items = [];
  svc.mySiteIds().forEach((sid) => {
    const site = svc.site(sid);
    if (!site) return;
    svc.feed(sid).forEach((f) => {
      if (f.type !== 'photo' && f.type !== 'video') return;
      items.push({
        id: f.id, kind: f.type === 'video' ? 'Video' : 'Photo', projectId: site.projectId,
        room: roomOf(f.text), title: f.text, hue: f.hue, seed: f.seed, at: f.at, by: f.by,
        src: 'Site feed', markupOf: f.markupOf,
      });
    });
  });
  myThreads().forEach(({ t }) => {
    messagesOf(t.id).forEach((m) => {
      if (!m.photo && !m.link) return;
      const filing = state.filings?.[m.id];
      items.push({
        id: m.id, msgId: m.id,
        kind: filing && FILE_KINDS[filing.kind] ? FILE_KINDS[filing.kind] : m.link ? 'Reference' : 'Photo',
        projectId: t.projectId, room: filing?.room, title: m.link ? m.link.title : m.text,
        hue: m.link ? m.link.hue : m.photo?.hue, seed: m.link ? m.link.seed : m.photo?.seed,
        dataUrl: m.photo?.dataUrl,
        at: m.at, by: m.by, src: m.link ? m.link.src : threadTitle(t), filing, threadId: t.id,
      });
    });
  });
  svc.myProjectIds().forEach((pid) => {
    (svc.moodboard(pid) || []).forEach((b) => {
      if (items.some((x) => x.title === b.title)) return;
      items.push({
        id: b.id, kind: 'Reference', projectId: pid, title: b.title, hue: b.hue, seed: b.seed,
        at: `${TODAY}T10:00`, src: b.src, decided: b.decided,
      });
    });
  });
  return items
    .filter((i) => !projectId || i.projectId === projectId)
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

export { me, can, user, fmtT, fmtD, fmtDT, state, svc, TODAY, persist, render, uid };
