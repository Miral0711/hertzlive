// Dashboard page: KPI strip, cash chart, site progress, focus list, schedule, team workload,
// budget health and recent activity. Everything is read from svc/state, scoped by role.
import { useEffect } from 'react';
import { state, svc, can, fmtD, fmtDT, inr, render, toast, me } from '../../shared/core.js';
import { TODAY } from '../../shared/data.js';
import { Btn, Item, ItemBody, List, Input } from '../../ui/ui';
import { DLink, href } from '../nav';
import { P, first, role } from '../helpers';
import { formData } from '../session';
import { trackFill } from '../../ui/tones';

const ym = (d) => (d || '').slice(0, 7);
const monthsBack = (n) => {
  const [y, m] = TODAY.split('-').map(Number);
  return Array.from({ length: n }, (_, k) => {
    const d = new Date(y, m - 1 - (n - 1 - k), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
};
const cashRow = (mo) => ({
  mo,
  label: new Date(`${mo}-01`).toLocaleString('en-IN', { month: 'short' }),
  planned: state.db.INVOICES.filter((i) => ym(i.due) === mo).reduce((a, i) => a + i.amount, 0),
  got: state.db.INVOICES.filter((i) => i.paid && ym(i.paid) === mo).reduce((a, i) => a + i.amount, 0),
});
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
const hh = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`;
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const Stat = ({ label, value, sub, tone = '' }) => (
  <div className="rounded-r3 bg-surface px-4 py-3.5 shadow-s1">
    <div className="text-xs text-ink-3">{label}</div>
    <div className="mt-1 text-[26px] font-semibold leading-tight tracking-tight text-accent-text">{value}</div>
    <div className={`text-xs font-semibold ${tone || 'text-ink-3'}`}>{sub}</div>
  </div>
);

const SectionTitle = ({ children }) => (
  <h2 className="mb-2.5 mt-6 font-ui text-xs font-semibold uppercase tracking-[0.1em] text-accent-text">{children}</h2>
);

const Panel = ({ title, action, children, className = '' }) => (
  <section className={`h-full rounded-r3 bg-surface px-[18px] py-4 shadow-s1 ${className}`}>
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="m-0 text-[15px] font-semibold">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

function CashChart({ rows }) {
  const W = 560, H = 150, padX = 8, padTop = 12, padBottom = 4;
  const max = Math.max(1, ...rows.flatMap((r) => [r.planned, r.got]));
  const x = (i) => padX + (i * (W - padX * 2)) / Math.max(1, rows.length - 1);
  const y = (v) => padTop + (1 - v / max) * (H - padTop - padBottom);
  const line = (key) => rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(r[key]).toFixed(1)}`).join(' ');
  const area = `${line('got')} L${x(rows.length - 1)} ${H} L${x(0)} ${H} Z`;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[150px] w-full" role="img" aria-label="Cash received against invoices due, last 6 months">
        <defs>
          <linearGradient id="dash-cash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={padTop + f * (H - padTop - padBottom)} y2={padTop + f * (H - padTop - padBottom)} stroke="var(--line)" vectorEffect="non-scaling-stroke" />)}
        <path d={area} fill="url(#dash-cash)" />
        <path d={line('planned')} fill="none" stroke="var(--secondary)" strokeWidth="2" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
        <path d={line('got')} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-xs text-ink-3">{rows.map((r) => <span key={r.mo}>{r.label}</span>)}</div>
      <p className="mb-0 mt-2 text-xs text-ink-3">
        <i className="mr-1 inline-block h-2 w-2 rounded-full bg-accent" /> Received
        <i className="ml-3 mr-1 inline-block h-2 w-2 rounded-full bg-secondary" /> Due by invoice date
      </p>
    </>
  );
}

function Donut({ pct }) {
  const r = 46, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 120 120" className="mx-auto block h-[120px] w-[120px]" role="img" aria-label={`${pct}% of budget spent`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="14" />
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--accent)" strokeWidth="14" strokeLinecap="round"
        strokeDasharray={`${(Math.min(100, pct) / 100) * c} ${c}`} transform="rotate(-90 60 60)" />
      <text x="60" y="66" textAnchor="middle" fill="var(--ink)" fontSize="20" fontWeight="700">{pct}%</text>
    </svg>
  );
}

const Dot = ({ cls = 'bg-accent' }) => <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${cls}`} />;
const dotCls = ['bg-accent', 'bg-secondary', 'bg-ok', 'bg-warn'];

export default function Dashboard() {
  // Prototype refreshed the dashboard every 30 s while it was showing.
  useEffect(() => {
    const t = setInterval(() => render(), 30000);
    return () => clearInterval(t);
  }, []);
  const r = role();
  const u = me();
  const notes = svc.notifications();
  const checks = svc.checks();
  const sites = svc.sites();
  const projects = svc.projects();
  const active = projects.filter((p) => (p.status || 'active') === 'active');
  const onTrack = sites.filter(siteOnTrack).length;
  const showMoney = can('budget', 'r');
  const rows = monthsBack(6).map(cashRow);
  const now = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  const bookings = svc.bookings(TODAY).sort((a, b) => a.start - b.start);
  const budgeted = projects.filter((p) => p.budgetVisible && p.budget > 0);
  const budget = budgeted.reduce((a, p) => a + p.budget, 0);
  const spent = budgeted.reduce((a, p) => a + (p.actual || 0), 0);
  const pct = budget ? Math.round((spent / budget) * 100) : 0;
  const team = r === 'partner' ? svc.people().map((p) => ({ p, n: svc.load(p.id) })).sort((a, b) => b.n - a.n).slice(0, 4) : [];
  const teamMax = Math.max(1, ...team.map((t) => t.n));
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
        <Btn onClick={() => { render(); toast('Dashboard refreshed.'); }}>Refresh</Btn>
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat label="Active projects" value={active.length} sub={`${projects.length} in total`} />
        {showMoney
          ? <Stat label="Cash in this month" value={inr(now.got)} sub={`of ${inr(now.planned)} due`} tone={now.got < now.planned ? 'text-warn' : 'text-ok'} />
          : <Stat label="Open tasks" value={svc.tasks({ mine: true }).length} sub="assigned to you" />}
        <Stat label="Sites on track" value={`${onTrack} / ${sites.length}`} sub={`${sites.length - onTrack} behind plan`} tone={sites.length - onTrack ? 'text-crit' : 'text-ok'} />
        {can('enquiry', 'r')
          ? <Stat label="New enquiries" value={svc.myEnquiries().length} sub="awaiting review" />
          : <Stat label="Notifications" value={notes.length} sub="unread" />}
      </div>

      <SectionTitle>Overview</SectionTitle>
      <div className="mb-3.5 grid gap-3.5 lg:grid-cols-3 [&>*]:min-w-0">
        {showMoney && (
          <Panel className="lg:col-span-2" title="Cash in vs due" action={<span className="text-xs text-accent-text">Last 6 months{prev ? ` · ${inr(prev.got)} last month` : ''}</span>}>
            <CashChart rows={rows} />
          </Panel>
        )}
        {showMoney && budget > 0 && (
          <Panel title="Budget health">
            <Donut pct={pct} />
            <p className="mb-0 mt-2 text-center text-xs text-ink-3">{inr(spent)} of {inr(budget)} spent</p>
          </Panel>
        )}
        <Panel className={team.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'} title="Site progress" action={<DLink to="#/sites" className="text-xs text-accent-text no-underline hover:underline">View all</DLink>}>
          {sites.length === 0 && <p className="m-0 text-ink-3">No sites yet.</p>}
          {sites.map((s) => {
            const ok = siteOnTrack(s);
            return (
              <DLink key={s.id} to={`#/sites/${s.id}`} className="flex items-center gap-3 border-t border-line py-2.5 no-underline first:border-t-0" style={{ color: 'inherit' }}>
                <span className="w-44 min-w-0 flex-none">
                  <b className="block truncate">{s.name}</b>
                  <small className="text-ink-3">{s.stage || 'On site'}</small>
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <i className={`block h-full rounded-full ${trackFill(ok)}`} style={{ width: `${s.progress}%` }} />
                </span>
                <span className={`flex-none rounded-full px-2 text-xs font-semibold leading-6 ${ok ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'}`}>{ok ? 'On track' : 'Behind'}</span>
              </DLink>
            );
          })}
        </Panel>
        {team.length > 0 && (
          <Panel title="Team workload" action={<DLink to="#/tasks" className="text-xs text-accent-text no-underline hover:underline">All tasks</DLink>}>
            {team.map(({ p, n }) => (
              <div key={p.id} className="flex items-center gap-2.5 border-t border-line py-2 first:border-t-0">
                <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-secondary-soft text-[10px] font-semibold text-accent-text">{p.name.slice(0, 1)}</span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="h-1.5 w-20 flex-none overflow-hidden rounded-full bg-surface-2">
                  <i className={`block h-full rounded-full ${n / teamMax > 0.85 ? 'bg-crit' : 'bg-accent'}`} style={{ width: `${(n / teamMax) * 100}%` }} />
                </span>
                <small className="w-5 flex-none text-right text-ink-3">{n}</small>
              </div>
            ))}
          </Panel>
        )}
      </div>

      <SectionTitle>Your day</SectionTitle>
      <div className="mb-3.5 grid gap-3.5 lg:grid-cols-3 [&>*]:min-w-0">
        <Panel title="Today's schedule" action={<span className="text-xs text-accent-text">{fmtD(TODAY)}</span>}>
          {bookings.length === 0 && <p className="m-0 text-ink-3">No meetings today.</p>}
          {bookings.map((b, i) => (
            <div key={b.id} className="flex gap-2.5 py-1.5">
              <Dot cls={dotCls[i % dotCls.length]} />
              <div className="min-w-0">
                <b className="block">{hh(b.start)} {b.title}</b>
                <small className="text-ink-3">{hh(b.start)}–{hh(b.end)}{b.by ? ` · ${first(b.by)}` : ''}</small>
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
