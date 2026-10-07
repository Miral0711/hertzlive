// "Your day" strip on the Today page: punch in/out, today's meetings, the user's next tasks, and
// the action-oriented additions (briefing, priorities, what's waiting on others, site activity,
// payment follow-ups, decisions waiting). Everything here reads svc/state.db directly — Today
// answers "what needs my attention today", never the studio-wide numbers Dashboard already owns.
import { state, svc, can, fmtD, fmtT, fmtDT, inr, render, toast } from '../../shared/core.js';
import { TODAY } from '../../shared/data.js';
import { Btn, Card, Pill, Item, ItemBody, List, Empty } from '../../ui/ui';
import { DLink, href } from '../nav';
import { P, name, first } from '../helpers';
import { projectUpdateOpen } from '../chat/site';

const hh = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`;
const dots = ['bg-accent', 'bg-secondary', 'bg-ok', 'bg-warn'];
const nowHours = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
// "Card with an item count badge on the right" header, used by the WaitingOnOthers and
// DecisionsWaiting cards below, built on Card so both share one way of composing this.
const cardHeader = (title, badge) => (
  <div className="flex items-baseline justify-between gap-3">
    <span className="text-lg font-semibold leading-snug">{title}</span>
    {badge}
  </div>
);

// Vertical timeline with a "now" rail — same data as before (svc.bookings(TODAY)), just a
// stronger visual read of what's next vs. already past.
export function ScheduleCard() {
  const rows = svc.bookings(TODAY).sort((a, b) => a.start - b.start);
  const now = nowHours();
  return (
    <Card title="Today's schedule">
      {rows.length === 0 ? <Empty compact>No meetings today.</Empty> : (
        <div className="relative flex flex-col">
          <div className="absolute bottom-2 left-[5px] top-2 w-px bg-line" aria-hidden="true" />
          {rows.map((b, i) => {
            const past = now >= b.end;
            const current = now >= b.start && now < b.end;
            return (
              <div key={b.id} className="relative flex gap-3 py-2 first:pt-0 last:pb-0">
                <span className={`relative z-[1] mt-1 h-2.5 w-2.5 flex-none rounded-full border-2 border-surface ${current ? 'bg-accent' : past ? 'bg-ink-3' : dots[i % dots.length]}`} />
                <div className={`min-w-0 flex-1 ${past && !current ? 'opacity-55' : ''}`}>
                  <div className="flex items-baseline gap-2">
                    <span className="flex-none text-[13px] font-semibold tabular-nums text-accent-text">{hh(b.start)}</span>
                    {current && <Pill kind="soft">Now</Pill>}
                  </div>
                  <b className="block truncate">{b.title}</b>
                  <small className="text-ink-3">{hh(b.start)}–{hh(b.end)}{b.by ? ` · ${first(b.by)}` : ''}</small>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <DLink to="#/schedule" className="mt-3 inline-block text-[13px] font-semibold text-accent-text no-underline hover:underline">Open schedule</DLink>
    </Card>
  );
}

export function TasksCard() {
  const rows = svc.tasks({ mine: true }).sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).slice(0, 4);
  return (
    <Card title="My next tasks">
      {rows.length === 0 ? <Empty compact>Nothing assigned to you.</Empty> : rows.map((t) => (
        <div key={t.id} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0">
          <span className="min-w-0 flex-1">
            <b className="block truncate">{t.title}</b>
            <small className="text-ink-3">{t.due ? `Due ${fmtD(t.due)}` : 'No due date'}</small>
          </span>
          {t.critical && <Pill kind="crit">Critical</Pill>}
        </div>
      ))}
    </Card>
  );
}

// A short, personal read of the day — composed entirely from real counts already computed
// elsewhere on Today (meetings, sites behind, critical tasks, decisions, payment follow-ups).
// No new data, just the day in one paragraph instead of five separate tiles.
export function TodayBriefing() {
  const meetings = svc.bookings(TODAY).length;
  const sitesBehind = svc.sites().filter((s) => {
    const p = P(s.projectId);
    if (!p?.start || !p?.handover) return false;
    const plan = Math.max(0, Math.min(100, Math.round((svc.workDays(p.start, TODAY) / svc.workDays(p.start, p.handover)) * 100)));
    return s.progress < plan - 10;
  }).length;
  const critical = svc.tasks({ mine: true }).filter((t) => t.critical).length;
  const decisions = svc.decisionsDue().length;
  const showMoney = can('budget', 'r');
  const overdue = showMoney ? state.db.INVOICES.filter((i) => i.status === 'overdue').reduce((a, i) => a + i.amount, 0) : 0;
  const clauses = [
    `${meetings} meeting${meetings === 1 ? '' : 's'} today`,
    sitesBehind > 0 && `${sitesBehind} site${sitesBehind === 1 ? ' is' : 's are'} behind plan`,
    critical > 0 && `${critical} critical task${critical === 1 ? '' : 's'} need${critical === 1 ? 's' : ''} attention`,
    overdue > 0 && `${inr(overdue)} is overdue for payment`,
    decisions > 0 && `${decisions} decision${decisions === 1 ? '' : 's'} waiting on a client`,
  ].filter(Boolean);
  return (
    <section className="mb-gap rounded-r3 border border-line bg-surface p-card">
      <p className="m-0 text-[15px] leading-relaxed text-ink-2">
        <b className="text-ink">{greetingWord()}, {first(state.userId)}.</b>{' '}
        {clauses.length ? clauses.join(' · ') + '.' : 'Nothing urgent on record — a good day to get ahead.'}
      </p>
    </section>
  );
}
const greetingWord = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

// Numbered, actionable, cross-cutting: the handful of things across tasks/issues/decisions that
// are overdue or due today — distinct from the role Home below (which is the full worklist) and
// from Dashboard (studio-wide numbers). Each row's action is a real svc write, not a mock toggle.
export function TodayPriorities() {
  const myTasks = svc.tasks({ mine: true }).filter((t) => t.critical || t.due <= TODAY);
  const dueIssues = svc.issues().filter((i) => i.due && i.due <= `${TODAY}T23:59`);
  const lateDecisions = svc.decisionsDue().filter((d) => d.late || d.due === TODAY);
  const rows = [
    ...myTasks.map((t) => ({ key: `t${t.id}`, text: t.title, sub: `${P(t.projectId)?.name || ''} · ${t.critical ? 'Critical' : `Due ${fmtD(t.due)}`}`, to: `#/tasks?person=${state.userId}&critical=${t.critical ? 1 : ''}` })),
    ...dueIssues.map((i) => ({ key: `i${i.id}`, text: i.title, sub: `${P(i.projectId)?.name || ''} · Site issue, ${i.sla || 'due'}`, to: `#/sites/${i.siteId}?tab=issues` })),
    ...lateDecisions.map((d) => ({ key: `d${d.id}`, text: d.title, sub: `${P(d.projectId)?.name || ''} · Waiting on client, due ${fmtD(d.due)}`, to: `#/projects/${d.projectId}?tab=changes`, decide: d.id })),
  ].slice(0, 5);
  return (
    <Card title="Today's priorities">
      {rows.length === 0 ? <Empty compact>Nothing overdue or due today. Nice.</Empty> : (
        <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
          {rows.map((row, i) => (
            <li key={row.key}>
              {/* A decision row gets an action button, not a link — the same tradeoff homes.jsx's
                  ListCard decisions already make (Item never combines a nav `to` with a nested
                  interactive child). Task/issue rows stay plain navigable rows. */}
              <Item to={row.decide ? undefined : href(row.to)}>
                <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-crit-soft text-xs font-semibold text-crit">{i + 1}</span>
                <ItemBody title={row.text} sub={row.sub} />
                {row.decide ? (
                  <Btn sm onClick={() => { svc.decideDecision(row.decide); toast('Marked decided.'); render(); }}>Mark decided</Btn>
                ) : (
                  <span className="flex-none text-[13px] font-semibold text-accent-text">View</span>
                )}
              </Item>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

// What this person is blocked on, not what they're behind on — real open RFIs (waiting on a
// consultant/site to answer) and unacknowledged transmittals, alongside client decisions.
export function WaitingOnOthers() {
  const mine = svc.myProjectIds();
  const decisions = svc.decisionsDue().slice(0, 3).map((d) => ({
    key: `d${d.id}`, who: 'Client', text: d.title, sub: `${P(d.projectId)?.name || ''} · due ${fmtD(d.due)}`, to: `#/projects/${d.projectId}?tab=changes`,
  }));
  const rfis = state.db.RFIS.filter((x) => x.status === 'open' && mine.includes(x.projectId)).slice(0, 3).map((x) => ({
    key: `r${x.id}`, who: 'Consultant', text: `${x.no} · ${x.title}`, sub: `${P(x.projectId)?.name || ''} · asked ${fmtD(x.at)}`, to: `#/projects/${x.projectId}?tab=changes`,
  }));
  const transmittals = state.db.TRANSMITTALS.filter((t) => mine.includes(t.projectId) && !t.ack).slice(0, 3).map((t) => ({
    key: `tr${t.id}`, who: 'Site team', text: `${t.no} ${t.rev} · not acknowledged`, sub: `${P(t.projectId)?.name || ''} · sent to ${name(t.to)}`, to: `#/projects/${t.projectId}?tab=changes`,
  }));
  const rows = [...decisions, ...rfis, ...transmittals];
  const WaitRow = (row) => (
    <Item key={row.key} to={href(row.to)}>
      <span className="w-20 flex-none text-[13px] font-semibold text-ink-2">{row.who}</span>
      <ItemBody title={row.text} sub={row.sub} />
    </Item>
  );
  return (
    <Card title={cardHeader('Waiting on others', <span className="text-[13px] font-normal text-ink-3">{rows.length} item{rows.length === 1 ? '' : 's'}</span>)}>
      <List empty="Nothing waiting on anyone else right now.">{rows.slice(0, 4).map(WaitRow)}</List>
      {rows.length > 4 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[13px] font-medium text-accent-text">Show {rows.length - 4} more</summary>
          <div className="mt-2 flex flex-col gap-1.5">{rows.slice(4).map(WaitRow)}</div>
        </details>
      )}
    </Card>
  );
}

// Real client decisions (svc.decisionsDue) as their own full queue — Today's Priorities above
// only surfaces the late/due-today ones; this is the complete open list.
export function DecisionsWaiting() {
  // Late ones first — the most important decisions, scannable without expanding.
  const rows = svc.decisionsDue().sort((a, b) => (b.late ? 1 : 0) - (a.late ? 1 : 0));
  const DecisionRow = (d) => (
    <Item key={d.id} to={href(`#/projects/${d.projectId}?tab=changes`)}>
      <ItemBody title={d.title} sub={`${P(d.projectId)?.name || ''} · waiting on client${d.late ? ' · overdue' : `, due ${fmtD(d.due)}`}`} />
      {d.late && <Pill kind="crit">Late</Pill>}
    </Item>
  );
  return (
    <Card title={cardHeader('Decisions waiting', <span className="text-[13px] font-normal text-ink-3">{rows.length} item{rows.length === 1 ? '' : 's'}</span>)}>
      <List empty="Nothing waiting on a client decision.">{rows.slice(0, 3).map(DecisionRow)}</List>
      {rows.length > 3 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[13px] font-medium text-accent-text">Show more</summary>
          <div className="mt-2 flex flex-col gap-1.5">{rows.slice(3).map(DecisionRow)}</div>
        </details>
      )}
    </Card>
  );
}

// Today's real site feed (svc.feed), trimmed to this person's sites and today's entries only.
// A feed entry's `.text` can run a full paragraph (voice-note transcripts, log entries) — Today
// only needs "who did what", not the whole note; the entry itself is one tap away via `to`.
const shortAction = (f) => {
  const text = (f.text || f.aiSummary || 'Update').trim();
  const cut = text.indexOf('. ');
  const head = cut > 0 && cut < 60 ? text.slice(0, cut) : text.slice(0, 60);
  return head.length < text.length ? `${head}…` : head;
};
export function SiteActivityToday() {
  const rows = svc.sites()
    .flatMap((s) => svc.feed(s.id).map((f) => ({ ...f, site: s })))
    .filter((f) => (f.at || '').startsWith(TODAY))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 3);
  return (
    <Card title="Site activity today">
      <List empty="No site activity logged yet today.">
        {rows.map((f, i) => (
          <Item key={f.id || i} to={href(`#/sites/${f.site.id}`)}>
            <ItemBody title={`${name(f.by)} · ${shortAction(f)}`} sub={`${f.site.name} · ${fmtT(f.at)}`} />
          </Item>
        ))}
      </List>
    </Card>
  );
}

// Overdue or past-due invoices needing a nudge — PartnerHome already lists these in "Money this
// week", so the Today page only renders this card for roles that don't already see that list.
export function PaymentFollowUps() {
  const rows = state.db.INVOICES.filter((i) => i.status === 'overdue' || (i.status === 'sent' && i.due < TODAY));
  return (
    <Card title="Payment follow-ups">
      <List empty="Nothing overdue right now.">
        {rows.map((i) => (
          <Item key={i.id}>
            <ItemBody title={`${P(i.projectId)?.name || ''} · ${i.no}`} sub={`${inr(i.amount)} · due ${fmtD(i.due)}`} />
            <Pill kind="crit">{i.status === 'overdue' ? 'Overdue' : 'Unpaid'}</Pill>
          </Item>
        ))}
      </List>
    </Card>
  );
}

// Lowest priority on the page by design — "what happened recently", after "what I need to do"
// and "what I'm waiting for". 3 compact lines by default; the full history (which already has
// its own "N earlier updates" drill-down) is one click away behind "View all", never open by
// default on Today.
export function RecentUpdates() {
  const updates = svc.projectUpdates();
  const Row = (u, compact) => (
    <Item key={u.id} onClick={() => projectUpdateOpen(u.id)}>
      <ItemBody title={u.title} sub={compact ? P(u.projectId)?.name : `${P(u.projectId)?.name || ''} · ${fmtDT(u.at)}`} />
    </Item>
  );
  return (
    // Same card-with-count-badge family as WaitingOnOthers/DecisionsWaiting above, but this one's
    // count has always read "Recent updates · N" inline in the heading rather than a separate
    // right-aligned badge - kept as-is here rather than forced through cardHeader().
    <Card title={<>Recent updates <span className="font-normal text-ink-3">· {updates.length}</span></>}>
      <List empty="No recorded changes available to you.">{updates.slice(0, 3).map((u) => Row(u, true))}</List>
      {updates.length > 3 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[13px] font-medium text-accent-text">View all {updates.length} updates →</summary>
          <div className="mt-2 flex flex-col gap-1.5">{updates.slice(3).map((u) => Row(u, false))}</div>
        </details>
      )}
    </Card>
  );
}

const soft = { background: 'color-mix(in srgb, var(--accent-ink) 14%, transparent)' };

// Top banner for staff roles: today's date, a few live counts and the punch in/out control.
export function TodayBanner({ role, attention }) {
  const mine = svc.attendance().find((a) => a.userId === state.userId);
  const d = new Date(`${TODAY}T00:00`);
  const meetings = svc.bookings(TODAY).length;
  const tasks = svc.tasks({ mine: true }).length;
  const now = new Date().toTimeString().slice(0, 5);
  const status = !mine ? 'No attendance record today'
    : !mine.in ? 'Not checked in yet'
      : mine.out ? `Checked out at ${mine.out}`
        : `Checked in at ${mine.in}${mine.mark === 'late' ? ' · late' : ''}`;
  const stats = [[attention.n, attention.label], [meetings, meetings === 1 ? 'Meeting today' : 'Meetings today'], [tasks, tasks === 1 ? 'Task for you' : 'Tasks for you']];
  return (
    <section className="mb-gap flex flex-wrap items-stretch justify-between gap-6 rounded-r3 bg-accent px-7 py-6 text-accent-ink shadow-s1">
      <div className="flex min-w-0 flex-col justify-between gap-5">
        <div>
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.12em] opacity-75">{d.toLocaleDateString('en-IN', { weekday: 'long' })} · {role}</p>
          <h1 className="m-0 mt-1 text-hero font-semibold leading-tight tracking-tight">{d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</h1>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {stats.map(([n, l]) => (
            <div key={l} className="min-w-[116px] rounded-r2 px-3.5 py-2" style={soft}>
              <b className="block text-xl font-semibold leading-tight">{n}</b>
              <span className="text-xs opacity-80">{l}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex min-w-[220px] flex-col justify-between gap-4 rounded-r2 px-5 py-4" style={soft}>
        <div>
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.12em] opacity-75">Attendance</p>
          <div className="mt-1 text-hero font-semibold leading-none tracking-tight">{now}</div>
          <p className="m-0 mt-1.5 text-[13px] opacity-85">{status}</p>
        </div>
        {mine && !mine.in && (
          <Btn kind="primary" className="!border-accent-ink !bg-accent-ink !text-accent" onClick={() => { const r = svc.checkIn(); toast(r.late ? `Checked in at ${r.t}, marked late.` : `Checked in at ${r.t}.`); render(); }}>Check in</Btn>
        )}
        {mine && mine.in && !mine.out && (
          <Btn onClick={() => { toast(`Checked out at ${svc.checkOut()}.`); render(); }}>Check out</Btn>
        )}
        {mine && mine.out && (
          <Btn className="!border-accent-ink !bg-accent-ink !text-accent" onClick={() => { const r = svc.checkIn(); toast(`Checked in again at ${r.t}.`); render(); }}>Check in again</Btn>
        )}
      </div>
    </section>
  );
}
