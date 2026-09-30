import { useEffect, useState } from 'react';
import { state, svc, can, inr, fmtD, fmtDT, go, persist, render, toast, uid } from '../../shared/core.js';
import { TEAM_GOAL, TODAY } from '../../shared/data.js';
import { HOURLY } from '../../shared/data2.js';
import { user } from '../../shared/core.js';
import { Bar, Btn, Card, DataTable, Grid2, Input, List, Item, PageHeader, Pill, Select, StatusPill, Tabs } from '../../ui/ui';
import { FromChat } from '../parts';
import { P, V, first, name, role } from '../helpers';
import { openDialog } from '../session';
import { H2, Muted, SubText, tabBase } from './common';
import { LoadGrid } from './Schedule';
import Folders from './Folders';
import {
  applyForLeave, approveLeaveRequest, cancelLeaveRequest, getLeaveBalance,
  listLeaveRequests, listLeaveTypes, rejectLeaveRequest,
} from '../../api/leaveClient';
import { getSession } from '../../auth/authClient';

const Directory = () => (
  <Card title="Directory">
    <DataTable
      cols={['Person', 'Title', 'Phone', 'Skills', 'Projects', 'Today']}
      rows={svc.people().map((u) => {
        const a = state.db.ATTENDANCE_TODAY.find((x) => x.userId === u.id) || {};
        const tel = (state.db.VENDORS.find((v) => v.userId === u.id) || {}).phone || u.phone
          || `+91 98${String(u.id).replace(/\D/g, '').padStart(3, '0')}0 00000`;
        return [
          <b>{u.name}</b>,
          u.title || u.role,
          <a href={`tel:${tel.replace(/\s/g, '')}`} className="text-accent-text underline">{tel}</a>,
          (u.skills || []).join(', '),
          state.db.PROJECTS.filter((p) => p.teamIds.includes(u.id)).map((p) => p.name.split(' ')[0]).join(', '),
          a.in ? <StatusPill status={'in ' + a.in} /> : <StatusPill status={a.mark || 'not in'} />,
        ];
      })}
    />
  </Card>
);

const Load = () => (
  <Card title="Load, next 4 weeks">
    <SubText>Hours per person per project. Over 40 is red, under 24 is grey. Reassign a week&apos;s load to someone else.</SubText>
    <LoadGrid reassign />
  </Card>
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
  useEffect(load, [approver, status, typeId, from, to]);

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
  const decide = (id, ok) => (ok ? approveLeaveRequest(id) : rejectLeaveRequest(id))
    .then(() => { toast(ok ? 'Leave approved.' : 'Leave rejected.'); load(); })
    .catch((e) => toast(e.message));

  const shownRequests = employeeQuery.trim()
    ? requests.filter((r) => `${r.employee?.name || ''} ${r.employee?.email || ''}`.toLowerCase().includes(employeeQuery.trim().toLowerCase()))
    : requests;

  return (
    <Card>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-lg font-semibold">Leave requests</h2>
        {can('leave', 'w') && types.length > 0 && (
          <form onSubmit={apply} className="flex flex-wrap items-center gap-2">
            <Select name="leaveTypeId" value={typeId || selectedType?.id} onChange={(e) => setTypeId(e.target.value)} aria-label="Leave type">
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}{t.paid ? '' : ' (unpaid)'}</option>)}
            </Select>
            <Input type="date" name="startDate" aria-label="From" required />
            <Input type="date" name="endDate" aria-label="To" required />
            {selectedType?.allowHalfDay && (
              <label className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" name="halfDay" /> Half day</label>
            )}
            <Input name="reason" placeholder="Reason" />
            <Btn type="submit">Request</Btn>
          </form>
        )}
      </div>
      {error && <p className="mb-2.5 text-crit">{error}</p>}
      {approver && (
        <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
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
                <Btn sm onClick={() => decide(l.id, false)}>Reject</Btn>
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
      <H2>My balance</H2>
      <DataTable
        cols={['Type', 'Allocated', 'Used', 'Pending', 'Remaining']}
        rows={balances.map((b) => [b.leaveType?.name || '—', b.allocated, b.used, b.pending, b.remaining])}
      />
    </Card>
  );
}

function Attendance({ q }) {
  const mine = state.db.ATTENDANCE_TODAY.find((a) => a.userId === state.userId);
  const away = svc.away(TODAY);
  const pu = q.punchUser || state.userId;
  const pm = q.punchMonth || TODAY.slice(0, 7);
  const p = svc.punches(pu, pm);
  const filter = (user_, month) => go(`#/people?tab=attendance&punchUser=${encodeURIComponent(user_ || state.userId)}&punchMonth=${encodeURIComponent(month || TODAY.slice(0, 7))}`);
  return (
    <Card>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-lg font-semibold">Attendance today</h2>
        {mine && !mine.in ? (
          <Btn kind="primary" onClick={() => { const r = svc.checkIn(); toast(r.late ? `Checked in at ${r.t}, marked late.` : `Checked in at ${r.t}.`); }}>Check in</Btn>
        ) : mine && !mine.out ? (
          <Btn onClick={() => toast(`Checked out at ${svc.checkOut()}.`)}>Check out</Btn>
        ) : null}
      </div>
      <DataTable
        cols={['Person', 'In', 'Out', 'Mark', 'Note']}
        rows={svc.attendance().map((a) => [name(a.userId), a.in || '—', a.out || '—', <StatusPill status={a.mark} />, a.note || ''])}
      />
      {away.length > 0 && (
        <>
          <H2>Away today</H2>
          <ul className="m-0 list-disc pl-5">
            {away.map((x, i) => <li key={i}>{x.userId ? name(x.userId) : 'Unassigned'} · {x.why}</li>)}
          </ul>
        </>
      )}
      <H2>Punch history</H2>
      <div className="mb-2.5 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">Person
          <Select value={pu} onChange={(e) => filter(e.target.value, pm)}>
            {svc.people().map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </label>
        <label className="flex items-center gap-2">Month
          <Input type="month" value={pm} onChange={(e) => filter(pu, e.target.value)} />
        </label>
      </div>
      <DataTable
        cols={['Date', 'In', 'Out', 'Site', 'Late']}
        rows={p.rows.map((r) => [fmtD(r.date), r.in || '—', r.out || '—', r.site || '', r.late ? <StatusPill status="late" /> : ''])}
      />
      <p className="mt-2 text-ink-3">{p.days} day{p.days === 1 ? '' : 's'} · {p.late} late · {p.hours} h total</p>
    </Card>
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
    <Card title="Timesheets, this week">
      <DataTable
        cols={['Person', ...state.db.PROJECTS.map((p) => p.name.split(' ')[0]), 'Total', 'Utilisation', ...(cost ? ['₹Cost'] : [])]}
        rows={Object.entries(by).map(([u, ps]) => {
          const tot = Object.values(ps).reduce((a, b) => a + b, 0);
          return [
            name(u),
            ...state.db.PROJECTS.map((p) => ps[p.id] || ''),
            tot,
            Math.round((tot / 16) * 100) + '%',
            ...(cost ? [inr(tot * (HOURLY[user(u).role] || 0))] : []),
          ];
        })}
      />
      <p className="mt-2 text-ink-3">Utilisation is hours logged against 8 h a day for the two days shown.</p>
    </Card>
  );
}

function Salary({ q }) {
  const copy = () => {
    const rows = svc.salary().map(svc.salaryFor.bind(svc));
    const tsv = ['Person\tBase\tPresent\tHalf\tLate\tDeductions\tGross\tPF\tNet', ...rows.map((s) => [name(s.userId), s.base, s.presentDays, s.halfDays, s.lateMarks, Math.round(s.halfDed + s.lateDed + s.leaveDed), Math.round(s.gross), s.pf, Math.round(s.net)].join('\t'))].join('\n');
    navigator.clipboard?.writeText(tsv);
    toast('Copied for Tally.');
  };
  return (
    <Card>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-lg font-semibold">Salary</h2>
        <div className="flex gap-2">
          <Input type="month" value={q.month || TODAY.slice(0, 7)} onChange={(e) => go(`#/people?tab=salary&month=${encodeURIComponent(e.target.value)}`)} aria-label="Month" />
          <Btn onClick={copy}>Copy for Tally</Btn>
        </div>
      </div>
      <SubText>Calculation only. No payments are made from here.</SubText>
      <DataTable
        cols={['Person', '₹Base', 'Present', 'Half', 'Late', '₹Deductions', '₹Gross', '₹PF', '₹Net']}
        rows={svc.salary().map(svc.salaryFor.bind(svc)).map((s) => [
          name(s.userId), inr(s.base), s.presentDays, s.halfDays, s.lateMarks,
          inr(Math.round(s.halfDed + s.lateDed + s.leaveDed)), inr(Math.round(s.gross)), inr(s.pf),
          <b>{inr(Math.round(s.net))}</b>,
        ])}
      />
      <p className="mt-2 text-ink-3">Three late marks count as one half day. Read only here; payroll runs outside.</p>
    </Card>
  );
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
  return (
    <Card>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-lg font-semibold">Expense claims</h2>
        <form onSubmit={claim} className="flex flex-wrap items-center gap-2">
          <Select name="projectId" aria-label="Project">{svc.projects().map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
          <Select name="kind" aria-label="Kind"><option>Travel</option><option>Samples</option><option>Printing</option><option>Site</option></Select>
          <Input name="amount" type="number" min="1" placeholder="₹" required className="w-[90px]" aria-label="Amount" />
          <Input name="note" placeholder="What for" />
          <Btn type="submit">Claim</Btn>
        </form>
      </div>
      <DataTable
        cols={['Date', 'Person', 'Project', 'Kind', '₹Amount', 'Paid from', 'Note', 'AI read', 'Status', '']}
        rows={state.db.EXPENSES.filter((e) => can('salary', 'r') || e.userId === state.userId).map((e) => [
          fmtD(e.date), name(e.userId), P(e.projectId).name.split(' ')[0], e.kind, inr(e.amount),
          e.paidBy === 'cash' ? 'Site cash' : 'Own pocket', e.note,
          <span>
            {e.ai && <><Pill>AI read</Pill> {V(e.vendorId).name}{e.gst ? `, GST ${inr(e.gst)}` : ''} </>}
            {e.msgId ? <FromChat msgId={e.msgId}>View bill</FromChat> : <Muted>No bill yet</Muted>}
          </span>,
          <StatusPill status={e.status} />,
          e.status === 'pending' && (can('salary', 'r') || state.role === 'partner') ? (
            <div className="flex gap-2">
              <Btn sm kind="primary" onClick={() => { state.db.EXPENSES.find((x) => x.id === e.id).status = 'approved'; persist(); toast('Approved.'); }}>Approve</Btn>
              {state.role === 'partner' && <Btn sm onClick={() => { svc.decideExpense(e.id, 'rejected'); toast('Rejected.'); render(); }}>Reject</Btn>}
            </div>
          ) : e.status === 'approved' && state.role === 'hr' ? (
            <Btn sm onClick={() => { state.db.EXPENSES.find((x) => x.id === e.id).status = 'paid'; persist(); toast('Marked paid.'); }}>Mark paid</Btn>
          ) : '',
        ])}
      />
    </Card>
  );
}

function Points() {
  const pct = Math.round(TEAM_GOAL.progress * 100);
  return (
    <Card title="Team goal">
      <p className="mt-0"><b>{TEAM_GOAL.name}</b></p>
      <Bar value={pct} />
      <p className="text-ink-3">{pct}% of {Math.round(TEAM_GOAL.target * 100)}%</p>
      <Grid2>
        <div>
          <H2>Points</H2>
          <DataTable
            cols={['Person', 'Points', 'Streak']}
            rows={svc.people().filter((u) => u.pts).sort((a, b) => b.pts - a.pts).map((u) => [u.name, u.pts, u.streak ? u.streak + ' days' : ''])}
          />
        </div>
        <div>
          <H2>Badges</H2>
          <DataTable
            cols={['Badge', 'What it means', 'Earned by']}
            rows={state.db.BADGES.map((b) => [`${b.icon} ${b.name}`, b.desc, b.earnedBy.map(first).join(', ') || '—'])}
          />
        </div>
      </Grid2>
    </Card>
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
    <Card>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-lg font-semibold">Reviews</h2>
        {partner && <Btn kind="primary" onClick={() => openDialog({ kind: 'review', userId: '' })}>Add review</Btn>}
      </div>
      {!partner && (
        <>
          <SubText>Your reviews and the team average. Scores stay private between you and the partners.</SubText>
          <p><b>Team average, {avg == null ? '—' : avg}</b></p>
        </>
      )}
      <List empty="No reviews yet.">
        {rows.map((r) => (
          <Item key={r.id}>
            <span className="min-w-0 flex-1">
              <b>{partner ? name(r.userId) + ' · ' : ''}{r.month}</b> · Score {r.score}/5<br />
              <small>{r.strengths.join(', ')} · Growth: {r.growth}</small><br />
              <small className="text-ink-3">{r.reason}</small>
              {r.note && <><br /><small><i>Note: {r.note}</i></small></>}
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
  );
}

const Contacts = () => (
  <Card>
    <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
      <h2 className="m-0 text-lg font-semibold">Contacts</h2>
      <Btn kind="primary" onClick={() => openDialog({ kind: 'import-contacts' })}>Import from phone</Btn>
    </div>
    <DataTable cols={['Name', 'Phone', 'Guessed match']} rows={(state.db.CONTACTS || []).map((c) => [c.name, c.phone, c.guess || '—'])} />
  </Card>
);

const Audit = () => (
  <Card title="Audit trail">
    <DataTable
      cols={['When', 'Who', 'What', 'Record']}
      rows={svc.audit().slice(0, 40).map((a) => [fmtDT(a.at), first(a.by), a.what, <span className="font-mono text-[13px]">{a.entity}</span>])}
    />
  </Card>
);

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
        <SubText>Personal work in progress on the NAS. {role() === 'partner' ? 'Partners see every folder.' : 'Only you and the partners see yours.'} The app never writes here.</SubText>
        <Folders path={q.path || 'Employees'} scope="Employees" />
      </>
    ),
    audit: <Audit />,
  };
  return (
    <>
      <PageHeader title="People" />
      <Tabs base={tabBase('people')} list={list} current={list.some(([k]) => k === tab) ? tab : 'directory'} />
      {T[tab] || T.directory}
    </>
  );
}
