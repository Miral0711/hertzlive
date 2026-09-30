// Frontend-only mock of the former Leave/Holiday backend (packages/backend/src/routes/leave.ts,
// holiday.ts, now removed). Unlike most of this prototype's `svc.*` layer, this used to be the
// one feature whose data genuinely lived in Postgres per-organization; it's now backed by
// state.db.ORG_LEAVE_TYPES / ORG_LEAVE_REQUESTS / ORG_HOLIDAYS (see shared/data.js), persisted the
// same way as the rest of the mock db (shared/core.js persist()). Every export keeps the same
// name, signature and resolved-value shape the real fetch client returned, so People.jsx,
// Schedule.jsx and dialogs.jsx needed no changes beyond this file.
import { state, can, persist, uid, user } from '../shared/core.js';
import { TODAY } from '../shared/data.js';
import { DEMO_ACCOUNTS } from '../auth/demoAccounts';

const ORG_ID = 'hertz-demo';
const emailFor = (personaId) => DEMO_ACCOUNTS.find((a) => a.personaId === personaId)?.email || '';

const ok = (value) => Promise.resolve(value);
const fail = (message) => Promise.reject(new Error(message));

function requireLeave(action) {
  if (!can('leave', action)) throw new Error('forbidden');
}
function requireHoliday(action) {
  if (!can('holiday', action)) throw new Error('forbidden');
}

function withLeaveType(r) {
  return { ...r, leaveType: state.db.ORG_LEAVE_TYPES.find((t) => t.id === r.leaveTypeId) || null };
}
function withEmployee(r) {
  const u = user(r.employeeId);
  return { ...r, employee: { id: r.employeeId, name: u.name, email: emailFor(r.employeeId), role: u.role } };
}
function withApprover(r) {
  return { ...r, approver: r.approverId ? { id: r.approverId, name: user(r.approverId).name } : null };
}
const hydrate = (r) => withApprover(withEmployee(withLeaveType(r)));

// ---------- Leave types ----------
export const listLeaveTypes = () => ok(state.db.ORG_LEAVE_TYPES.filter((t) => t.active));
export const createLeaveType = (data) => {
  try {
    requireLeave('a');
    const now = new Date().toISOString();
    const t = { id: uid(), organizationId: ORG_ID, paid: true, allowHalfDay: false, requiresApproval: true, active: true, ...data, createdAt: now, updatedAt: now };
    state.db.ORG_LEAVE_TYPES.push(t);
    persist();
    return ok(t);
  } catch (e) { return fail(e.message); }
};
export const updateLeaveType = (id, data) => {
  try {
    requireLeave('a');
    const t = state.db.ORG_LEAVE_TYPES.find((x) => x.id === id);
    if (!t) return fail('Leave type not found.');
    Object.assign(t, data, { updatedAt: new Date().toISOString() });
    persist();
    return ok(t);
  } catch (e) { return fail(e.message); }
};

// ---------- Balance ----------
// No employeeId = "my balance" (mirrors the real API, which defaulted to the JWT's own user).
export const getLeaveBalance = (employeeId) => {
  const empId = employeeId || state.userId;
  const year = TODAY.slice(0, 4);
  const balances = state.db.ORG_LEAVE_TYPES.filter((t) => t.active).map((t) => {
    const mine = state.db.ORG_LEAVE_REQUESTS.filter((r) => r.employeeId === empId && r.leaveTypeId === t.id && r.startDate.slice(0, 4) === year);
    const used = mine.filter((r) => r.status === 'approved').reduce((n, r) => n + r.totalDays, 0);
    const pending = mine.filter((r) => r.status === 'pending').reduce((n, r) => n + r.totalDays, 0);
    return { employeeId: empId, leaveTypeId: t.id, year: Number(year), allocated: t.annualAllowance, used, pending, remaining: t.annualAllowance - used - pending, leaveType: t };
  });
  return ok(balances);
};

// ---------- Requests ----------
// Approvers (can('leave','a')) see every request, filtered as asked; everyone else only ever
// sees their own, same as the real backend scoping the list to req.user.sub.
export const listLeaveRequests = (filters = {}) => {
  const approver = can('leave', 'a');
  let rows = state.db.ORG_LEAVE_REQUESTS;
  rows = approver ? rows : rows.filter((r) => r.employeeId === state.userId);
  if (filters.employeeId) rows = rows.filter((r) => r.employeeId === filters.employeeId);
  if (filters.leaveTypeId) rows = rows.filter((r) => r.leaveTypeId === filters.leaveTypeId);
  if (filters.status) rows = rows.filter((r) => r.status === filters.status);
  if (filters.from) rows = rows.filter((r) => r.startDate.slice(0, 10) >= filters.from);
  if (filters.to) rows = rows.filter((r) => r.endDate.slice(0, 10) <= filters.to);
  return ok(rows.map(hydrate).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
};
export const applyForLeave = (data) => {
  try {
    requireLeave('w');
    const t = state.db.ORG_LEAVE_TYPES.find((x) => x.id === data.leaveTypeId);
    if (!t) throw new Error('Unknown leave type.');
    const start = new Date(`${data.startDate}T00:00:00.000Z`);
    const end = new Date(`${data.endDate}T00:00:00.000Z`);
    if (Number.isNaN(+start) || Number.isNaN(+end) || end < start) throw new Error('Enter a valid date range.');
    const totalDays = data.halfDay ? 0.5 : Math.round((end - start) / 86400000) + 1;
    const now = new Date().toISOString();
    const r = {
      id: uid(), organizationId: ORG_ID, employeeId: state.userId, leaveTypeId: data.leaveTypeId,
      startDate: start.toISOString(), endDate: end.toISOString(), halfDay: Boolean(data.halfDay),
      totalDays, reason: data.reason || '', status: 'pending', approverId: null, createdAt: now, updatedAt: now,
    };
    state.db.ORG_LEAVE_REQUESTS.push(r);
    persist();
    return ok(hydrate(r));
  } catch (e) { return fail(e.message); }
};
function setStatus(id, status, action) {
  try {
    const r = state.db.ORG_LEAVE_REQUESTS.find((x) => x.id === id);
    if (!r) throw new Error('Leave request not found.');
    if (action === 'cancel') {
      if (r.employeeId !== state.userId && !can('leave', 'a')) throw new Error('forbidden');
      if (r.status !== 'pending') throw new Error('Only pending requests can be cancelled.');
      r.approverId = null;
    } else {
      requireLeave('a');
      if (r.status !== 'pending') throw new Error('Only pending requests can be decided.');
      r.approverId = state.userId;
    }
    r.status = status;
    r.updatedAt = new Date().toISOString();
    persist();
    return ok({ ok: true });
  } catch (e) { return fail(e.message); }
}
export const cancelLeaveRequest = (id) => setStatus(id, 'cancelled', 'cancel');
export const approveLeaveRequest = (id) => setStatus(id, 'approved', 'approve');
export const rejectLeaveRequest = (id) => setStatus(id, 'rejected', 'reject');

// ---------- Holidays ----------
export const listHolidays = () => ok([...state.db.ORG_HOLIDAYS].sort((a, b) => a.date.localeCompare(b.date)));
export const createHoliday = (data) => {
  try {
    requireHoliday('w');
    const now = new Date().toISOString();
    const h = { id: uid(), organizationId: ORG_ID, description: '', ...data, date: new Date(`${data.date}T00:00:00.000Z`).toISOString(), createdAt: now, updatedAt: now };
    state.db.ORG_HOLIDAYS.push(h);
    persist();
    return ok(h);
  } catch (e) { return fail(e.message); }
};
export const updateHoliday = (id, data) => {
  try {
    requireHoliday('w');
    const h = state.db.ORG_HOLIDAYS.find((x) => x.id === id);
    if (!h) throw new Error('Holiday not found.');
    Object.assign(h, data, { date: data.date ? new Date(`${data.date}T00:00:00.000Z`).toISOString() : h.date, updatedAt: new Date().toISOString() });
    persist();
    return ok(h);
  } catch (e) { return fail(e.message); }
};
export const deleteHoliday = (id) => {
  try {
    requireHoliday('w');
    const i = state.db.ORG_HOLIDAYS.findIndex((x) => x.id === id);
    if (i === -1) throw new Error('Holiday not found.');
    state.db.ORG_HOLIDAYS.splice(i, 1);
    persist();
    return ok({ ok: true });
  } catch (e) { return fail(e.message); }
};
