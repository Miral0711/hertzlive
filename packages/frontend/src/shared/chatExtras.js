// Shared chat labels and payload helpers used by the desktop pane and both phone clients.
export const REACTIONS = [
  ['✅', 'Done'],
  ['👀', 'Review'],
  ['📝', 'Noted'],
  ['⭐', 'Mark'],
  ['⚠️', 'Flag'],
];
export const QUICK_REPLIES = ['Yes', 'OK', 'On my way'];
export const KIND_LABEL = {
  drawing: 'Drawing', delivery: 'Delivery', sample: 'Sample', location: 'Location', bill: 'Bill',
  material: 'Material', file: 'File', attendance: 'Attendance', checkin: 'Checked in', photo: 'Photo',
};
export const MEDIA_TABS = ['Photos', 'Files', 'Links', 'Voice', 'Drawings'];

export const SAMPLE_MEDIA = {
  site: [
    { title: 'Shuttering A to D', hue: 30, seed: 45 },
    { title: 'Rebar at C4', hue: 28, seed: 23 },
    { title: 'Slab 2 from grid A', hue: 30, seed: 46 },
  ],
  client: [
    { title: 'Kitchen island reference', hue: 20, seed: 8 },
    { title: 'Fluted oak pantry', hue: 32, seed: 12 },
  ],
  internal: [
    { title: 'Window opening sketch', hue: 18, seed: 61 },
    { title: 'Kitchen north wall', hue: 28, seed: 41 },
  ],
  dm: [
    { title: 'Site photo', hue: 28, seed: 21 },
    { title: 'Drawing markup', hue: 200, seed: 2 },
  ],
};

export function reminderAt(which) {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  if (which === 'monday') {
    do { d.setDate(d.getDate() + 1); } while (d.getDay() !== 1);
  } else {
    d.setDate(d.getDate() + 1);
  }
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T09:00`;
}

export function receiptFor(message, later, userId) {
  if (!message || message.by !== userId || message.deleted) return null;
  const rest = (later || []).filter((x) => !x.deleted);
  if (rest.some((x) => x.by !== userId)) return 'seen';
  if (rest.some((x) => x.by === userId)) return 'delivered';
  return 'sent';
}

export function forwardFields(message, text) {
  const fields = { text: text || message.text || 'Message', forwarded: true };
  if (message.photo) fields.photo = message.photo;
  if (message.voice) fields.voice = message.voice;
  if (message.link) fields.link = message.link;
  if (message.contact) fields.contact = message.contact;
  if (message.poll) fields.poll = message.poll;
  if (message.file) fields.file = message.file;
  if (message.media) fields.media = message.media;
  if (message.audio) fields.audio = message.audio;
  if (message.kind && !message.photo) fields.kind = message.kind;
  return fields;
}

export function siteHasSuggestion(r) {
  if (!r?.suggestion) return false;
  const s = r.suggestion;
  return (r.canAttendance && s.headcount) || (r.canDelivery && s.delivery) || (r.canIssue && s.issueTitle);
}

export function hiddenFrom(message, userId) {
  return (message?.hiddenFor || []).includes(userId);
}

const PROJECT_AUDIENCE = ['client', 'internal', 'site'];

export function isProjectAudience(thread) {
  return PROJECT_AUDIENCE.includes(thread?.kind);
}

export function isWorkGroup(thread) {
  return thread?.groupType === 'work';
}

// One recent row per person, custom group, and project. Client, office, and site
// chats fold into that project's latest thread. Work groups open from inside it.
export function recentChatRows(rows, { threadOf, atOf } = {}) {
  const threadOfRow = threadOf || ((row) => row.thread || row.t || row);
  const atOfRow = atOf || ((row) => row.at || '');
  const projects = new Map();
  const rest = [];
  rows.forEach((row) => {
    const thread = threadOfRow(row);
    if (!thread || isWorkGroup(thread)) return;
    const stamp = String(atOfRow(row) || '');
    if (isProjectAudience(thread) && thread.projectId) {
      const prev = projects.get(thread.projectId);
      if (!prev || stamp.localeCompare(prev.stamp) > 0) projects.set(thread.projectId, { row, stamp });
      return;
    }
    rest.push({ row, stamp });
  });
  return [...projects.values(), ...rest]
    .sort((a, b) => b.stamp.localeCompare(a.stamp))
    .map((item) => item.row);
}

export function matchesChatFilter(thread, filter) {
  if (!filter || filter === 'all' || filter === 'unread') return true;
  if (filter === 'projects') return isProjectAudience(thread);
  if (filter === 'people') return thread?.kind === 'dm';
  if (filter === 'groups') return thread?.kind === 'group' && !isWorkGroup(thread);
  return true;
}
