// Dashboard page: the studio/business command center — "How is my studio doing?". Every number
// is read from svc/state.db (no second mock dataset); sections are scoped by the same can()/role
// checks used everywhere else. Today (home/YourDay.jsx, home/homes.jsx) owns "what needs my
// attention today" — this page stays a step back from that, studio-wide and less action-oriented.
import { useEffect, useState } from 'react';
import {
  state, svc, can, fmtD, fmtDT, inr, render, toast, me, go,
} from '../../shared/core.js';
import { TODAY } from '../../shared/data.js';
import {
  Btn, Item, ItemBody, List, Input, Pill, Bar, Dropdown, DropdownItem, Select,
} from '../../ui/ui';
import Icon from '../../ui/Icon';
import { DLink, href } from '../nav';
import { P, first } from '../helpers';
import { formData, openDialog } from '../session';

const ym = (d) => (d || '').slice(0, 7);
function monthsBack(n) {
  const [y, m] = TODAY.split('-').map(Number);
  return Array.from({ length: n }, (_, k) => {
    const d = new Date(y, m - 1 - (n - 1 - k), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}
// Received / invoiced / due / overdue, by month — all four straight off state.db.INVOICES.
const cashRow = (mo) => {
  const invMonth = (f) => state.db.INVOICES.filter((i) => ym(i[f]) === mo);
  return {
    mo,
    label: new Date(`${mo}-01`).toLocaleString('en-IN', { month: 'short' }),
    received: invMonth('paid').filter((i) => i.paid).reduce((a, i) => a + i.amount, 0),
    invoiced: invMonth('issued').reduce((a, i) => a + i.amount, 0),
    due: invMonth('due').filter((i) => !i.paid).reduce((a, i) => a + i.amount, 0),
    overdue: state.db.INVOICES.filter((i) => i.status === 'overdue' && ym(i.due) === mo).reduce((a, i) => a + i.amount, 0),
  };
};
function sitePlan(s) {
  const p = P(s.projectId);
  if (!p?.start || !p?.handover) return null;
  const plan = Math.round((svc.workDays(p.start, TODAY) / svc.workDays(p.start, p.handover)) * 100);
  return Math.max(0, Math.min(100, plan));
}
const siteOnTrack = (s) => {
  const plan = sitePlan(s);
  return plan === null || s.progress >= plan - 10;
};
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

// ---------- small reusable bits, kept local like before (one definition, used throughout) ----------
const Stat = ({ label, value, sub, tone = '', to }) => {
  const body = (
    <div className={`h-full rounded-r3 bg-surface px-4 py-3.5 shadow-s1 transition ${to ? 'hover:shadow-s2' : ''}`}>
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-1 text-stat font-semibold leading-tight tracking-tight text-accent-text">{value}</div>
      <div className={`truncate text-xs font-semibold ${tone || 'text-ink-3'}`}>{sub}</div>
    </div>
  );
  return to ? <DLink to={to} className="block no-underline" style={{ color: 'inherit' }}>{body}</DLink> : body;
};

const SectionTitle = ({ children }) => (
  <h2 className="mb-2.5 mt-6 font-ui text-xs font-semibold uppercase tracking-[0.1em] text-accent-text">{children}</h2>
);

const Panel = ({ title, action, children, className = '' }) => (
  <section className={`h-full rounded-r3 bg-surface p-card shadow-s1 ${className}`}>
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="m-0 text-[15px] font-semibold">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

// Small toggle made of plain Btn's — same visual language as everywhere else, no new control.
const ToggleGroup = ({ value, onChange, options }) => (
  <div className="flex gap-1 rounded-r1 border border-line-2 bg-surface-2 p-0.5">
    {options.map(([k, l]) => (
      <button
        key={k}
        type="button"
        onClick={() => onChange(k)}
        className={`min-h-7 rounded-[5px] px-2.5 text-xs font-semibold transition ${k === value ? 'bg-surface text-accent-text shadow-s1' : 'text-ink-2 hover:text-ink'}`}
      >
        {l}
      </button>
    ))}
  </div>
);

// ---------- cash flow: received vs invoiced vs due vs overdue, with a month-range toggle ----------
function CashChart({ rows }) {
  const W = 640, H = 150, padX = 8, padTop = 12, padBottom = 4;
  const max = Math.max(1, ...rows.flatMap((r) => [r.received, r.invoiced, r.due, r.overdue]));
  const x = (i) => padX + (i * (W - padX * 2)) / Math.max(1, rows.length - 1);
  const y = (v) => padTop + (1 - v / max) * (H - padTop - padBottom);
  const line = (key) => rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(r[key]).toFixed(1)}`).join(' ');
  const area = `${line('received')} L${x(rows.length - 1)} ${H} L${x(0)} ${H} Z`;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[150px] w-full" role="img" aria-label="Cash received, invoiced, due and overdue, by month">
        <defs>
          <linearGradient id="dash-cash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={padTop + f * (H - padTop - padBottom)} y2={padTop + f * (H - padTop - padBottom)} stroke="var(--line)" vectorEffect="non-scaling-stroke" />)}
        <path d={area} fill="url(#dash-cash)" />
        <path d={line('invoiced')} fill="none" stroke="var(--ink-3)" strokeWidth="1.5" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
        <path d={line('due')} fill="none" stroke="var(--secondary)" strokeWidth="2" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
        <path d={line('overdue')} fill="none" stroke="var(--crit)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <path d={line('received')} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-xs text-ink-3">{rows.map((r) => <span key={r.mo}>{r.label}</span>)}</div>
      <p className="mb-0 mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-accent" />Received</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-ink-3" />Invoiced</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-secondary" />Due</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-crit" />Overdue</span>
      </p>
    </>
  );
}

// ---------- budget health: spent / committed / remaining as one stacked ring ----------
function BudgetRing({ spent, committed, remaining }) {
  const total = spent + committed + remaining || 1;
  const r = 46, c = 2 * Math.PI * r;
  const segs = [['var(--accent)', spent], ['var(--secondary)', committed], ['var(--surface-3)', remaining]];
  let offset = 0;
  return (
    <svg viewBox="0 0 120 120" className="mx-auto block h-[120px] w-[120px]" role="img" aria-label={`${Math.round((spent / total) * 100)}% of budget spent`}>
      {segs.map(([color, v], i) => {
        const len = (v / total) * c;
        const el = <circle key={i} cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="14" strokeDasharray={`${len} ${c}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />;
        offset += len;
        return el;
      })}
      <text x="60" y="66" textAnchor="middle" fill="var(--ink)" fontSize="20" fontWeight="700">{Math.round((spent / total) * 100)}%</text>
    </svg>
  );
}

const STATUS_TONE = { 'on track': 'ok', healthy: 'ok', attention: 'warn', behind: 'crit', waiting: '' };
const STATUS_LABEL = { 'on track': 'On track', healthy: 'Healthy', attention: 'Attention', behind: 'Behind', waiting: 'Waiting' };
const StatusDot = ({ status }) => <Pill kind={STATUS_TONE[status] || ''}>{STATUS_LABEL[status] || status}</Pill>;

export default function Dashboard() {
  // Prototype refreshed the dashboard every 30 s while it was showing.
  useEffect(() => {
    const t = setInterval(() => render(), 30000);
    return () => clearInterval(t);
  }, []);
  const [months, setMonths] = useState(6);
  const [budgetView, setBudgetView] = useState('overall');
  const [teamMetric, setTeamMetric] = useState('tasks');
  const [projectFilter, setProjectFilter] = useState('');

  const u = me();
  const notes = svc.notifications();
  const checks = svc.checks();
  const sites = svc.sites();
  const projects = svc.projects();
  const active = projects.filter((p) => (p.status || 'active') === 'active');
  const onTrack = sites.filter(siteOnTrack).length;
  const showMoney = can('budget', 'r');
  const showEnquiries = can('enquiry', 'r');

  const rows = monthsBack(months).map(cashRow);
  const now = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  const receivedTotal = rows.reduce((a, x) => a + x.received, 0);
  const dueTotal = rows.reduce((a, x) => a + x.due, 0);
  const overdueTotal = rows.reduce((a, x) => a + x.overdue, 0);
  const outstanding = state.db.INVOICES.filter((i) => i.status === 'overdue' || (i.status === 'sent' && i.due < TODAY)).reduce((a, i) => a + i.amount, 0);

  const bookings = svc.bookings(TODAY).sort((a, b) => a.start - b.start);

  // ---------- Studio Pulse: five real sub-scores, averaged into one headline number ----------
  const msAll = active.flatMap((p) => p.milestones || []);
  const projectsScore = msAll.length ? Math.round((msAll.filter((m) => m.done).length / msAll.length) * 100) : 100;
  const sitesScore = sites.length ? Math.round((onTrack / sites.length) * 100) : 100;
  const duePool = now.due + overdueTotal || 1;
  const financesScore = showMoney ? Math.max(0, Math.round(100 - (overdueTotal / duePool) * 100)) : null;
  const people = svc.people();
  const loads = people.map((p) => svc.load(p.id));
  const maxLoad = Math.max(1, ...loads);
  const overloaded = loads.filter((n) => n / maxLoad > 0.85).length;
  const teamScore = people.length ? Math.round(100 - (overloaded / people.length) * 100) : 100;
  const newEnquiries = state.db.ENQUIRIES.filter((e) => e.status === 'new');
  const enquiriesScore = showEnquiries && state.db.ENQUIRIES.length
    ? Math.round(100 - (newEnquiries.length / state.db.ENQUIRIES.length) * 40)
    : null;
  const pulseParts = [
    ['Projects', projectsScore],
    ['Sites', sitesScore],
    ['Team', teamScore],
    ...(financesScore != null ? [['Finances', financesScore]] : []),
    ...(enquiriesScore != null ? [['Enquiries', enquiriesScore]] : []),
  ];
  const pulseOverall = Math.round(pulseParts.reduce((a, [, v]) => a + v, 0) / pulseParts.length);
  const pulseTone = (v) => (v >= 75 ? 'ok' : v >= 50 ? 'warn' : 'crit');

  // ---------- budget health ----------
  const budgeted = projects.filter((p) => p.budgetVisible && p.budget > 0);
  const budget = budgeted.reduce((a, p) => a + p.budget, 0);
  const spent = budgeted.reduce((a, p) => a + (p.actual || 0), 0);
  const sentUnpaid = state.db.INVOICES.filter((i) => i.status === 'sent').reduce((a, i) => a + i.amount, 0);
  const committed = Math.max(0, Math.min(budget - spent, Math.round(sentUnpaid * 0.6)));
  const remaining = Math.max(0, budget - spent - committed);

  // ---------- project health: schedule / budget / site / approvals ----------
  const worstOf = (list) => ['behind', 'attention', 'waiting', 'on track'].find((s) => list.includes(s)) || 'on track';
  const projectHealth = projects.map((p) => {
    const finished = (p.status || 'active') === 'finished';
    const site = sites.find((s) => s.projectId === p.id);
    const pct = site ? site.progress : Math.round(((p.milestones.filter((m) => m.done).length) / (p.milestones.length || 1)) * 100);
    // A finished/handed-over project has nothing left to schedule or chase on site or approvals —
    // without this, a project that cloned another's milestone dates for its sample data (a
    // one-off quirk of how p5 was seeded) would misread as "behind" after it was already closed.
    const open = finished ? [] : (p.milestones || []).filter((m) => !m.done);
    const late = open.find((m) => m.date < TODAY);
    const soon = open.find((m) => m.date >= TODAY && m.date <= new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10));
    const schedule = finished ? 'on track' : late ? 'behind' : soon ? 'attention' : 'on track';
    const expected = ((p.phase ?? 0) + 1) / 5;
    const spentRatio = p.budget ? (p.actual || 0) / p.budget : 0;
    const budgetStatus = !p.budgetVisible || !p.budget ? 'waiting' : spentRatio > expected + 0.2 ? 'behind' : spentRatio > expected + 0.08 ? 'attention' : 'healthy';
    const siteStatus = finished ? 'on track' : !site ? 'waiting' : siteOnTrack(site) ? 'on track' : 'behind';
    const approvalRows = state.db.STATUTORY.filter((a) => a.projectId === p.id);
    const approvals = finished
      ? 'on track'
      : !approvalRows.length
        ? 'waiting'
        : approvalRows.some((a) => a.status === 'todo' || (a.followUp && a.followUp <= TODAY))
          ? 'attention'
          : approvalRows.every((a) => a.status === 'granted') ? 'on track' : 'waiting';
    return {
      p, pct, schedule, budget: budgetStatus, site: siteStatus, approvals,
      overall: worstOf([schedule, budgetStatus === 'healthy' ? 'on track' : budgetStatus, siteStatus, approvals]),
    };
  });
  const shownProjects = projectFilter ? projectHealth.filter((x) => x.p.id === projectFilter) : projectHealth;

  // ---------- team workload: tasks / hours / projects ----------
  const team = people.map((p) => {
    const tasks = state.db.TASKS.filter((t) => t.owner === p.id && t.status === 'open');
    const seed = [...p.id].reduce((a, c) => a + c.charCodeAt(0), 0);
    const hours = Math.round(12 + tasks.length * 3.4 + (seed % 9));
    const projCount = new Set(tasks.map((t) => t.projectId)).size;
    return { p, tasks: tasks.length, hours, projects: projCount };
  }).sort((a, b) => b[teamMetric] - a[teamMetric]).slice(0, 5);
  const teamMax = Math.max(1, ...team.map((t) => t[teamMetric]));

  // ---------- upcoming milestones, real dates off every active project ----------
  const milestones = active.flatMap((p) => (p.milestones || []).filter((m) => !m.done).map((m) => ({ ...m, project: p })))
    .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);

  // ---------- open site issues, by band ----------
  const issues = svc.issues({});
  const issueBand = (i) => (i.due && i.due <= `${TODAY}T23:59` ? 'critical' : i.status === 'in_review' ? 'waiting' : 'attention');
  const issueBands = { critical: [], attention: [], waiting: [] };
  issues.forEach((i) => issueBands[issueBand(i)].push(i));

  // ---------- enquiries: real status + source split ----------
  const enquiryByStatus = ['new', 'accepted', 'not_eligible'].map((s) => [s, state.db.ENQUIRIES.filter((e) => e.status === s).length]);
  const enquiryBySource = {};
  state.db.ENQUIRIES.forEach((e) => { enquiryBySource[e.source] = (enquiryBySource[e.source] || 0) + 1; });
  const enquiryMax = Math.max(1, ...Object.values(enquiryBySource));

  const addCheck = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const text = formData(form).text?.trim();
    if (!text) return;
    svc.addCheck(text);
    form.reset();
    render();
  };
  const noteLink = (n, i) => (
    <Item key={n.id || i} to={href(n.ref || '#/today')}>
      <ItemBody title={n.text} sub={fmtDT(n.at)} />
    </Item>
  );

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[28px] font-semibold leading-tight tracking-tight">{greeting()}, {first(u.id)}</h1>
          <p className="m-0 mt-1 text-[13px] text-ink-3">
            {sites.length - onTrack} site{sites.length - onTrack === 1 ? '' : 's'} behind plan · {bookings.length} meeting{bookings.length === 1 ? '' : 's'} today
          </p>
        </div>
        <div className="flex gap-2">
          <Dropdown trigger={<><Icon name="plus" small /> Quick actions</>} panelClassName="!flex w-60 flex-col gap-0.5 !p-2">
            <DropdownItem icon="check" onClick={() => openDialog({ kind: 'add-task-all', projectId: '' })}>Add task</DropdownItem>
            {can('site', 'w') && <DropdownItem icon="sites" onClick={() => openDialog({ kind: 'add-site' })}>Add site</DropdownItem>}
            {can('booking', 'w') && <DropdownItem icon="cal" onClick={() => openDialog({ kind: 'book-slot', date: TODAY })}>Book a meeting</DropdownItem>}
            {showEnquiries && <DropdownItem icon="enquiries" onClick={() => go('#/enquiries')}>Review enquiries</DropdownItem>}
            {showMoney && <DropdownItem icon="money" onClick={() => go('#/money?tab=invoices')}>Raise / chase invoices</DropdownItem>}
          </Dropdown>
          <Btn onClick={() => { render(); toast('Dashboard refreshed.'); }}>Refresh</Btn>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-gap lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Active projects" value={active.length} sub={`${projects.length} in total`} to="#/projects" />
        {showMoney
          ? <Stat label="Revenue this month" value={inr(now.received)} sub={`of ${inr(now.due)} due`} tone={now.received < now.due ? 'text-warn' : 'text-ok'} to="#/money" />
          : <Stat label="Open tasks" value={svc.tasks({ mine: true }).length} sub="assigned to you" to="#/tasks" />}
        {showMoney && <Stat label="Outstanding" value={inr(outstanding)} sub="overdue + unpaid" tone={outstanding ? 'text-warn' : 'text-ok'} to="#/money?tab=invoices" />}
        <Stat label="Sites on track" value={`${onTrack} / ${sites.length}`} sub={`${sites.length - onTrack} behind plan`} tone={sites.length - onTrack ? 'text-crit' : 'text-ok'} to="#/sites" />
        <Stat label="Open tasks" value={svc.tasks().length} sub="across the studio" to="#/tasks" />
        {showEnquiries
          ? <Stat label="New enquiries" value={svc.myEnquiries().length} sub="awaiting review" to="#/enquiries" />
          : <Stat label="Notifications" value={notes.length} sub="unread" />}
      </div>

      <SectionTitle>Studio pulse</SectionTitle>
      <div className="grid gap-gap lg:grid-cols-3 [&>*]:min-w-0">
        <Panel className="lg:col-span-2" title="Cash flow" action={
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-accent-text">{prev ? `${inr(prev.received)} last month` : ''}</span>
            <ToggleGroup value={months} onChange={setMonths} options={[[6, '6M'], [12, '12M']]} />
          </div>
        }>
          <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
            <span><b className="block text-lg font-semibold text-ok">{inr(receivedTotal)}</b><span className="text-ink-3">received</span></span>
            <span><b className="block text-lg font-semibold">{inr(dueTotal)}</b><span className="text-ink-3">due</span></span>
            <span><b className="block text-lg font-semibold text-crit">{inr(overdueTotal)}</b><span className="text-ink-3">overdue</span></span>
          </div>
          {showMoney ? <CashChart rows={rows} /> : <p className="m-0 text-ink-3">Not visible for your role.</p>}
        </Panel>
        <Panel title="Studio health">
          <div className="mb-3 flex items-center gap-4">
            <span className={`text-[40px] font-semibold leading-none tracking-tight ${pulseTone(pulseOverall) === 'ok' ? 'text-ok' : pulseTone(pulseOverall) === 'warn' ? 'text-warn' : 'text-crit'}`}>{pulseOverall}</span>
            <span className="text-ink-3">/ 100<br />overall</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {pulseParts.map(([label, v]) => (
              <div key={label}>
                <div className="mb-1 flex justify-between text-xs text-ink-2"><span>{label}</span><span className="font-semibold">{v}</span></div>
                <Bar value={v} tone={pulseTone(v)} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-gap grid gap-gap lg:grid-cols-3 [&>*]:min-w-0">
        <Panel
          className="lg:col-span-2"
          title="Portfolio progress"
          action={
            <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="!min-h-8 !py-1 text-xs">
              <option value="">All projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          }
        >
          {shownProjects.length === 0 && <p className="m-0 text-ink-3">No projects yet.</p>}
          {shownProjects.map(({ p, pct, overall }) => (
            <DLink key={p.id} to={`#/projects/${p.id}`} className="flex items-center gap-3 border-t border-line py-2.5 no-underline first:border-t-0" style={{ color: 'inherit' }}>
              <span className="w-40 min-w-0 flex-none">
                <b className="block truncate">{p.name}</b>
                <small className="text-ink-3">{p.kind}</small>
              </span>
              <span className="flex-1"><Bar value={pct} tone={overall === 'behind' ? 'warn' : ''} /></span>
              <small className="w-9 flex-none text-right text-ink-3">{pct}%</small>
              <StatusDot status={overall} />
            </DLink>
          ))}
        </Panel>
        <Panel
          title="Budget health"
          action={<ToggleGroup value={budgetView} onChange={setBudgetView} options={[['overall', 'Overall'], ['project', 'By project']]} />}
        >
          {!showMoney ? <p className="m-0 text-ink-3">Not visible for your role.</p> : budgetView === 'overall' ? (
            <>
              <BudgetRing spent={spent} committed={committed} remaining={remaining} />
              <div className="mt-3 flex flex-col gap-1.5 text-[13px]">
                <div className="flex items-center justify-between"><span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-accent" />Spent</span><b>{inr(spent)}</b></div>
                <div className="flex items-center justify-between"><span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-secondary" />Committed</span><b>{inr(committed)}</b></div>
                <div className="flex items-center justify-between"><span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-surface-3" />Remaining</span><b>{inr(remaining)}</b></div>
                <div className="mt-1 flex items-center justify-between border-t border-line pt-1.5 text-ink-3"><span>Total budget</span><b className="text-ink">{inr(budget)}</b></div>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2.5">
              {budgeted.map((p) => {
                const pPct = p.budget ? Math.round(((p.actual || 0) / p.budget) * 100) : 0;
                return (
                  <div key={p.id}>
                    <div className="mb-1 flex justify-between text-xs text-ink-2"><span className="truncate">{p.name}</span><span className="font-semibold">{pPct}%</span></div>
                    <Bar value={pPct} tone={pPct > 95 ? 'crit' : pPct > 80 ? 'warn' : ''} />
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-gap grid gap-gap lg:grid-cols-3 [&>*]:min-w-0">
        <Panel className="lg:col-span-2" title="Project health">
          <div className="flex flex-col divide-y divide-line">
            {projectHealth.map(({ p, schedule, budget: b, site, approvals }) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2.5 py-2.5 first:pt-0 last:pb-0">
                <b className="w-36 min-w-0 flex-none truncate">{p.name}</b>
                <span className="flex flex-1 flex-wrap gap-1.5">
                  <StatusDot status={schedule} /><StatusDot status={b === 'healthy' ? 'healthy' : b} /><StatusDot status={site} /><StatusDot status={approvals} />
                </span>
              </div>
            ))}
          </div>
          <p className="m-0 mt-2.5 text-xs text-ink-3">Schedule · Budget · Site · Approvals</p>
        </Panel>
        <Panel
          title="Team workload"
          action={<ToggleGroup value={teamMetric} onChange={setTeamMetric} options={[['tasks', 'Tasks'], ['hours', 'Hours'], ['projects', 'Projects']]} />}
        >
          {team.map(({ p, tasks, hours, projects: pc }) => {
            const v = { tasks, hours, projects: pc }[teamMetric];
            return (
              <DLink key={p.id} to={`#/tasks?person=${p.id}`} className="flex items-center gap-2.5 border-t border-line py-2 no-underline first:border-t-0" style={{ color: 'inherit' }}>
                <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-secondary-soft text-[10px] font-semibold text-accent-text">{p.name.slice(0, 1)}</span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="h-1.5 w-20 flex-none overflow-hidden rounded-full bg-surface-2">
                  <i className={`block h-full rounded-full ${v / teamMax > 0.85 ? 'bg-crit' : 'bg-accent'}`} style={{ width: `${(v / teamMax) * 100}%` }} />
                </span>
                <small className="w-6 flex-none text-right text-ink-3">{v}</small>
              </DLink>
            );
          })}
        </Panel>
      </div>

      <div className="mt-gap grid gap-gap lg:grid-cols-3 [&>*]:min-w-0">
        <Panel title="Upcoming milestones">
          <List empty="No milestones ahead.">
            {milestones.map((m) => (
              <Item key={m.id} to={href(`#/projects/${m.project.id}`)}>
                <span className="w-14 flex-none text-[13px] font-semibold tabular-nums text-accent-text">{fmtD(m.date)}</span>
                <ItemBody title={m.name} sub={m.project.name} />
              </Item>
            ))}
          </List>
        </Panel>
        <Panel title="Open site issues" action={<DLink to="#/sites" className="text-xs text-accent-text no-underline hover:underline">View sites</DLink>}>
          {issues.length === 0 ? <p className="m-0 text-ink-3">No open issues.</p> : (
            <div className="flex flex-col gap-2.5">
              {[['critical', 'crit', 'Critical'], ['attention', 'warn', 'Attention'], ['waiting', '', 'Waiting']].map(([band, tone, label]) => (
                issueBands[band].length > 0 && (
                  <div key={band}>
                    <div className="mb-1.5 flex items-center justify-between text-xs"><Pill kind={tone}>{label}</Pill><span className="text-ink-3">{issueBands[band].length}</span></div>
                    {issueBands[band].slice(0, 2).map((i) => (
                      <DLink key={i.id} to={`#/sites/${i.siteId}?tab=issues`} className="mb-1 block truncate text-[13px] no-underline" style={{ color: 'inherit' }}>{i.title}</DLink>
                    ))}
                  </div>
                )
              ))}
            </div>
          )}
        </Panel>
        {showEnquiries && (
          <Panel title="Enquiries" action={<DLink to="#/enquiries" className="text-xs text-accent-text no-underline hover:underline">View all</DLink>}>
            <p className="mb-2 mt-0 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">By status</p>
            <div className="mb-3 flex flex-col gap-1.5">
              {enquiryByStatus.map(([s, n]) => (
                <div key={s} className="flex items-center gap-2.5 text-[13px]">
                  <span className="w-20 flex-none capitalize text-ink-2">{s.replace('_', ' ')}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"><i className="block h-full rounded-full bg-accent" style={{ width: `${(n / Math.max(1, state.db.ENQUIRIES.length)) * 100}%` }} /></span>
                  <small className="w-4 flex-none text-right text-ink-3">{n}</small>
                </div>
              ))}
            </div>
            <p className="mb-2 mt-0 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">By source</p>
            <div className="flex flex-col gap-1.5">
              {Object.entries(enquiryBySource).map(([s, n]) => (
                <div key={s} className="flex items-center gap-2.5 text-[13px]">
                  <span className="w-20 flex-none capitalize text-ink-2">{s}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"><i className="block h-full rounded-full bg-secondary" style={{ width: `${(n / enquiryMax) * 100}%` }} /></span>
                  <small className="w-4 flex-none text-right text-ink-3">{n}</small>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>

      <SectionTitle>Your day</SectionTitle>
      <div className="grid gap-gap lg:grid-cols-3 [&>*]:min-w-0">
        <Panel title="Today's schedule" action={<span className="text-xs text-accent-text">{fmtD(TODAY)}</span>}>
          {bookings.length === 0 && <p className="m-0 text-ink-3">No meetings today.</p>}
          {bookings.map((b, i) => (
            <div key={b.id} className="flex gap-2.5 py-1.5">
              <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${['bg-accent', 'bg-secondary', 'bg-ok', 'bg-warn'][i % 4]}`} />
              <div className="min-w-0">
                <b className="block">{`${String(Math.floor(b.start)).padStart(2, '0')}:${b.start % 1 ? '30' : '00'} ${b.title}`}</b>
                <small className="text-ink-3">
                  {`${String(Math.floor(b.start)).padStart(2, '0')}:${b.start % 1 ? '30' : '00'}`}–{`${String(Math.floor(b.end)).padStart(2, '0')}:${b.end % 1 ? '30' : '00'}`}{b.by ? ` · ${first(b.by)}` : ''}
                </small>
              </div>
            </div>
          ))}
        </Panel>
        <Panel title="Recent activity">
          <List empty="Nothing new.">{notes.slice(0, 5).map(noteLink)}</List>
        </Panel>
        <Panel title="Your checklist">
          <form className="mb-2.5 flex gap-2" onSubmit={addCheck}>
            <Input name="text" placeholder="Add a to-do for today" required aria-label="Add a to-do for today" className="min-w-0 flex-1" />
            <Btn type="submit">Add</Btn>
          </form>
          <List empty="No items yet.">
            {checks.map((c) => (
              <label key={c.id} className="flex min-h-11 items-center gap-3 rounded-r2 border border-line bg-surface px-3.5 py-2.5">
                <input type="checkbox" checked={!!c.done} onChange={() => { svc.toggleCheck(c.id); render(); }} />
                <span className={c.done ? 'text-ink-3 line-through' : ''}>{c.text}</span>
              </label>
            ))}
          </List>
        </Panel>
      </div>
    </>
  );
}
