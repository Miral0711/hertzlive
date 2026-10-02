import { useEffect, useState } from 'react';
import { state, svc, can, inr, fmtD, fmtDT, go, me, persist, render, toast, uid } from '../../shared/core.js';
import { TEAM_GOAL, TODAY } from '../../shared/data.js';
import { HOURLY } from '../../shared/data2.js';
import { user } from '../../shared/core.js';
import {
  Avatar, Bar, Btn, Card, DataTable, Empty, Grid2, Input, List, Item, PageHeader, Pill, Select, StatusPill, Switch, Tabs, ToggleChip,
} from '../../ui/ui';
import { FromChat } from '../parts';
import { P, V, first, name, role } from '../helpers';
import { openDialog } from '../session';
import { Muted, SecHead, Stat, leaveClashes, tabBase } from './common';
import { LoadGrid } from './Schedule';
import Folders from './Folders';
import {
  applyForLeave, cancelLeaveRequest, getLeaveBalance,
  listLeaveRequests, listLeaveTypes, rejectLeaveRequest,
} from '../../api/leaveClient';
import { getSession } from '../../auth/authClient';

const Directory = () => {
  const people = svc.people();
  const att = (u) => state.db.ATTENDANCE_TODAY.find((x) => x.userId === u.id) || {};
  const roles = [...new Set(people.map((u) => u.role))];
  return (
    <>
      <SecHead title="Directory" sub={`${people.length} people across ${roles.length} roles. Filter the table to find anyone.`} />
      <Card>
        <DataTable
          cols={['Person', 'Title', 'Phone', 'Skills', 'Projects', 'Today']}
          rows={people.map((u) => {
            const a = att(u);
            const tel = (state.db.VENDORS.find((v) => v.userId === u.id) || {}).phone || u.phone
              || `+91 98${String(u.id).replace(/\D/g, '').padStart(3, '0')}0 00000`;
            return [
              <span className="inline-flex items-center gap-2.5"><Avatar accent sm>{u.ini || u.name.slice(0, 1)}</Avatar><b>{u.name}</b></span>,
              <span className="text-ink-2">{u.title || u.role}</span>,
              <a href={`tel:${tel.replace(/\s/g, '')}`} className="text-accent-text underline">{tel}</a>,
              <span className="text-ink-3">{(u.skills || []).join(', ')}</span>,
              <span className="text-ink-3">{state.db.PROJECTS.filter((p) => p.teamIds.includes(u.id)).map((p) => p.name.split(' ')[0]).join(', ')}</span>,
              a.in ? <StatusPill status={'in ' + a.in} /> : <StatusPill status={a.mark || 'not in'} />,
            ];
          })}
        />
      </Card>
    </>
  );
};

const Load = () => (
  <>
    <SecHead title="Load, next 4 weeks" sub="Hours per person per project. Over 40 is red, under 24 is grey. Reassign a week's load to someone else." />
    <Card><LoadGrid reassign /></Card>
  </>
);

// Org Leave Management, backed by the mock ../../api/leaveClient.js (state.db.ORG_LEAVE_TYPES /
// ORG_LEAVE_REQUESTS). (The Dashboard's own "pending leave" widget and Schedule's "Who's
// away"/reassignment features still read the separate, older mock LEAVES array on purpose -
// rewiring those is a different feature and out of scope here.)
function Leaves() {
  const approver = can('leave', 'a');
  const [types, setTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeId, setTypeId] = useState('');
  const [status, setStatus] = useState('');
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      listLeaveTypes(),
      getLeaveBalance(),
      listLeaveRequests(approver ? { status: status || undefined, leaveTypeId: typeId || undefined, from: from || undefined, to: to || undefined } : {}),
    ])
      .then(([t, b, r]) => { setTypes(t); setBalances(b); setRequests(r); })
      .catch((e) => setError(e.message || 'Could not load leave data.'))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [approver, status, typeId, from, to, state.desk.leaveRev]);

  const selectedType = types.find((t) => t.id === typeId) || types[0];

  const apply = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const p = Object.fromEntries(new FormData(form));
    applyForLeave({
      leaveTypeId: p.leaveTypeId,
      startDate: p.startDate,
      endDate: p.endDate,
      halfDay: p.halfDay === 'on',
      reason: p.reason || undefined,
    })
      .then(() => { toast('Leave requested.'); form.reset(); load(); })
      .catch((e) => toast(e.message));
  };
  const cancel = (id) => cancelLeaveRequest(id).then(() => { toast('Leave request cancelled.'); load(); }).catch((e) => toast(e.message));
  const decide = (id, ok) => {
    // Approving opens the stand-in dialog; declining is immediate.
    if (ok) { openDialog({ kind: 'org-leave-approve', id }); return undefined; }
    return rejectLeaveRequest(id).then(() => { toast('Leave rejected.'); load(); }).catch((e) => toast(e.message));
  };

  const shownRequests = employeeQuery.trim()
    ? requests.filter((r) => `${r.employee?.name || ''} ${r.employee?.email || ''}`.toLowerCase().includes(employeeQuery.trim().toLowerCase()))
    : requests;

  // Who is away now or soon, from approved org requests plus the older studio leave list.
  const horizon = new Date(new Date(TODAY).getTime() + 30 * 864e5).toISOString().slice(0, 10);
  const awayRows = [
    ...state.db.ORG_LEAVE_REQUESTS.filter((r) => r.status === 'approved').map((r) => ({ userId: r.employeeId, from: r.startDate.slice(0, 10), to: r.endDate.slice(0, 10), type: state.db.ORG_LEAVE_TYPES.find((t) => t.id === r.leaveTypeId)?.name || 'Leave' })),
    ...state.db.LEAVES.filter((l) => l.status === 'approved').map((l) => ({ userId: l.userId, from: l.from, to: l.to, type: `${l.type} leave` })),
  ].filter((x) => x.to >= TODAY && x.from <= horizon).sort((x, y) => x.from.localeCompare(y.from));
  const pendingN = state.db.ORG_LEAVE_REQUESTS.filter((r) => r.status === 'pending').length;

  return (
    <>
      <SecHead title="Leave requests" sub={approver ? 'Approve or decline requests. Approving suggests a stand-in and checks site visits.' : 'Request leave and track your balance.'} />
      {balances.length > 0 && (
        <div className="mb-3.5 grid grid-cols-2 gap-gap lg:grid-cols-4">
          {balances.slice(0, 4).map((b) => (
            <Stat key={b.leaveTypeId} label={b.leaveType?.name || 'Leave'} value={`${b.remaining} left`} sub={`${b.used} used · ${b.pending} pending of ${b.allocated}`} />
          ))}
        </div>
      )}
      <div className={`mb-3.5 grid items-start gap-gap [&>*]:min-w-0 ${can('leave', 'w') && types.length > 0 ? 'lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]' : ''}`}>
        <Card title={`Who is away${awayRows.length ? ` · ${awayRows.length}` : ''}`}>
          {awayRows.length === 0 ? <Empty>Nobody is away in the next 30 days.</Empty> : awayRows.map((x, i) => {
            const { visits, sites } = leaveClashes(x.userId, x.from, x.to);
            const clash = visits.length + sites.length;
            return (
              <div key={i} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0">
                <span className="min-w-0 flex-1">
                  <b className="block">{name(x.userId)}</b>
                  <small className="text-ink-3">{x.type} · {fmtD(x.from)}{x.to !== x.from ? ` to ${fmtD(x.to)}` : ''}</small>
                </span>
                {clash > 0
                  ? <Pill kind="warn">Clashes with {visits.length ? `${visits.length} site visit${visits.length === 1 ? '' : 's'}` : 'a site'}</Pill>
                  : <Pill kind="ok">No clash</Pill>}
              </div>
            );
          })}
        </Card>
        {can('leave', 'w') && types.length > 0 && (
          <Card title="Request leave">
            <form onSubmit={apply} className="grid gap-2.5 sm:grid-cols-2">
              <Select name="leaveTypeId" value={typeId || selectedType?.id} onChange={(e) => setTypeId(e.target.value)} aria-label="Leave type" className="sm:col-span-2">
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}{t.paid ? '' : ' (unpaid)'}</option>)}
              </Select>
              <Input type="date" name="startDate" aria-label="From" required />
              <Input type="date" name="endDate" aria-label="To" required />
              <Input name="reason" placeholder="Reason" className="sm:col-span-2" />
              <div className="flex items-center justify-between gap-2 sm:col-span-2">
                {selectedType?.allowHalfDay ? <label className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" name="halfDay" /> Half day</label> : <span />}
                <Btn kind="primary" type="submit">Request leave</Btn>
              </div>
            </form>
          </Card>
        )}
      </div>
      <div className="mt-5"><SecHead title="All requests" sub={`${requests.length} shown${pendingN ? ` · ${pendingN} waiting for a decision` : ''}`} /></div>
      <Card>
        {error && <p className="mb-2.5 text-crit">{error}</p>}
        {approver && (
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            <Input placeholder="Filter by employee name or email" value={employeeQuery} onChange={(e) => setEmployeeQuery(e.target.value)} className="w-[220px]" aria-label="Filter by employee" />
            <Select value={typeId} onChange={(e) => setTypeId(e.target.value)} aria-label="Filter by type">
              <option value="">All types</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
              <option value="">All statuses</option>
              {['pending', 'approved', 'rejected', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <label className="flex items-center gap-1.5 text-[13px]">From <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Filter from date" /></label>
            <label className="flex items-center gap-1.5 text-[13px]">To <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Filter to date" /></label>
          </div>
        )}
        {loading ? <Muted>Loading…</Muted> : (
          <DataTable
            cols={[...(approver ? ['Person'] : []), 'Type', 'From', 'To', 'Days', 'Reason', 'Status', '']}
            rows={shownRequests.map((l) => [
              ...(approver ? [l.employee?.name || '—'] : []),
              l.leaveType?.name || '—', fmtD(l.startDate.slice(0, 10)), fmtD(l.endDate.slice(0, 10)), l.totalDays, l.reason || '',
              <StatusPill status={l.status} />,
              l.status === 'pending' && approver ? (
                <div className="flex gap-2">
                  <Btn sm kind="primary" onClick={() => decide(l.id, true)}>Approve</Btn>
                  <Btn sm onClick={() => decide(l.id, false)}>Decline</Btn>
                </div>
              ) : l.status === 'pending' && (!approver || l.employeeId === getSession()?.userId) ? (
                // Non-approvers only ever see their own requests here (leaveClient.js scopes the
                // list to the signed-in session's userId); approvers see everyone's, so this
                // compares against that same session id, not the "viewing as" `state.userId`.
                <Btn sm onClick={() => cancel(l.id)}>Cancel</Btn>
              ) : '',
            ])}
          />
        )}
      </Card>
    </>
  );
}

function Attendance({ q }) {
  const mine = state.db.ATTENDANCE_TODAY.find((a) => a.userId === state.userId);
  const away = svc.away(TODAY);
  const pu = q.punchUser || state.userId;
  const pm = q.punchMonth || TODAY.slice(0, 7);
  const p = svc.punches(pu, pm);
  const all = svc.attendance();
  const n = (f) => all.filter(f).length;
  const filter = (user_, month) => go(`#/people?tab=attendance&punchUser=${encodeURIComponent(user_ || state.userId)}&punchMonth=${encodeURIComponent(month || TODAY.slice(0, 7))}`);
  return (
    <>
      <SecHead title="Attendance today" sub={`${fmtD(TODAY)} · who is in, late or away, with punch history below.`}>
        {mine && !mine.in ? (
          <Btn kind="primary" onClick={() => { const r = svc.checkIn(); toast(r.late ? `Checked in at ${r.t}, marked late.` : `Checked in at ${r.t}.`); render(); }}>Check in</Btn>
        ) : mine && !mine.out ? (
          <Btn onClick={() => { toast(`Checked out at ${svc.checkOut()}.`); render(); }}>Check out</Btn>
        ) : mine && mine.out ? (
          <Btn onClick={() => { const r = svc.checkIn(); toast(`Checked in again at ${r.t}.`); render(); }}>Check in again</Btn>
        ) : null}
      </SecHead>
      <div className="mb-3.5 grid grid-cols-2 gap-gap lg:grid-cols-4">
        <Stat label="In" value={n((a) => a.in && a.mark !== 'late')} sub="on time" tone="text-ok" />
        <Stat label="Late" value={n((a) => a.mark === 'late')} sub="after 09:30" tone={n((a) => a.mark === 'late') ? 'text-warn' : ''} />
        <Stat label="Half day" value={n((a) => a.mark === 'half')} sub="checked in after 13:00" />
        <Stat label="On leave" value={n((a) => a.mark === 'leave')} sub="away today" />
      </div>
      <div className="grid items-start gap-gap xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <Card title="Today">
          <DataTable
            cols={['Person', 'In', 'Out', 'Mark', 'Note']}
            rows={all.map((a) => [name(a.userId), a.in || '—', a.out || '—', <StatusPill status={a.mark} />, a.note || ''])}
          />
        </Card>
        <div className="flex flex-col gap-gap">
          <Card title="Away today">
            {away.length === 0 ? <Empty>Everyone is available.</Empty> : away.map((x, i) => (
              <div key={i} className="border-t border-line py-2 first:border-t-0 first:pt-0"><b>{x.userId ? name(x.userId) : 'Unassigned'}</b><small className="block text-ink-3">{x.why}</small></div>
            ))}
          </Card>
        </div>
      </div>
      <div className="mt-5"><SecHead title="Punch history" sub="Every check-in and check-out for one person, by month." /></div>
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[13px]">Person
            <Select value={pu} onChange={(e) => filter(e.target.value, pm)}>
              {svc.people().map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </label>
          <label className="flex items-center gap-2 text-[13px]">Month
            <Input type="month" value={pm} onChange={(e) => filter(pu, e.target.value)} />
          </label>
          <span className="ml-auto text-[13px] text-ink-3">{p.days} day{p.days === 1 ? '' : 's'} · {p.late} late · {p.hours} h total</span>
        </div>
        <DataTable
          cols={['Date', 'In', 'Out', 'Site', 'Late']}
          rows={p.rows.map((r) => [fmtD(r.date), r.in || '—', r.out || '—', r.site || '', r.late ? <StatusPill status="late" /> : ''])}
        />
      </Card>
    </>
  );
}

function Timesheets() {
  const by = {};
  state.db.TIMESHEETS.forEach((t) => {
    by[t.userId] = by[t.userId] || {};
    by[t.userId][t.projectId] = (by[t.userId][t.projectId] || 0) + t.hours;
  });
  const cost = can('budget', 'r', role());
  return (
    <>
    <SecHead title="Timesheets, this week" sub="Hours logged per person and project, with utilisation." />
    <Card>
      <DataTable
        cols={['Person', ...state.db.PROJECTS.map((p) => p.name.split(' ')[0]), 'Total', 'Utilisation', ...(cost ? ['₹Cost'] : [])]}
        rows={Object.entries(by).map(([u, ps]) => {
          const tot = Object.values(ps).reduce((a, b) => a + b, 0);
          return [
            name(u),
            ...state.db.PROJECTS.map((p) => ps[p.id] || ''),
            <b>{tot}</b>,
            Math.round((tot / 16) * 100) + '%',
            ...(cost ? [inr(tot * (HOURLY[user(u).role] || 0))] : []),
          ];
        })}
      />
      <p className="mb-0 mt-2 text-[13px] text-ink-3">Utilisation is hours logged against 8 h a day for the two days shown.</p>
    </Card>
    </>
  );
}

function Salary({ q }) {
  const copy = () => {
    const rows = svc.salary().map(svc.salaryFor.bind(svc));
    const tsv = ['Person\tBase\tPresent\tHalf\tLate\tDeductions\tGross\tPF\tNet', ...rows.map((s) => [name(s.userId), s.base, s.presentDays, s.halfDays, s.lateMarks, Math.round(s.halfDed + s.lateDed + s.leaveDed), Math.round(s.gross), s.pf, Math.round(s.net)].join('\t'))].join('\n');
    navigator.clipboard?.writeText(tsv);
    toast('Copied for Tally.');
  };
  const calc = svc.salary().map(svc.salaryFor.bind(svc));
  const net = calc.reduce((n, x) => n + x.net, 0);
  const ded = calc.reduce((n, x) => n + x.halfDed + x.lateDed + x.leaveDed, 0);
  return (
    <>
      <SecHead title="Salary" sub="Calculation only. No payments are made from here.">
        <Input type="month" value={q.month || TODAY.slice(0, 7)} onChange={(e) => go(`#/people?tab=salary&month=${encodeURIComponent(e.target.value)}`)} aria-label="Month" />
        <Btn kind="primary" onClick={copy}>Copy for Tally</Btn>
      </SecHead>
      <div className="mb-3.5 grid grid-cols-2 gap-gap lg:grid-cols-3">
        <Stat label="People on payroll" value={calc.length} sub="this month" />
        <Stat label="Total net" value={inr(Math.round(net))} sub="after deductions and PF" />
        <Stat label="Deductions" value={inr(Math.round(ded))} sub="half days, late marks, unpaid leave" tone={ded ? 'text-warn' : ''} />
      </div>
    <Card>
      <DataTable
        cols={['Person', '₹Base', 'Present', 'Half', 'Late', '₹Deductions', '₹Gross', '₹PF', '₹Net']}
        rows={svc.salary().map(svc.salaryFor.bind(svc)).map((s) => [
          name(s.userId), inr(s.base), s.presentDays, s.halfDays, s.lateMarks,
          inr(Math.round(s.halfDed + s.lateDed + s.leaveDed)), inr(Math.round(s.gross)), inr(s.pf),
          <b>{inr(Math.round(s.net))}</b>,
        ])}
      />
      <p className="mb-0 mt-2 text-[13px] text-ink-3">Three late marks count as one half day. Read only here; payroll runs outside.</p>
    </Card>
    </>
  );
}

// Mutates state directly (no dedicated svc.* yet for this step) — same minimal pattern as
// toggleChecklistItem/finishAsk: the permission check lives in the handler itself, not just
// the button's visibility, so it still holds if this is ever called from somewhere else.
function markExpensePaid(id) {
  if (state.role !== 'hr') return;
  const e = state.db.EXPENSES.find((x) => x.id === id);
  if (!e || e.status !== 'approved') return;
  e.status = 'paid';
  persist();
  toast('Marked paid.');
  render();
}
function Expenses() {
  const claim = (e) => {
    e.preventDefault();
    const p = Object.fromEntries(new FormData(e.currentTarget));
    state.db.EXPENSES.unshift({
      id: uid(), userId: state.userId, projectId: p.projectId, kind: p.kind, amount: +p.amount,
      date: TODAY, status: 'pending', note: p.note,
    });
    persist();
    toast('Claim sent to HR.');
  };
  const claims = state.db.EXPENSES.filter((e) => can('salary', 'r') || e.userId === state.userId);
  const sum = (st) => claims.filter((e) => e.status === st).reduce((n, e) => n + e.amount, 0);
  return (
    <>
      <SecHead title="Expense claims" sub="Raise a claim, then partners approve and HR marks it paid." />
      <div className="mb-3.5 grid grid-cols-2 gap-gap lg:grid-cols-4">
        <Stat label="Pending" value={inr(sum('pending'))} sub={`${claims.filter((e) => e.status === 'pending').length} claims`} tone={sum('pending') ? 'text-warn' : ''} />
        <Stat label="Approved" value={inr(sum('approved'))} sub="to be paid" />
        <Stat label="Paid" value={inr(sum('paid'))} sub="settled" tone="text-ok" />
        <Stat label="All claims" value={claims.length} sub="in this list" />
      </div>
      <Card title="New claim" className="mb-3.5">
        <form onSubmit={claim} className="flex flex-wrap items-center gap-2">
          <Select name="projectId" aria-label="Project">{svc.projects().map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
          <Select name="kind" aria-label="Kind"><option>Travel</option><option>Samples</option><option>Printing</option><option>Site</option></Select>
          <Input name="amount" type="number" min="1" placeholder="₹" required className="w-[90px]" aria-label="Amount" />
          <Input name="note" placeholder="What for" />
          <Btn kind="primary" type="submit">Claim</Btn>
        </form>
      </Card>
    <Card>
      <DataTable
        cols={['Date', 'Person', 'Project', 'Kind', '₹Amount', 'Paid from', 'Note', 'AI read', 'Status', '']}
        rows={claims.map((e) => [
          fmtD(e.date), name(e.userId), P(e.projectId).name.split(' ')[0], e.kind, inr(e.amount),
          e.paidBy === 'cash' ? 'Site cash' : 'Own pocket', e.note,
          <span>
            {e.ai && <><Pill>AI read</Pill> {V(e.vendorId).name}{e.gst ? `, GST ${inr(e.gst)}` : ''} </>}
            {e.msgId ? <FromChat msgId={e.msgId}>View bill</FromChat> : <Muted>No bill yet</Muted>}
          </span>,
          <StatusPill status={e.status} />,
          e.status === 'pending' && state.role === 'partner' ? (
            <div className="flex gap-2">
              <Btn sm kind="primary" onClick={() => { svc.decideExpense(e.id, 'approved'); toast('Approved.'); render(); }}>Approve</Btn>
              <Btn sm onClick={() => { svc.decideExpense(e.id, 'rejected'); toast('Rejected.'); render(); }}>Reject</Btn>
            </div>
          ) : e.status === 'approved' && state.role === 'hr' ? (
            <Btn sm onClick={() => markExpensePaid(e.id)}>Mark paid</Btn>
          ) : '',
        ])}
      />
    </Card>
    </>
  );
}

function Points() {
  const pct = Math.round(TEAM_GOAL.progress * 100);
  const target = Math.round(TEAM_GOAL.target * 100);
  const daysLeft = Math.max(0, Math.round((new Date(TEAM_GOAL.ends) - new Date(TODAY)) / 864e5));
  const u = me();
  const board = svc.people().filter((x) => x.pts && !x.ptsOptOut).sort((x, y) => y.pts - x.pts);
  const top = board.slice(0, 3);
  const toggle = (key, msg) => { u[key] = !u[key]; persist(); toast(msg(u[key])); render(); };
  return (
    <>
      <SecHead title="Points and badges" sub="The team goal comes first. Individual points are a friendly extra." />
      <Card className="mb-3.5">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.1em] text-accent-text">Team goal</p>
          <span className="text-[13px] text-ink-3">{daysLeft} days left · ends {fmtD(TEAM_GOAL.ends)}</span>
        </div>
        <h3 className="m-0 mb-3 text-xl font-semibold">{TEAM_GOAL.name}</h3>
        <Bar value={Math.round((pct / target) * 100)} />
        <p className="mb-0 mt-2 text-[13px] text-ink-3"><b className="text-ink">{pct}%</b> reached · target {target}%</p>
      </Card>
      <div className="mb-3.5 grid gap-gap md:grid-cols-3">
        {top.map((x, i) => (
          <div key={x.id} className="rounded-r3 border border-line bg-surface px-4 py-3.5">
            <div className="flex items-center gap-3">
              <span className={`grid h-9 w-9 flex-none place-items-center rounded-full text-sm font-semibold ${i === 0 ? 'bg-accent text-accent-ink' : 'bg-accent-soft text-accent-text'}`}>{i + 1}</span>
              <span className="min-w-0"><b className="block truncate">{x.name}</b><small className="text-ink-3">{x.streak ? `${x.streak} day streak` : 'No streak yet'}</small></span>
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-accent-text">{x.pts.toLocaleString('en-IN')} <span className="text-sm font-normal text-ink-3">points</span></div>
          </div>
        ))}
        {top.length === 0 && <div className="md:col-span-3"><Empty>No one is on the leaderboard yet.</Empty></div>}
      </div>
      <div className="mb-3.5 grid gap-3 md:grid-cols-2">
        <Switch on={!!u.ptsOptOut} onClick={() => toggle('ptsOptOut', (v) => (v ? 'You are hidden from the leaderboard.' : 'You are back on the leaderboard.'))} label="Opt out of the leaderboard" sub="Your points stay private. You still count toward the team goal." />
        <Switch on={!!u.quiet} onClick={() => toggle('quiet', (v) => (v ? 'Quiet mode on. No point or badge alerts.' : 'Quiet mode off.'))} label="Quiet mode" sub="Stop point and badge notifications." />
      </div>
      <Grid2>
        <Card title="Leaderboard">
          <DataTable cols={['Person', 'Points', 'Streak']} rows={board.map((x) => [x.name, x.pts, x.streak ? x.streak + ' days' : ''])} />
        </Card>
        <Card title="Badges">
          {state.db.BADGES.map((x) => (
            <div key={x.id || x.name} className="border-t border-line py-2.5 first:border-t-0 first:pt-0">
              <div className="flex items-baseline justify-between gap-3"><b>{x.icon} {x.name}</b><small className="text-ink-3">{x.earnedBy.map(first).join(', ') || 'Not earned yet'}</small></div>
              <small className="text-ink-3">{x.desc}</small>
            </div>
          ))}
        </Card>
      </Grid2>
    </>
  );
}

function Reviews() {
  const partner = can('review', 'a');
  const rows = svc.reviews(partner ? undefined : state.userId);
  const avg = svc.teamAverage(TODAY.slice(0, 7));
  const saveNote = (e, id) => {
    e.preventDefault();
    const text = (Object.fromEntries(new FormData(e.currentTarget)).note || '').trim();
    if (!text) return;
    svc.reviewNote(id, text);
    render();
  };
  return (
    <>
      <SecHead title="Reviews" sub="Each review has 3 strengths, 1 growth point, a score from 1 to 5 and a written reason. Scores stay private between you and the partners.">
        {partner && <Btn kind="primary" onClick={() => openDialog({ kind: 'review', userId: '' })}>Add review</Btn>}
      </SecHead>
      <div className="mb-3.5 grid grid-cols-2 gap-gap lg:grid-cols-3">
        <Stat label="Team average" value={avg == null ? '—' : avg} sub="this month, out of 5" />
        <Stat label="Reviews" value={rows.length} sub={partner ? 'across the team' : 'about you'} />
        <Stat label="Scale" value="1 to 5" sub="reason required for every score" />
      </div>
      <Card>
      <List empty="No reviews yet.">
        {rows.map((r) => (
          <Item key={r.id}>
            <span className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><b>{partner ? name(r.userId) + ' · ' : ''}{r.month}</b> <Pill kind={r.score >= 4 ? 'ok' : r.score >= 3 ? 'soft' : 'warn'}>Score {r.score}/5</Pill></div>
              <div className="mt-1 text-[13px] text-ink-2"><b className="font-semibold text-ink">Strengths</b> {r.strengths.join(', ')} · <b className="font-semibold text-ink">Growth</b> {r.growth}</div>
              <div className="mt-0.5 text-[13px] text-ink-3">{r.reason}</div>
              {r.note && <div className="mt-0.5 text-[13px] italic text-ink-3">Note: {r.note}</div>}
            </span>
            {partner ? (
              <Btn sm onClick={() => openDialog({ kind: 'review', userId: r.userId })}>Replace</Btn>
            ) : !r.note ? (
              <form onSubmit={(e) => saveNote(e, r.id)} className="flex items-center gap-2">
                <Input name="note" placeholder="Add your note" required />
                <Btn sm type="submit">Save</Btn>
              </form>
            ) : null}
          </Item>
        ))}
      </List>
      </Card>
    </>
  );
}

const Contacts = () => {
  const list = state.db.CONTACTS || [];
  return (
    <>
      <SecHead title="Contacts" sub="Pick contacts from your phone list. We guess which client or vendor each one is.">
        <Btn kind="primary" onClick={() => openDialog({ kind: 'import-contacts' })}>Pick from phone list</Btn>
      </SecHead>
      <Card>
        {list.length === 0 ? (
          <Empty><b className="block text-ink">No contacts yet</b><span className="text-[13px]">Use Pick from phone list to bring in the people you work with.</span></Empty>
        ) : <DataTable cols={['Name', 'Phone', 'Guessed match']} rows={list.map((c) => [c.name, c.phone, c.guess || '—'])} />}
      </Card>
    </>
  );
};

function Audit() {
  const [kind, setKind] = useState('');
  const [text, setText] = useState('');
  const all = svc.audit();
  const typeOf = (a) => String(a.entity || '').split(' ')[0] || 'Other';
  const kinds = [...new Set(all.map(typeOf))];
  const rows = all.filter((a) => (!kind || typeOf(a) === kind) && (!text || `${a.what} ${a.entity} ${a.by}`.toLowerCase().includes(text.toLowerCase()))).slice(0, 60);
  const days = [...new Set(rows.map((a) => String(a.at).slice(0, 10)))];
  const who = new Set(all.map((a) => a.by)).size;
  return (
    <>
      <SecHead title="Audit trail" sub="Every change to money, approvals, leave and people, newest first." />
      <div className="mb-3.5 grid grid-cols-2 gap-gap lg:grid-cols-4">
        <Stat label="Changes logged" value={all.length} sub="all time" />
        <Stat label="Today" value={all.filter((a) => String(a.at).slice(0, 10) === TODAY).length} sub="changes" />
        <Stat label="People involved" value={who} sub="made changes" />
        <Stat label="Record types" value={kinds.length} sub={kinds.slice(0, 3).join(', ')} />
      </div>
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search changes" aria-label="Search audit trail" className="min-w-[200px] flex-1" />
          <ToggleChip on={!kind} onClick={() => setKind('')}>All</ToggleChip>
          {kinds.map((k) => <ToggleChip key={k} on={kind === k} onClick={() => setKind(k)}>{k}</ToggleChip>)}
        </div>
        {rows.length === 0 && <Empty>No changes match.</Empty>}
        {days.map((day) => (
          <section key={day} className="mb-4 last:mb-0">
            <h3 className="mb-1 mt-0 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.1em] text-accent-text">{fmtD(day)}{day === TODAY ? ' · Today' : ''}<i className="h-px flex-1 bg-line" /></h3>
            {rows.filter((a) => String(a.at).slice(0, 10) === day).map((a, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
                <Avatar accent sm>{first(a.by).slice(0, 1)}</Avatar>
                <span className="min-w-0 flex-1"><b className="block">{a.what}</b><small className="text-ink-3">{first(a.by)} · {fmtDT(a.at).split(' · ')[1] || fmtDT(a.at)}</small></span>
                <Pill>{a.entity}</Pill>
              </div>
            ))}
          </section>
        ))}
      </Card>
    </>
  );
}

export default function People({ q }) {
  const tab = q.tab || 'directory';
  const list = [
    ['directory', 'Directory'], ['leaves', 'Leaves'], ['attendance', 'Attendance'], ['load', 'Load'], ['timesheets', 'Timesheets'],
    ...(can('salary', 'r') ? [['salary', 'Salary']] : []),
    ['expenses', 'Expense claims'], ['points', 'Points and badges'], ['reviews', 'Reviews'], ['contacts', 'Contacts'], ['folders', 'Folders'],
    ...(can('audit', 'r') ? [['audit', 'Audit trail']] : []),
  ];
  const T = {
    directory: <Directory />,
    leaves: <Leaves />,
    attendance: <Attendance q={q} />,
    load: <Load />,
    timesheets: <Timesheets />,
    salary: <Salary q={q} />,
    expenses: <Expenses />,
    points: <Points />,
    reviews: <Reviews />,
    contacts: <Contacts />,
    folders: (
      <>
        <SecHead title="Folders" sub={`Personal work in progress on the NAS. ${role() === 'partner' ? 'Partners see every folder.' : 'Only you and the partners see yours.'} The app never writes here.`} />
        <Folders path={q.path || 'Employees'} scope="Employees" />
      </>
    ),
    audit: <Audit />,
  };
  const people = svc.people();
  const att = state.db.ATTENDANCE_TODAY;
  const inToday = att.filter((x) => x.in && x.mark !== 'leave').length;
  const onLeave = att.filter((x) => x.mark === 'leave').length;
  const pending = state.db.ORG_LEAVE_REQUESTS.filter((r) => r.status === 'pending').length;
  return (
    <>
      <PageHeader title="People" sub="Your team, attendance, leave, workload and pay." />
      <div className="mb-5 grid grid-cols-2 gap-gap lg:grid-cols-4">
        <Stat label="Team" value={people.length} sub="people" />
        <Stat label="In today" value={inToday} sub={`of ${people.length}`} tone="text-ok" />
        <Stat label="On leave" value={onLeave} sub="away today" />
        <Stat label="Leave requests" value={pending} sub={pending ? 'waiting for a decision' : 'all clear'} tone={pending ? 'text-warn' : 'text-ok'} />
      </div>
      <Tabs base={tabBase('people')} list={list} current={list.some(([k]) => k === tab) ? tab : 'directory'} />
      {T[tab] || T.directory}
    </>
  );
}
