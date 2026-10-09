// Performance math for People. Pure functions over a db object so task, issue,
// attendance and review records stay the source of truth. No salary writes.
import { addDays } from './liveDates.js';

export const STAFF_ROLES = ['partner', 'designer', 'site_manager', 'hr'];

export const DEFAULT_POINT_RULES = [
  { id: 'task_on_time', label: 'Task completed on time', points: 5, enabled: true },
  { id: 'task_high_priority', label: 'High-priority task completed', points: 8, enabled: true },
  { id: 'issue_within_sla', label: 'Issue resolved within SLA', points: 10, enabled: true },
  { id: 'milestone_done', label: 'Project milestone completed', points: 15, enabled: true },
];

export const BADGE_RULES_VERSION = 3;
export const DEFAULT_BADGES = [
  { id: 'deadline-keeper', name: 'Deadline Keeper', icon: '✎', desc: 'Completed 10 assigned tasks on time', rule: 'tasks_on_time', threshold: 10 },
  { id: 'site-resolver', name: 'Site Resolver', icon: '⚡', desc: 'Resolved 10 issues within SLA', rule: 'issues_sla', threshold: 10 },
  { id: 'consistency', name: 'Consistency', icon: '☀', desc: 'On-time check-in for 5 working days in a row', rule: 'streak', threshold: 5 },
  { id: 'project-finisher', name: 'Project Finisher', icon: '✦', desc: 'Completed 5 assigned milestones on time', rule: 'milestones', threshold: 5 },
  { id: 'studio-contributor', name: 'Studio Contributor', icon: '♡', desc: 'Received 3 recognitions', rule: 'recognitions', threshold: 3 },
];

export const DIMENSION_IDS = ['delivery', 'reliability', 'quality', 'contribution', 'goals'];

// Contribution is not milestone completion. These are the evidence kinds a later
// measured target can use. Recognition stays a separate record.
export const CONTRIBUTION_KINDS = [
  { id: 'mentoring', label: 'Mentoring' },
  { id: 'initiative', label: 'Studio initiative' },
  { id: 'process', label: 'Process improvement' },
];

// Weights are shares of the score, and only dimensions that have records are used.
// The same evidence therefore scores differently for a designer and a site manager.
export const DEFAULT_WEIGHTS = {
  designer: { delivery: 35, reliability: 15, quality: 25, contribution: 10, goals: 15 },
  site_manager: { delivery: 40, reliability: 25, quality: 10, contribution: 10, goals: 15 },
  hr: { delivery: 10, reliability: 30, quality: 15, contribution: 20, goals: 25 },
  partner: { delivery: 20, reliability: 10, quality: 15, contribution: 25, goals: 30 },
};

export const DEFAULT_INCENTIVE_RULES = {
  bands: [
    { id: 'strong', label: 'Strong', minIndex: 85, suggested: 75000 },
    { id: 'solid', label: 'Solid', minIndex: 70, suggested: 40000 },
    { id: 'developing', label: 'Developing', minIndex: 50, suggested: 15000 },
    { id: 'attention', label: 'Needs attention', minIndex: 0, suggested: 0 },
  ],
};

const pad = (n) => String(n).padStart(2, '0');
const ymd = (iso) => (iso || '').slice(0, 10);
const utcDate = (iso) => {
  const [y, m, d] = ymd(iso).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const isSunday = (iso) => utcDate(iso).getUTCDay() === 0;
const monthEnd = (y, m) => {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${pad(m)}-${pad(last)}`;
};

export function localStamp(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function staffUsers(db) {
  return (db.USERS || []).filter((u) => STAFF_ROLES.includes(u.role));
}

export function rulePoints(db, id) {
  const rule = (db.POINT_RULES || []).find((r) => r.id === id);
  if (!rule || rule.enabled === false) return 0;
  const n = Number(rule.points);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function pointsTotal(db, userId) {
  return (db.POINTS_LEDGER || [])
    .filter((e) => e.userId === userId && e.sourceType !== 'opening')
    .reduce((n, e) => n + (Number(e.points) || 0), 0);
}

export function syncPoints(db, userId) {
  const u = (db.USERS || []).find((x) => x.id === userId);
  if (u) u.pts = pointsTotal(db, userId);
  return u ? u.pts : 0;
}

export function grant(db, entry, idFn) {
  if (!entry?.userId || !entry.points) return null;
  db.POINTS_LEDGER = db.POINTS_LEDGER || [];
  const dup = db.POINTS_LEDGER.some((e) => e.userId === entry.userId && e.sourceType === entry.sourceType && e.sourceId === entry.sourceId);
  if (dup) return null;
  const when = entry.createdAt || entry.at;
  const rec = {
    id: idFn(),
    userId: entry.userId,
    points: entry.points,
    reason: entry.reason,
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    createdAt: when,
    at: when,
  };
  db.POINTS_LEDGER.unshift(rec);
  syncPoints(db, entry.userId);
  return rec;
}

export function taskOnTime(task) {
  if (!task?.completedAt || !task.due) return false;
  return ymd(task.completedAt) <= ymd(task.due);
}

export function withinSla(issue) {
  if (!issue?.closedAt || !issue.due) return false;
  const due = issue.due.length <= 10 ? `${ymd(issue.due)}T23:59` : issue.due.slice(0, 16);
  return issue.closedAt.slice(0, 16) <= due;
}

export function taskPointEvents(db, task) {
  const who = task?.owner;
  if (!who || task.status !== 'done') return [];
  const events = [];
  if (taskOnTime(task)) {
    const points = rulePoints(db, 'task_on_time');
    if (points) events.push({ userId: who, points, reason: 'Task completed on time', sourceType: 'task_on_time', sourceId: task.id });
  }
  if (task.critical || task.priority === 'high' || task.priority === 'critical') {
    const points = rulePoints(db, 'task_high_priority');
    if (points) events.push({ userId: who, points, reason: 'High-priority task completed', sourceType: 'task_high_priority', sourceId: task.id });
  }
  return events;
}

export function applyTaskCompletion(db, task, at, by, idFn) {
  if (!task || task.status === 'done') return task;
  task.status = 'done';
  task.stage = 'done';
  task.completedAt = at;
  task.completedBy = by;
  taskPointEvents(db, task).forEach((e) => grant(db, { ...e, at }, idFn));
  return task;
}

export function applyTaskReopen(db, task, stage = 'todo') {
  if (!task) return task;
  const owner = task.owner;
  task.status = 'open';
  task.stage = stage === 'done' ? 'todo' : stage;
  delete task.completedAt;
  delete task.completedBy;
  db.POINTS_LEDGER = (db.POINTS_LEDGER || []).filter((e) => e.sourceId !== task.id);
  if (owner) syncPoints(db, owner);
  return task;
}

export function applyIssueClose(db, issue, at, by, idFn) {
  if (!issue || issue.status === 'closed') return { issue, sla: false };
  issue.status = 'closed';
  issue.closedAt = at;
  issue.verifiedBy = by;
  const sla = withinSla(issue);
  if (sla && issue.assignee) {
    const points = rulePoints(db, 'issue_within_sla');
    if (points) grant(db, { userId: issue.assignee, points, reason: 'Issue resolved within SLA', sourceType: 'issue_within_sla', sourceId: issue.id, at }, idFn);
  }
  return { issue, sla };
}

// One accountable person. An assigned owner wins; otherwise the person who
// completed it. doneBy is not a second credit when an owner is already set.
export function milestoneOwner(milestone) {
  if (!milestone) return null;
  return milestone.ownerId || milestone.doneBy || null;
}

export function applyMilestone(db, milestone, at, by, idFn) {
  if (!milestone || milestone.done) return milestone;
  milestone.done = true;
  milestone.doneAt = at;
  milestone.doneBy = by;
  const who = milestoneOwner(milestone);
  const points = rulePoints(db, 'milestone_done');
  if (points && who) grant(db, { userId: who, points, reason: 'Project milestone completed', sourceType: 'milestone_done', sourceId: milestone.id, at }, idFn);
  return milestone;
}

function holidaySet(db) {
  const dates = new Set();
  (db.HOLIDAYS || []).forEach((h) => dates.add(ymd(h.date)));
  (db.ORG_HOLIDAYS || []).forEach((h) => dates.add(ymd(h.date)));
  return dates;
}

export function attendanceMarks(db, userId, today) {
  const marks = new Map();
  (db.PUNCHES || []).forEach((p) => {
    if (p.userId !== userId || !p.date) return;
    marks.set(ymd(p.date), p.late || (p.in && p.in > '09:30') ? 'late' : 'ontime');
  });
  const live = (db.ATTENDANCE_TODAY || []).find((a) => a.userId === userId);
  if (live && today) {
    if (live.mark === 'leave') marks.set(today, 'leave');
    else if (live.in) marks.set(today, live.mark === 'late' ? 'late' : live.mark === 'ontime' ? 'ontime' : live.in <= '09:30' ? 'ontime' : 'late');
  }
  return marks;
}

export function currentStreak(db, userId, today) {
  if (!today) return 0;
  const marks = attendanceMarks(db, userId, today);
  const holidays = holidaySet(db);
  let cursor = marks.has(today) ? today : addDays(today, -1);
  let streak = 0;
  for (let i = 0; i < 400; i += 1) {
    if (isSunday(cursor) || holidays.has(cursor)) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (marks.get(cursor) === 'ontime') streak += 1;
    else break;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function quarterOf(iso) {
  const [y, m] = ymd(iso).split('-').map(Number);
  const q = Math.floor((m - 1) / 3) + 1;
  const startM = (q - 1) * 3 + 1;
  return { id: `${y}-Q${q}`, label: `Q${q} ${y}`, kind: 'quarter', start: `${y}-${pad(startM)}-01`, end: monthEnd(y, startM + 2) };
}

export function monthOf(iso) {
  const [y, m] = ymd(iso).split('-').map(Number);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return { id: `${y}-${pad(m)}`, label: `${names[m - 1]} ${y}`, kind: 'month', start: `${y}-${pad(m)}-01`, end: monthEnd(y, m) };
}

export function fyOf(iso) {
  const [y, m] = ymd(iso).split('-').map(Number);
  const startY = m >= 4 ? y : y - 1;
  return { id: `FY${startY}`, label: `FY ${startY}–${String(startY + 1).slice(2)}`, kind: 'year', start: `${startY}-04-01`, end: `${startY + 1}-03-31` };
}

export function periodChoices(today) {
  const month = monthOf(today);
  const prevMonth = monthOf(addDays(month.start, -1));
  const quarter = quarterOf(today);
  const prevQuarter = quarterOf(addDays(quarter.start, -1));
  const year = fyOf(today);
  const prevYear = fyOf(addDays(year.start, -1));
  return [month, prevMonth, quarter, prevQuarter, year, prevYear];
}

export function periodById(id, today) {
  return periodChoices(today).find((p) => p.id === id) || quarterOf(today);
}

export function inRange(iso, range) {
  const d = ymd(iso);
  return !!d && d >= range.start && d <= range.end;
}

function eachDay(start, end) {
  const days = [];
  let d = start;
  for (let i = 0; i < 400 && d <= end; i += 1) {
    days.push(d);
    d = addDays(d, 1);
  }
  return days;
}

export function punctuality(db, userId, range, today) {
  const marks = attendanceMarks(db, userId, today);
  const holidays = holidaySet(db);
  const end = range.end < today ? range.end : today;
  let on = 0;
  let recorded = 0;
  eachDay(range.start, end).forEach((d) => {
    if (isSunday(d) || holidays.has(d)) return;
    const mark = marks.get(d);
    if (!mark || mark === 'leave') return;
    recorded += 1;
    if (mark === 'ontime') on += 1;
  });
  if (!recorded) return null;
  return Math.round((on / recorded) * 100);
}

function issuesInPlay(db, range, userId, today) {
  return (db.ISSUES || []).filter((i) => {
    if (userId && i.assignee !== userId) return false;
    const due = ymd(i.due);
    const closed = ymd(i.closedAt);
    const dueIn = due >= range.start && due <= range.end;
    const closedIn = closed >= range.start && closed <= range.end;
    if (i.status === 'closed') return dueIn || closedIn;
    return dueIn && due && due <= today;
  });
}

function tasksInPlay(db, range, userId, today) {
  return (db.TASKS || []).filter((t) => {
    if (userId && t.owner !== userId) return false;
    const due = ymd(t.due);
    const done = ymd(t.completedAt);
    const dueIn = due >= range.start && due <= range.end;
    const doneIn = done >= range.start && done <= range.end;
    if (t.status === 'done') return dueIn || doneIn;
    return dueIn && due && due <= today;
  });
}

export function entryWhen(entry) {
  return entry?.createdAt || entry?.at || '';
}

export function taskStats(db, userId, range, today) {
  const rows = tasksInPlay(db, range, userId, today);
  const done = rows.filter((t) => t.status === 'done');
  const rated = rows.filter((t) => t.due);
  const onTime = rated.filter((t) => t.status === 'done' && taskOnTime(t));
  return {
    completed: done.length,
    considered: rated.length,
    onTime: onTime.length,
    onTimePct: rated.length ? Math.round((onTime.length / rated.length) * 100) : null,
    records: rated.map((t) => ({
      id: t.id,
      title: t.title,
      outcome: t.status !== 'done' ? 'overdue' : taskOnTime(t) ? 'on time' : 'late',
    })),
  };
}

export function issueStats(db, userId, range, today) {
  const rows = issuesInPlay(db, range, userId, today);
  const closed = rows.filter((i) => i.status === 'closed');
  const rated = rows.filter((i) => i.due);
  const sla = rated.filter((i) => i.status === 'closed' && withinSla(i));
  return {
    resolved: closed.length,
    considered: rated.length,
    withinSla: sla.length,
    slaPct: rated.length ? Math.round((sla.length / rated.length) * 100) : null,
    records: rated.map((i) => ({
      id: i.id,
      title: i.title,
      outcome: i.status !== 'closed' ? 'overdue' : withinSla(i) ? 'within SLA' : 'after SLA',
    })),
  };
}

export function periodPoints(db, userId, range) {
  return (db.POINTS_LEDGER || [])
    .filter((e) => e.userId === userId && e.sourceType !== 'opening' && inRange(entryWhen(e), range))
    .reduce((n, e) => n + (Number(e.points) || 0), 0);
}

export function ledgerEntries(db, userId, range) {
  return (db.POINTS_LEDGER || [])
    .filter((e) => e.userId === userId && e.sourceType !== 'opening' && (!range || inRange(entryWhen(e), range)))
    .slice()
    .sort((a, b) => entryWhen(b).localeCompare(entryWhen(a)));
}

export function reviewScore(db, userId, range) {
  const rows = (db.REVIEWS || []).filter((r) => r.userId === userId && r.month >= range.start.slice(0, 7) && r.month <= range.end.slice(0, 7));
  if (!rows.length) return null;
  return +(rows.reduce((n, r) => n + Number(r.score || 0), 0) / rows.length).toFixed(1);
}

export function milestoneCount(db, userId) {
  return milestonesFor(db, userId).filter((m) => m.done && taskOnTime({ completedAt: m.doneAt, due: m.date })).length;
}

function milestonesFor(db, userId) {
  return (db.PROJECTS || []).flatMap((p) => (p.milestones || [])
    .filter((m) => milestoneOwner(m) === userId)
    .map((m) => ({ ...m, project: p.name })));
}

export function badgeCounts(db, userId, today) {
  return {
    tasks_on_time: (db.TASKS || []).filter((t) => t.owner === userId && t.status === 'done' && taskOnTime(t)).length,
    issues_sla: (db.ISSUES || []).filter((i) => i.assignee === userId && i.status === 'closed' && withinSla(i)).length,
    streak: currentStreak(db, userId, today),
    milestones: milestoneCount(db, userId),
    recognitions: (db.RECOGNITIONS || []).filter((r) => r.userId === userId).length,
  };
}

export function evaluateBadges(db, userId, today, idFn) {
  db.BADGE_AWARDS = db.BADGE_AWARDS || [];
  const counts = badgeCounts(db, userId, today);
  db.BADGE_AWARDS = db.BADGE_AWARDS.filter((a) => {
    if (a.userId !== userId) return true;
    const badge = (db.BADGES || []).find((b) => b.id === a.badgeId);
    return !!badge && (counts[badge.rule] || 0) >= (Number(badge.threshold) || 1);
  });
  const earned = [];
  (db.BADGES || []).forEach((b) => {
    if (!b.rule || (counts[b.rule] || 0) < (Number(b.threshold) || 1)) return;
    if (db.BADGE_AWARDS.some((a) => a.badgeId === b.id && a.userId === userId)) return;
    const rec = { id: idFn(), badgeId: b.id, userId, earnedAt: today, reason: b.desc, source: b.rule };
    db.BADGE_AWARDS.push(rec);
    earned.push(rec);
  });
  return earned;
}

export function awardsFor(db, userId, range) {
  return (db.BADGE_AWARDS || [])
    .filter((a) => a.userId === userId && (!range || inRange(a.earnedAt, range)))
    .map((a) => ({ ...a, badge: (db.BADGES || []).find((b) => b.id === a.badgeId) }))
    .filter((a) => a.badge);
}

export function goalResult(db, goal, today) {
  const range = { start: goal.start, end: goal.end };
  const userId = goal.scope === 'individual' ? goal.userId : null;
  const stats = goal.metric === 'issue_sla_pct' ? issueStats(db, userId, range, today) : taskStats(db, userId, range, today);
  const current = goal.metric === 'issue_sla_pct' ? stats.slaPct : stats.onTimePct;
  const target = Number(goal.target) || 0;
  let status = 'active';
  if (current != null && current >= target) status = 'met';
  else if (today > goal.end && current != null) status = 'missed';
  const formula = !stats.considered
    ? (goal.metric === 'issue_sla_pct'
      ? 'No issues were due in this period, so this goal has no result yet.'
      : 'No tasks were due in this period, so this goal has no result yet.')
    : (goal.metric === 'issue_sla_pct'
      ? `Issue SLA % = issues closed within SLA / issues due in the period (${stats.withinSla} / ${stats.considered}).`
      : `On-time task % = tasks completed on time / tasks due in the period (${stats.onTime} / ${stats.considered}).`);
  return { ...goal, current, currentValue: current, target, considered: stats.considered, status, formula, records: stats.records || [] };
}

function average(nums) {
  if (!nums.length) return null;
  return Math.round(nums.reduce((n, v) => n + v, 0) / nums.length);
}

function roleLabel(role) {
  return { designer: 'Designer', site_manager: 'Site manager', hr: 'HR', partner: 'Partner' }[role] || 'This role';
}

export function weightsFor(db, role, range, today) {
  let table = db.PERFORMANCE_WEIGHTS || DEFAULT_WEIGHTS;
  let locked = false;
  if (range && today && today > range.end) {
    table = ensureWeightLock(db, range, today).weights;
    locked = true;
  }
  return { weights: { ...(table[role] || table.designer || DEFAULT_WEIGHTS.designer) }, locked };
}

function weightSnapshot(db) {
  const table = db.PERFORMANCE_WEIGHTS || DEFAULT_WEIGHTS;
  const next = {};
  ['designer', 'site_manager', 'hr', 'partner'].forEach((role) => {
    next[role] = {};
    DIMENSION_IDS.forEach((key) => {
      next[role][key] = Math.max(0, Number(table[role]?.[key]) || 0);
    });
  });
  return next;
}

function ensureWeightLock(db, range, today) {
  db.WEIGHT_LOCKS = db.WEIGHT_LOCKS || {};
  const id = range.id || `${range.start}:${range.end}`;
  if (!db.WEIGHT_LOCKS[id]) {
    db.WEIGHT_LOCKS[id] = {
      id,
      start: range.start,
      end: range.end,
      lockedAt: today,
      weights: weightSnapshot(db),
    };
  }
  return db.WEIGHT_LOCKS[id];
}

export function lockClosedPeriods(db, today) {
  periodChoices(today).forEach((range) => {
    if (today > range.end) ensureWeightLock(db, range, today);
  });
  return db.WEIGHT_LOCKS;
}

export function applyWeightTable(db, next, today) {
  lockClosedPeriods(db, today);
  const table = {};
  ['designer', 'site_manager', 'hr', 'partner'].forEach((role) => {
    table[role] = {};
    DIMENSION_IDS.forEach((key) => {
      table[role][key] = Math.max(0, Number(next?.[role]?.[key]) || 0);
    });
  });
  db.PERFORMANCE_WEIGHTS = table;
  return table;
}

export function performanceAccess(role) {
  const staff = STAFF_ROLES.includes(role);
  const studio = role === 'partner' || role === 'hr';
  return {
    own: staff,
    team: role === 'partner' || role === 'hr' || role === 'site_manager',
    studio,
    reviews: studio,
    incentiveRead: studio,
    incentiveEdit: studio,
    incentiveApprove: role === 'partner',
    configureRules: studio,
  };
}

export function canSeeTeamPerformance(viewer) {
  return performanceAccess(viewer?.role).team;
}

export function canSeeReviewScore(viewer, subjectId) {
  if (!viewer || !performanceAccess(viewer.role).own) return false;
  if (viewer.id === subjectId) return true;
  return performanceAccess(viewer.role).reviews;
}

export function visibleStaff(db, viewer) {
  if (!viewer || viewer.role === 'client' || viewer.role === 'contractor') return [];
  const staff = staffUsers(db);
  if (viewer.role === 'partner' || viewer.role === 'hr') return staff;
  if (viewer.role === 'site_manager') {
    const projectIds = new Set();
    (db.SITES || []).forEach((s) => { if (s.managerId === viewer.id) projectIds.add(s.projectId); });
    (db.PROJECTS || []).forEach((p) => { if ((p.teamIds || []).includes(viewer.id)) projectIds.add(p.id); });
    const ids = new Set([viewer.id]);
    (db.PROJECTS || []).forEach((p) => {
      if (!projectIds.has(p.id)) return;
      (p.teamIds || []).forEach((id) => ids.add(id));
    });
    return staff.filter((u) => ids.has(u.id));
  }
  return staff.filter((u) => u.id === viewer.id);
}

export function canViewPerson(db, viewer, userId) {
  return visibleStaff(db, viewer).some((u) => u.id === userId);
}

export function attendanceRecords(db, userId, range, today) {
  const marks = attendanceMarks(db, userId, today);
  const holidays = holidaySet(db);
  const end = range.end < today ? range.end : today;
  const records = [];
  eachDay(range.start, end).forEach((d) => {
    if (isSunday(d) || holidays.has(d)) return;
    const mark = marks.get(d);
    if (!mark || mark === 'leave') return;
    records.push({ id: d, title: d, outcome: mark === 'ontime' ? 'on time' : 'late' });
  });
  return records;
}

function reviewRecords(db, userId, range) {
  return (db.REVIEWS || [])
    .filter((r) => r.userId === userId && r.month >= range.start.slice(0, 7) && r.month <= range.end.slice(0, 7))
    .map((r) => ({ id: r.id || r.month, title: r.month, outcome: `${r.score} / 5` }));
}

function contributionStats(db, userId, range) {
  const rows = (db.CONTRIBUTIONS || []).filter((c) => c.userId === userId && (inRange(c.at, range) || inRange(c.start, range)));
  return {
    considered: rows.length,
    byKind: Object.fromEntries(CONTRIBUTION_KINDS.map((k) => [k.id, rows.filter((c) => c.kind === k.id).length])),
    records: rows.map((c) => ({
      id: c.id,
      title: c.title || CONTRIBUTION_KINDS.find((k) => k.id === c.kind)?.label || 'Contribution',
      outcome: CONTRIBUTION_KINDS.find((k) => k.id === c.kind)?.label || c.kind || 'recorded',
    })),
  };
}

export function performanceFor(db, userId, range, today, options = {}) {
  const user = (db.USERS || []).find((u) => u.id === userId);
  const role = options.role || user?.role || 'designer';
  const { weights, locked } = weightsFor(db, role, range, today);
  const includeReviews = options.includeReviews !== false;
  const tasks = taskStats(db, userId, range, today);
  const issues = issueStats(db, userId, range, today);
  const goals = (db.GOALS || [])
    .filter((g) => g.scope === 'team' || g.userId === userId)
    .map((g) => goalResult(db, g, today))
    .filter((g) => g.start <= range.end && g.end >= range.start);
  const ownGoals = goals.filter((g) => g.scope === 'individual' && g.userId === userId);
  const attendancePct = punctuality(db, userId, range, today);
  const streak = currentStreak(db, userId, today);
  const review = reviewScore(db, userId, range);
  const contribution = contributionStats(db, userId, range);
  const deliveryParts = [];
  if (tasks.onTimePct != null) deliveryParts.push(tasks.onTimePct);
  if (issues.slaPct != null) deliveryParts.push(issues.slaPct);
  const deliveryBits = [];
  if (tasks.considered) deliveryBits.push(`${tasks.onTime} of ${tasks.considered} tasks due were completed on time`);
  if (issues.considered) deliveryBits.push(`${issues.withinSla} of ${issues.considered} issues due were closed within SLA`);
  const delivery = {
    id: 'delivery',
    label: 'Delivery',
    score: average(deliveryParts),
    weight: weights.delivery || 0,
    formula: deliveryBits.length ? `${deliveryBits.join('. ')}. Delivery is the average of those rates.` : 'No tasks or issues were due in this period.',
    records: [...(tasks.records || []), ...(issues.records || [])],
  };
  const reliability = {
    id: 'reliability',
    label: 'Reliability',
    score: attendancePct,
    weight: weights.reliability || 0,
    formula: attendancePct == null
      ? 'No check-ins were recorded on working days in this period. Leave and unmarked days are not treated as late.'
      : `On-time check-ins / recorded working-day check-ins = ${attendancePct}%. The on-time streak is ${streak} working days, counted from punches only.`,
    records: attendanceRecords(db, userId, range, today),
  };
  const qualityScore = review == null ? null : Math.round((review / 5) * 100);
  const quality = {
    id: 'quality',
    label: 'Quality',
    score: includeReviews ? qualityScore : null,
    weight: weights.quality || 0,
    formula: !includeReviews
      ? 'Review scores are private to the person, HR and partners.'
      : review == null
        ? 'No review was written for this period.'
        : `Review score ${review} / 5 = ${qualityScore}.`,
    records: includeReviews ? reviewRecords(db, userId, range) : [],
  };
  const contributionDim = {
    id: 'contribution',
    label: 'Contribution',
    score: null,
    weight: weights.contribution || 0,
    formula: contribution.considered
      ? `${contribution.considered} contribution record${contribution.considered === 1 ? '' : 's'} this period (${CONTRIBUTION_KINDS.map((k) => `${contribution.byKind[k.id]} ${k.label.toLowerCase()}`).join(', ')}). Recognition is separate. There is no contribution percentage until a measured target is set.`
      : 'No mentoring, studio initiative, or process improvement is recorded for this period. Milestones and recognition are not used as the contribution score.',
    records: contribution.records,
  };
  const measuredGoals = ownGoals.filter((g) => g.currentValue != null);
  const goalsDim = {
    id: 'goals',
    label: 'Goals',
    score: measuredGoals.length ? average(measuredGoals.map((g) => g.currentValue)) : null,
    weight: weights.goals || 0,
    formula: measuredGoals.length
      ? measuredGoals.map((g) => `${g.name}: ${g.formula}`).join(' ')
      : 'No goal in this period has a measurable result yet.',
    records: ownGoals.flatMap((g) => (g.records || []).map((r) => ({ ...r, title: `${g.name}: ${r.title}` }))),
  };
  const dimensions = [delivery, reliability, quality, contributionDim, goalsDim];
  const scored = dimensions.filter((d) => d.score != null && d.weight);
  const weightSum = scored.reduce((n, d) => n + d.weight, 0);
  const score = scored.length >= 2 && weightSum
    ? Math.round(scored.reduce((n, d) => n + d.score * d.weight, 0) / weightSum)
    : null;
  const coverage = `Based on ${scored.length} of ${DIMENSION_IDS.length} dimensions.`;
  const partial = scored.length < DIMENSION_IDS.length;
  const lockNote = locked ? ' Weights for this closed period are locked.' : '';
  let formula;
  if (score == null && scored.length === 1) {
    formula = `${coverage} ${scored[0].label} is ${scored[0].score}. One dimension is not a complete evaluation, so no overall score is shown. Points are not used.${lockNote}`;
  } else if (score == null) {
    formula = `${coverage} Not enough evidence for a performance score. Points are not used.${lockNote}`;
  } else {
    const partialNote = partial ? 'This is a partial score, not a complete evaluation. ' : '';
    formula = `${coverage} ${partialNote}Score = (${scored.map((d) => `${d.label} ${d.score} × ${d.weight}`).join(' + ')}) / ${weightSum}. ${roleLabel(role)} weights. Dimensions without records are left out. Points are not part of this score.${lockNote}`;
  }
  return {
    role, weights, weightsLocked: locked, score, partial, coverage, formula, dimensions, tasks, issues, goals, attendancePct, streak, review: includeReviews ? review : null,
  };
}

export function metricsFor(db, userId, range, today, options = {}) {
  const performance = performanceFor(db, userId, range, today, options);
  return {
    userId,
    points: periodPoints(db, userId, range),
    totalPoints: pointsTotal(db, userId),
    tasks: performance.tasks,
    issues: performance.issues,
    attendancePct: performance.attendancePct,
    streak: performance.streak,
    goals: performance.goals,
    goalPct: performance.dimensions.find((d) => d.id === 'goals')?.score ?? null,
    achievements: awardsFor(db, userId),
    achievementsInPeriod: awardsFor(db, userId, range),
    recognitions: (db.RECOGNITIONS || []).filter((r) => r.userId === userId && inRange(r.at, range)),
    review: performance.review,
    performance,
  };
}

function combineCounts(rows, pick) {
  return rows.reduce((acc, row) => {
    const stats = pick(row);
    acc.completed += stats.completed || stats.resolved || 0;
    acc.considered += stats.considered || 0;
    acc.good += stats.onTime || stats.withinSla || 0;
    acc.records.push(...(stats.records || []));
    return acc;
  }, { completed: 0, considered: 0, good: 0, records: [] });
}

export function teamSnapshot(db, range, today, viewer) {
  const list = viewer ? visibleStaff(db, viewer) : staffUsers(db);
  const seeReviews = !viewer || viewer.role === 'partner' || viewer.role === 'hr';
  const people = list.map((u) => ({
    user: u,
    metrics: metricsFor(db, u.id, range, today, { includeReviews: viewer ? canSeeReviewScore(viewer, u.id) : seeReviews }),
  }));
  const tasks = combineCounts(list, (u) => taskStats(db, u.id, range, today));
  const issues = combineCounts(list, (u) => issueStats(db, u.id, range, today));
  const onTimePct = tasks.considered ? Math.round((tasks.good / tasks.considered) * 100) : null;
  const slaPct = issues.considered ? Math.round((issues.good / issues.considered) * 100) : null;
  const goals = (db.GOALS || [])
    .filter((g) => g.scope === 'team' && g.start <= range.end && g.end >= range.start)
    .map((g) => {
      if (viewer && viewer.role === 'site_manager') {
        const stats = g.metric === 'issue_sla_pct' ? issues : tasks;
        const current = g.metric === 'issue_sla_pct' ? slaPct : onTimePct;
        const formula = g.metric === 'issue_sla_pct'
          ? `Issue SLA % for your sites and projects = issues closed within SLA / issues due (${issues.good} / ${issues.considered}).`
          : `On-time task % for your team = tasks completed on time / tasks due (${tasks.good} / ${tasks.considered}).`;
        let status = 'active';
        if (current != null && current >= Number(g.target || 0)) status = 'met';
        return { ...g, current, currentValue: current, considered: stats.considered, status, formula, records: stats.records };
      }
      return goalResult(db, g, today);
    });
  const recorded = people.map((p) => p.metrics.attendancePct).filter((n) => n != null);
  const measured = goals.filter((g) => g.currentValue != null || g.current != null);
  return {
    people,
    onTimePct,
    slaPct,
    tasksCompleted: tasks.completed,
    issuesResolved: issues.completed,
    goals,
    goalPct: measured.length ? average(measured.map((g) => (g.currentValue != null ? g.currentValue : g.current))) : null,
    attendancePct: recorded.length ? Math.round(recorded.reduce((n, v) => n + v, 0) / recorded.length) : null,
    points: people.reduce((n, p) => n + p.metrics.points, 0),
    recognitions: (db.RECOGNITIONS || []).filter((r) => inRange(r.at, range) && list.some((u) => u.id === r.userId)).length,
  };
}

export function attendanceTrend(db, today) {
  const current = monthOf(today);
  const previous = monthOf(addDays(current.start, -1));
  const before = monthOf(addDays(previous.start, -1));
  const months = [before, previous, current];
  return months.map((range) => {
    const people = staffUsers(db);
    const vals = people.map((u) => punctuality(db, u.id, range, today)).filter((n) => n != null);
    return { ...range, pct: vals.length ? Math.round(vals.reduce((n, v) => n + v, 0) / vals.length) : null };
  });
}

function measuredDimensions(performance) {
  const dims = performance?.dimensions || performance?.performance?.dimensions;
  if (!Array.isArray(dims)) return null;
  return dims.filter((d) => d && d.score != null && d.weight).length;
}

export function suggestIncentive(rules, performance) {
  const score = performance?.score ?? performance?.performance?.score ?? null;
  const measured = measuredDimensions(performance);
  const bands = [...(rules?.bands || [])].sort((a, b) => b.minIndex - a.minIndex);
  if (score == null || !bands.length || (measured != null && measured < 3)) {
    return {
      label: 'Not enough evidence',
      suggested: null,
      index: null,
      reason: score != null && measured != null && measured < 3
        ? `Incentive: Not enough evidence. ${measured} of 5 dimensions are measured, and a recommendation needs at least 3. Points are not used.`
        : 'No performance score this period. Points are not used, and a missing score is not treated as zero.',
    };
  }
  const band = bands.find((b) => score >= b.minIndex) || bands[bands.length - 1];
  return {
    label: band.label,
    suggested: Number(band.suggested) || 0,
    index: score,
    reason: `Recommendation based on complete performance evidence. Recommended from the performance score of ${score} using the configured ${band.label} band (from ${band.minIndex}). Points are not used.`,
  };
}

export function defaultGoals(today) {
  const q = quarterOf(today);
  return [
    {
      id: 'g-team-sla',
      name: 'Close 90% of site issues within SLA',
      description: 'Of the issues due this quarter, how many were closed on time.',
      scope: 'team',
      userId: null,
      metric: 'issue_sla_pct',
      target: 90,
      start: q.start,
      end: q.end,
    },
    {
      id: 'g-u5-tasks',
      name: 'Complete 90% of assigned tasks on time',
      description: 'Assigned tasks due this quarter.',
      scope: 'individual',
      userId: 'u5',
      metric: 'task_ontime_pct',
      target: 90,
      start: q.start,
      end: q.end,
    },
  ];
}

export function ensurePerformance(db, today, idFn) {
  db.POINTS_LEDGER = (db.POINTS_LEDGER || []).filter((e) => e.sourceType !== 'opening');
  db.BADGE_AWARDS = db.BADGE_AWARDS || [];
  db.RECOGNITIONS = db.RECOGNITIONS || [];
  db.GOALS = db.GOALS || [];
  db.POINT_RULES = db.POINT_RULES?.length ? db.POINT_RULES : DEFAULT_POINT_RULES.map((r) => ({ ...r }));
  db.INCENTIVE_RULES = db.INCENTIVE_RULES?.bands?.length ? db.INCENTIVE_RULES : { bands: DEFAULT_INCENTIVE_RULES.bands.map((b) => ({ ...b })) };
  db.INCENTIVE_PLANS = db.INCENTIVE_PLANS || [];
  db.LEADERBOARD = db.LEADERBOARD || { on: true };
  db.CONTRIBUTIONS = db.CONTRIBUTIONS || [];
  db.WEIGHT_LOCKS = db.WEIGHT_LOCKS || {};
  db.PERFORMANCE_WEIGHTS = db.PERFORMANCE_WEIGHTS || JSON.parse(JSON.stringify(DEFAULT_WEIGHTS));
  lockClosedPeriods(db, today);
  if (db.BADGE_RULES_VERSION !== BADGE_RULES_VERSION || !(db.BADGES || []).some((b) => b.rule)) {
    db.BADGES = DEFAULT_BADGES.map((b) => ({ ...b }));
    db.BADGE_RULES_VERSION = BADGE_RULES_VERSION;
    db.BADGE_AWARDS = [];
  }

  staffUsers(db).forEach((u) => {
    if (u.quiet && u.ptsOptOut == null) u.ptsOptOut = true;
    delete u.quiet;
  });
  staffUsers(db).forEach((u) => syncPoints(db, u.id));
  if (!db.GOALS.length) db.GOALS = defaultGoals(today);

  const fy = fyOf(today);
  if (!db.INCENTIVE_PLANS.some((p) => p.id === fy.id)) {
    db.INCENTIVE_PLANS.push({ id: fy.id, name: fy.label, start: fy.start, end: fy.end, lines: {} });
  }
  staffUsers(db).forEach((u) => {
    u.streak = currentStreak(db, u.id, today);
    evaluateBadges(db, u.id, today, idFn);
  });
  return db;
}
