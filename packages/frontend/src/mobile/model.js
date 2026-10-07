import { state, svc, user, me, can, fmtT, fmtD, fmtDT, uid, persist } from '../shared/core';
import { render } from '../shared/store';
import { NOTIFICATIONS } from '../shared/data2';
import { FILE_KINDS, ROOM_WORDS } from '../shared/filing';
import { TODAY } from '../shared/data';
import { t } from './copy';

export const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const firstName = (id) => (user(id).name || 'Someone').split(' ')[0];

export const audience = (thread) => {
  if (!thread) return t('chat');
  if (thread.kind === 'dm') {
    const other = (thread.memberIds || []).find((id) => id !== state.userId);
    return other ? (user(other).title || t('chat')) : t('chat');
  }
  return { client: t('clientGroup'), internal: t('office'), site: t('siteTeam') }[thread.kind] || t('chat');
};

export function dayLabel(iso) {
  const day = (iso || '').slice(0, 10);
  const today = stamp().slice(0, 10);
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const p = (n) => String(n).padStart(2, '0');
  const yesterday = `${y.getFullYear()}-${p(y.getMonth() + 1)}-${p(y.getDate())}`;
  if (day === today) return t('todayWord');
  if (day === yesterday) return t('yesterday');
  return fmtD(day);
}

export const projectOf = (id) => svc.project(id);

export const projectName = (id) => state.db.PROJECTS.find((p) => p.id === id)?.name || 'Project';

export const siteFor = (projectId) => svc.sites().find((s) => s.projectId === projectId) || null;

export function onPhone(projectId) {
  return !projectId || !svc.phoneHides(projectId);
}

export const hiddenFromMe = (m) => (m.hiddenFor || []).includes(state.userId);

export function myThreads() {
  return svc.threads()
    .filter((t) => onPhone(t.projectId))
    .map((t) => ({ t, last: [...svc.messages(t.id)].filter((m) => !hiddenFromMe(m)).sort((a, b) => a.at.localeCompare(b.at)).at(-1) || null }))
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

export function hideMessage(message) {
  message.hiddenFor = [...new Set([...(message.hiddenFor || []), state.userId])];
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
  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(`field-mute-${threadId}`) === '1') return 0;
  return svc.messages(threadId).filter((m) => m.by !== state.userId && !hiddenFromMe(m) && (!readAt || m.at > readAt)).length;
}

export function messagesOf(threadId) {
  return [...svc.messages(threadId)].filter((m) => !hiddenFromMe(m)).sort((a, b) => a.at.localeCompare(b.at));
}

export function siblings(thread) {
  if (!thread?.projectId || !['client', 'internal', 'site'].includes(thread.kind)) return [];
  const list = svc.threads().filter((t) => t.projectId === thread.projectId && onPhone(t.projectId) && ['client', 'internal', 'site'].includes(t.kind));
  return list.length > 1 ? list : [];
}

export function postMessage(threadId, fields) {
  const thread = svc.thread(threadId);
  if (!can('thread', 'w') || !thread || !onPhone(thread.projectId)) return null;
  state.db.MESSAGES.push({
    id: uid(),
    threadId,
    by: state.userId,
    at: stamp(),
    ...fields,
  });
  persist();
  render();
  return true;
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
  const tasks = (can('task', 'r') ? state.db.TASKS || [] : [])
    .filter((t) => t.owner === id && t.status !== 'done' && t.status !== 'closed' && onPhone(t.projectId))
    .map((t) => ({
      key: `task:${t.id}`,
      kind: 'Your task',
      title: t.title,
      meta: [projectName(t.projectId), t.due ? `Due ${fmtD(t.due)}` : ''].filter(Boolean).join(' · '),
      projectId: t.projectId,
      hot: t.critical || t.priority === 'critical',
    }));
  const issues = svc.issues()
    .filter((i) => i.assignee === id && i.status !== 'closed' && onPhone(i.projectId))
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
      issueId: i.id,
      projectId: i.projectId,
    }));
}

export function projectWork(projectId) {
  return attentionItems().filter((x) => x.projectId === projectId);
}

export function projectNeeds(projectId) {
  const rows = projectWork(projectId).map((item) => ({
    key: item.key,
    kind: item.kind,
    title: item.title,
    meta: item.meta,
    to: item.issueId ? `/mobile/issues/${item.issueId}?from=${encodeURIComponent(`/mobile/projects/${projectId}`)}` : null,
    taskId: item.key.startsWith('task:') ? item.key.slice(5) : null,
  }));
  if (state.role === 'client') {
    svc.materials({ projectId }).filter((m) => m.status === 'client_pending').forEach((m) => {
      rows.push({
        key: `mat:${m.id}`,
        kind: 'Your approval',
        title: m.name,
        meta: m.vendor || '',
        to: `/mobile/projects/${projectId}/materials`,
      });
    });
    (state.db.CHANGES || []).filter((c) => c.projectId === projectId && c.status === 'awaiting_client').forEach((c) => {
      rows.push({
        key: `chg:${c.id}`,
        kind: 'Your approval',
        title: c.title,
        meta: c.no,
        to: `/mobile/projects/${projectId}/changes`,
      });
    });
  }
  return rows;
}

export function nextDeadline(project) {
  if (!project) return null;
  const rows = [];
  (project.milestones || []).forEach((m) => {
    if (!m.done && m.date) rows.push({ title: m.name, date: m.date.slice(0, 10) });
  });
  if (can('issue', 'r')) {
    openIssues(project.id).forEach((issue) => {
      if (issue.due) rows.push({ title: issue.title, date: issue.due.slice(0, 10) });
    });
  }
  if (can('task', 'r')) {
    const all = state.role === 'partner';
    (state.db.TASKS || []).forEach((task) => {
      if (task.projectId === project.id && task.status === 'open' && task.due && (all || task.owner === state.userId)) {
        rows.push({ title: task.title, date: task.due.slice(0, 10) });
      }
    });
  }
  if (['partner', 'client', 'designer'].includes(state.role)) {
    svc.decisionsDue({ projectId: project.id }).forEach((d) => {
      if (d.due) rows.push({ title: d.title, date: d.due.slice(0, 10) });
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  return rows[0] || null;
}

const phoneDrawingKey = () => `archos-phone-drawings:${state.userId}:${state.role}`;

export function phoneDrawings(projectId, kind) {
  const project = projectOf(projectId);
  if (!project || !can('drawing', 'r')) return [];
  try {
    const data = JSON.parse(localStorage.getItem(phoneDrawingKey()) || '{}');
    return (Array.isArray(data[kind]) ? data[kind] : [])
      .filter((x) => x && x.projectId === projectId && x.no)
      .flatMap((x) => {
        const drawing = (project.drawings || []).find((d) => d.no === x.no);
        return drawing ? [{ ...x, d: drawing }] : [];
      });
  } catch (_) {
    return [];
  }
}

export function rememberPhoneDrawing(projectId, no, save = false) {
  const project = projectOf(projectId);
  const drawing = project?.drawings?.find((d) => d.no === no);
  if (!drawing || !can('drawing', 'r')) return 'failed';
  try {
    const data = JSON.parse(localStorage.getItem(phoneDrawingKey()) || '{}');
    const kind = save ? 'saved' : 'recent';
    const old = Array.isArray(data[kind]) ? data[kind] : [];
    const list = old.filter((x) => x && (x.projectId !== projectId || x.no !== no));
    const removing = save && list.length !== old.length;
    data[kind] = removing ? list : [{ projectId, no, rev: drawing.rev }, ...list];
    if (!save) data[kind] = data[kind].slice(0, 12);
    localStorage.setItem(phoneDrawingKey(), JSON.stringify(data));
    return removing ? 'removed' : 'saved';
  } catch (_) {
    return 'failed';
  }
}

export function openIssues(projectId) {
  return svc.issues({ projectId }).filter((i) => i.status !== 'closed');
}

export function updates() {
  const role = state.role;
  const notes = NOTIFICATIONS
    .filter((n) => !n.roles || n.roles.includes(role))
    .map((n) => ({ id: n.id, at: n.at, kind: n.kind, title: n.text, detail: 'Studio update', threadId: null }));
  const decisions = svc.threads().filter((t) => onPhone(t.projectId)).flatMap((t) => messagesOf(t.id)
    .filter((m) => m.decision || m.issueId)
    .map((m) => ({
      id: m.id,
      at: m.at,
      kind: m.decision ? 'decision' : 'issue',
      title: m.text,
      detail: `${projectName(t.projectId)} · ${audience(t)}`,
      threadId: t.id,
      messageId: m.id,
      issueId: m.issueId || null,
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
