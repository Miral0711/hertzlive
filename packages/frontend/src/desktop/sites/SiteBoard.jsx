import { state, svc, can, inr, fmtD, fmtT, fmtDT, toast, persist, render } from '../../shared/core.js';
import { TODAY } from '../../shared/data.js';
import { DAILYLOG } from '../data';
import { Btn, Card, DataTable, Empty, PageHeader, Bar, StatusPill, Pill } from '../../ui/ui';
import { DLink, href } from '../nav';
import Icon from '../../ui/Icon';
import { navFor, P, name, first, role, staff } from '../helpers';
import { SiteLink, ChatLink, FromChat, filedRows } from '../parts';
import { openDialog } from '../session';
import { AssistButton } from '../chat/assist';
import Ph from '../../ui/Ph';
import { IssueWorkspace, DeliveryWorkspace } from './Work';
import { trackFill } from '../../ui/tones';
import { SecHead } from '../studio/common';

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

const openIssues = (id) => svc.issues().filter((i) => i.siteId === id && i.status !== 'closed');

// Content only — the page section around it supplies the heading (SecHead), same convention as
// every other full-width section on this page (Checklists, Daily log, Snags, ...).
function SitesChart() {
  const rows = svc.sites().map((s) => ({ s, plan: sitePlan(s) }));
  if (!rows.length) return null;
  return (
    <Card>
      {rows.map(({ s, plan }) => (
        <div key={s.id} className="mb-2 grid grid-cols-[minmax(90px,1fr)_2fr_minmax(90px,1fr)] items-center gap-3">
          <span><SiteLink id={s.id}>{s.name}</SiteLink></span>
          <div className="relative h-2 rounded bg-surface-3">
            <i className={`block h-full rounded ${trackFill(siteOnTrack(s))}`} style={{ width: `${s.progress}%` }} />
            {plan !== null && <em title={`Plan ${plan}% by today`} className="absolute -top-1 h-4 w-0.5 bg-ink" style={{ left: `${plan}%` }} />}
          </div>
          <small className="text-ink-3">{s.progress}% done{plan === null ? '' : `, plan ${plan}%`}</small>
        </div>
      ))}
      <p className="m-0 text-ink-3">Plan is working days between project start and handover, site holidays from Settings skipped. Tick marks where the site should be today.</p>
    </Card>
  );
}


const Tile = ({ label, value, sub }) => (
  <div className="rounded-r3 border border-line bg-surface px-4 py-3">
    <div className="text-xs text-ink-3">{label}</div>
    <div className="text-2xl font-semibold leading-tight tracking-tight text-accent-text">{value}</div>
    {sub && <div className="mt-0.5 truncate text-xs text-ink-3">{sub}</div>}
  </div>
);
const shortN = (id) => state.db.GRNS.filter((g) => g.siteId === id && g.status === 'short').length;
const openSnags = (id) => svc.snags(id).filter((n) => n.status !== 'closed').length;
const peopleToday = (id) => state.db.HEADCOUNT.filter((h) => h.siteId === id && h.date === TODAY).reduce((n, h) => n + h.count, 0);

// Progress bar with a tick where the plan says the site should be today.
function PlanBar({ s }) {
  const plan = sitePlan(s);
  const ok = siteOnTrack(s);
  return (
    <div>
      <div className="relative h-2 rounded-full bg-surface-2">
        <i className={`block h-full rounded-full ${trackFill(ok)}`} style={{ width: `${s.progress}%` }} />
        {plan !== null && <em title={`Plan: ${plan}% by today`} className="absolute -top-1 h-4 w-0.5 rounded bg-ink" style={{ left: `${plan}%` }} />}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-ink-3">
        <span><b className="text-ink">{s.progress}%</b> done{plan === null ? '' : ` · plan ${plan}%`}</span>
        <span className={`rounded-full px-2 font-semibold leading-5 ${ok ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'}`}>{ok ? 'On track' : 'Behind plan'}</span>
      </div>
    </div>
  );
}
const Stat = ({ label, value, sub, tone = '', to }) => {
  const body = (
    <>
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-1 text-stat font-semibold leading-tight tracking-tight text-accent-text">{value}</div>
      <div className={`text-xs font-semibold ${tone || 'text-ink-3'}`}>{sub}</div>
    </>
  );
  const cls = 'block rounded-r3 border border-line bg-surface px-4 py-3.5 no-underline';
  return to ? <DLink to={to} className={`${cls} hover:border-accent`} style={{ color: 'inherit' }}>{body}</DLink> : <div className={cls}>{body}</div>;
};
// Composes the shared Pill (tone) inside the shared DLink (navigation), matching Pillink's old
// hot/tone logic as closely as Pill's own kind values allow — the non-hot neutral state loses its
// bg-surface-2 fill (Pill's '' kind is outline-only), a minor, accepted visual difference.
const Pillink = ({ to, hot, tone = 'warn', children }) => (
  <DLink to={to} className="no-underline"><Pill kind={hot ? (tone === 'crit' ? 'crit' : 'warn') : ''}>{children}</Pill></DLink>
);

// Same deterministic placeholder convention as the rest of the app (Ph, keyed by real feed data) —
// the site's own most recent photo update, not invented imagery.
function SiteImage({ s }) {
  const photo = svc.feed(s.id).filter((f) => f.type === 'photo').sort((a, b) => b.at.localeCompare(a.at))[0];
  return <Ph hue={photo?.hue ?? 200} seed={photo?.seed ?? s.id} ar={1.6} className="h-full" />;
}

// Cross-site panels under the board: what needs a response, who is on site, cash and recent updates.
function SitesOverview({ sites }) {
  const ids = sites.map((x) => x.id);
  const siteName = (id) => sites.find((x) => x.id === id)?.name || '';
  const issues = svc.issues().filter((i) => ids.includes(i.siteId) && i.status !== 'closed')
    .sort((a, b) => (a.due || '').localeCompare(b.due || '')).slice(0, 5);
  const shorts = state.db.GRNS.filter((g) => ids.includes(g.siteId) && g.status === 'short');
  const due = state.db.MATERIALS.filter((m) => ids.includes(m.siteId) && m.status === 'approved').slice(0, 4);
  const updates = sites.flatMap((x) => svc.feed(x.id).map((f) => ({ ...f, siteId: x.id })))
    .sort((a, b) => b.at.localeCompare(a.at));
  const cash = sites.map((x) => ({ x, c: svc.pettyCash(x.id) })).filter((r) => r.c);
  const Row = ({ to, title, sub, tag }) => (
    <DLink to={to} className="flex items-center gap-3 border-t border-line py-2.5 no-underline first:border-t-0 first:pt-0" style={{ color: 'inherit' }}>
      <span className="min-w-0 flex-1"><b className="block truncate">{title}</b><small className="text-ink-3">{sub}</small></span>
      {tag}
    </DLink>
  );
  const Empty2 = ({ children }) => <p className="m-0 rounded-r2 bg-surface-2 px-3.5 py-4 text-center text-ink-3">{children}</p>;
  return (
    <div className="mt-5 grid items-start gap-gap lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] [&>*]:min-w-0">
      <div className="flex flex-col gap-gap">
        <Card title="Needs a response">
          {issues.length === 0 && shorts.length === 0 ? <Empty2>No open issues or short deliveries.</Empty2> : (
            <>
              {issues.map((i) => (
                <Row key={i.id} to={`#/sites/${i.siteId}?tab=issues&record=${i.id}`} title={i.title}
                  sub={`${siteName(i.siteId)}${i.due ? ` · due ${fmtD(i.due)}` : ''}`}
                  tag={<span className="rounded-full bg-warn-soft px-2 text-xs font-semibold leading-6 text-warn">Issue</span>} />
              ))}
              {shorts.map((g) => (
                <Row key={g.id} to={`#/sites/${g.siteId}?tab=deliveries&record=${g.id}`} title={`${g.item} · short delivery`}
                  sub={`${siteName(g.siteId)} · ${g.qty} ${g.unit} received ${fmtD(g.date)}`}
                  tag={<span className="rounded-full bg-crit-soft px-2 text-xs font-semibold leading-6 text-crit">Delivery</span>} />
              ))}
            </>
          )}
        </Card>
        <Card title="Recent site updates">
          {updates.length === 0 ? <Empty2>No updates yet.</Empty2> : (
            <>
              {updates.slice(0, 3).map((f, i) => (
                <Row key={i} to={`#/sites/${f.siteId}?tab=feed`}
                  title={f.text || f.aiSummary || (f.type === 'photo' ? 'Photo update' : 'Voice note')}
                  sub={`${siteName(f.siteId)} · ${first(f.by)} · ${fmtDT(f.at)}`}
                  tag={<Icon name={f.type === 'photo' ? 'camera' : 'mic'} small className="text-ink-3" />} />
              ))}
              {updates.length > 3 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[13px] font-medium text-accent-text">View all {updates.length} updates</summary>
                  <div className="mt-1">
                    {updates.slice(3).map((f, i) => (
                      <Row key={i} to={`#/sites/${f.siteId}?tab=feed`}
                        title={f.text || f.aiSummary || (f.type === 'photo' ? 'Photo update' : 'Voice note')}
                        sub={`${siteName(f.siteId)} · ${first(f.by)} · ${fmtDT(f.at)}`}
                        tag={<Icon name={f.type === 'photo' ? 'camera' : 'mic'} small className="text-ink-3" />} />
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </Card>
      </div>
      <div className="flex flex-col gap-gap">
        <Card title="On site today">
          {sites.map((x) => {
            const here = svc.checkins(x.id);
            const hc = state.db.HEADCOUNT.filter((h) => h.siteId === x.id && h.date === TODAY);
            return (
              <div key={x.id} className="border-t border-line py-2.5 first:border-t-0 first:pt-0">
                <div className="flex items-baseline justify-between gap-2"><b>{x.name}</b><span className="text-xs text-ink-3">{peopleToday(x.id)} workers</span></div>
                <small className="block text-ink-3">{here.length ? `Checked in: ${here.map((c) => `${first(c.userId)} ${fmtT(c.at)}`).join(', ')}` : 'No one checked in yet'}</small>
                {hc.length > 0 && <small className="block text-ink-3">{svc.tradesLine(hc)}</small>}
              </div>
            );
          })}
        </Card>
        {/* Cash + materials were two small, orphaned-feeling cards — one "follow-through" card
            reads as a single intentional section instead of two half-empty boxes. */}
        {(cash.length > 0 || due.length > 0) && (
          <Card title="Site follow-through">
            {cash.length > 0 && (
              <div className="mb-3">
                <p className="m-0 mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">Site cash</p>
                {cash.map(({ x, c }) => (
                  <div key={x.id} className="border-t border-line py-2 first:border-t-0 first:pt-0">
                    <div className="flex items-baseline justify-between gap-2"><b>{x.name}</b><span className="text-[13px] font-semibold text-accent-text">{inr(c.left)} left</span></div>
                    <div className="my-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"><i className={`block h-full rounded-full ${c.left / c.float < 0.3 ? 'bg-warn' : 'bg-accent'}`} style={{ width: `${Math.max(0, Math.min(100, (c.left / c.float) * 100))}%` }} /></div>
                    <small className="text-ink-3">{inr(c.spent)} spent of {inr(c.float)}</small>
                  </div>
                ))}
              </div>
            )}
            {due.length > 0 && (
              <div>
                <p className="m-0 mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">Materials to expect</p>
                {due.map((m) => (
                  <Row key={m.id} to={`#/sites/${m.siteId}?tab=materials`} title={m.name} sub={`${siteName(m.siteId)}${m.vendor ? ` · ${m.vendor}` : ''}`} />
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

export function SitesIndex() {
  const sites = svc.sites();
  const canAdd = can('site', 'w') && !['contractor', 'client', 'site_manager'].includes(role());
  const onTrack = sites.filter(siteOnTrack).length;
  const issues = sites.reduce((n, x) => n + openIssues(x.id).length, 0);
  const shorts = sites.reduce((n, x) => n + shortN(x.id), 0);
  const people = sites.reduce((n, x) => n + peopleToday(x.id), 0);
  return (
    <>
      <PageHeader title="Sites" sub="Progress against plan, people on site and the work that needs a response.">
        {canAdd && <Btn kind="primary" icon="plus" onClick={() => openDialog({ kind: 'add-site' })}>Add site</Btn>}
      </PageHeader>
      {sites.length ? (
        <>
          <div className="mb-5 grid grid-cols-2 gap-gap lg:grid-cols-4">
            <Stat label="Sites on track" value={`${onTrack} / ${sites.length}`} sub={`${sites.length - onTrack} behind plan`} tone={sites.length - onTrack ? 'text-warn' : 'text-ok'} />
            <Stat label="Open issues" value={issues} sub="across all sites" tone={issues ? 'text-warn' : 'text-ok'} />
            <Stat label="Short deliveries" value={shorts} sub="to chase" tone={shorts ? 'text-crit' : 'text-ok'} />
            <Stat label="People on site today" value={people} sub="recorded headcount" />
          </div>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
            {sites.map((s) => {
              const issuesN = openIssues(s.id).length;
              const short = shortN(s.id);
              return (
                <article key={s.id} className="flex flex-col overflow-hidden rounded-r3 border border-line bg-surface transition hover:border-accent">
                  <div className="h-20 w-full overflow-hidden bg-surface-2"><SiteImage s={s} /></div>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div>
                      <h2 className="m-0 text-lg font-semibold"><SiteLink id={s.id}>{s.name}</SiteLink></h2>
                      <p className="m-0 mt-0.5 text-[13px] text-ink-3">{P(s.projectId)?.name} · {s.stage}</p>
                    </div>
                    <PlanBar s={s} />
                    <dl className="m-0 grid grid-cols-2 gap-2 text-[13px]">
                      <div><dt className="text-xs text-ink-3">Site manager</dt><dd className="m-0 font-medium">{s.managerId ? name(s.managerId) : 'Not assigned'}</dd></div>
                      <div><dt className="text-xs text-ink-3">Last visit</dt><dd className="m-0 font-medium">{fmtD(s.lastVisit)}</dd></div>
                    </dl>
                    <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-3">
                      {role() !== 'contractor'
                        ? <Pillink to={`#/sites/${s.id}?tab=issues`} hot={issuesN}>{issuesN} open issue{issuesN === 1 ? '' : 's'}</Pillink>
                        : <SiteLink id={s.id}>Open site feed</SiteLink>}
                      <Pillink to={`#/sites/${s.id}?tab=deliveries`} hot={short} tone="crit">{short} short deliver{short === 1 ? 'y' : 'ies'}</Pillink>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : <Empty>No sites available for your role.{canAdd ? ' Use Add site to create the first one.' : ''}</Empty>}
      {sites.length > 0 && <SitesOverview sites={sites} />}
      <div className="mt-gap">
        <SecHead title="Site register" sub="Contractors, attendance and progress." />
        <DataTable
          cols={['Site', 'Project', 'Stage', 'Progress', 'Site manager', 'Contractors', 'On site now', 'Last visit', 'Open issues']}
          rows={sites.map((s) => [
            <SiteLink id={s.id}>{s.name}</SiteLink>,
            P(s.projectId)?.name || '',
            s.stage,
            <span className="inline-flex items-center gap-1.5"><span className="inline-block w-20"><Bar value={s.progress} /></span>{s.progress}%</span>,
            first(s.managerId),
            s.contractorIds.map(name).join(', '),
            svc.checkins(s.id).map((c) => `${first(c.userId)} ${fmtT(c.at)}`).join(', ') || '—',
            fmtD(s.lastVisit),
            openIssues(s.id).length,
          ])}
        />
      </div>
      {role() === 'partner' && (
        <div className="mt-gap">
          <SecHead title="Progress against plan" />
          <SitesChart />
        </div>
      )}
    </>
  );
}

const STABS = [
  ['feed', 'Feed'], ['log', 'Daily log'], ['issues', 'Issues'], ['snags', 'Snags'], ['deliveries', 'Deliveries'],
  ['headcount', 'Headcount'], ['spots', 'Photo spots'], ['materials', 'Materials'], ['checklists', 'Checklists'], ['visit', 'Visit report'],
];

function SiteTabs({ id, list, current }) {
  const badge = { issues: openIssues(id).length, deliveries: shortN(id), snags: openSnags(id) };
  return (
    <nav aria-label="Site work" className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
      {list.map(([key, label]) => {
        const on = key === current;
        const n = badge[key];
        return (
          <DLink
            key={key}
            to={`#/sites/${id}?tab=${key}`}
            aria-current={on ? 'page' : undefined}
            className={`-mb-px inline-flex min-h-10 flex-none items-center gap-1.5 whitespace-nowrap border-b-2 px-3 font-medium no-underline ${on ? 'border-accent font-semibold text-accent-text' : 'border-transparent text-ink-2 hover:text-accent-text'}`}
          >
            {label}
            {n > 0 && <span className={`rounded-full px-1.5 text-[11px] font-semibold leading-4 ${on ? 'bg-accent text-accent-ink' : 'bg-surface-3 text-ink-2'}`}>{n}</span>}
          </DLink>
        );
      })}
    </nav>
  );
}

function Checklists({ siteIds }) {
  const cks = state.desk.checklists.filter((c) => siteIds.includes(c.siteId));
  if (!cks.length) return <Empty>No checklists for this stage.</Empty>;
  const totalDone = cks.reduce((n, c) => n + c.items.filter((i) => i[1]).length, 0);
  const total = cks.reduce((n, c) => n + c.items.length, 0);
  const tick = (c, i) => {
    c.items[i][1] = true;
    c.items[i][2] = state.userId;
    persist();
    toast('Ticked.');
  };
  return (<>
    <SecHead title="Checklists" sub={`${totalDone} of ${total} checks done across ${cks.length} stage${cks.length === 1 ? '' : 's'}.`} />
    {cks.map((c) => {
    const done = c.items.filter((i) => i[1]).length;
    return (
      <Card key={c.id} className="mb-3.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-lg font-semibold">{c.stage}</h2>
          <span className="text-ink-3">Due {fmtD(c.due)} · {done} of {c.items.length} done</span>
        </div>
        <Bar value={Math.round((done / c.items.length) * 100)} />
        <div className="mt-2">
          <DataTable
            cols={['Check', 'Done', 'By', '']}
            rows={c.items.map((it, i) => [
              it[0],
              <StatusPill status={it[1] ? 'done' : 'pending'} />,
              it[2] ? first(it[2]) : '',
              !it[1] && staff() ? <Btn sm onClick={() => tick(c, i)}>Tick</Btn> : '',
            ])}
          />
        </div>
      </Card>
    );
    })}
  </>);
}
export { Checklists };

function Feed({ s }) {
  const items = svc.feed(s.id).slice().sort((x, y) => y.at.localeCompare(x.at));
  const here = svc.checkins(s.id).map((c) => `${first(c.userId)} ${fmtT(c.at)}`);
  const days = [...new Set(items.map((f) => f.at.slice(0, 10)))];
  const photos = items.filter((f) => f.type === 'photo').length;
  const voice = items.length - photos;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="m-0 text-xl font-semibold">Site feed</h2>
          <p className="m-0 text-[13px] text-ink-3">{items.length} update{items.length === 1 ? '' : 's'} · {photos} photo{photos === 1 ? '' : 's'}, {voice} voice or text note{voice === 1 ? '' : 's'}</p>
        </div>
        <span className="rounded-full bg-surface-2 px-3 py-1 text-[13px] text-ink-2">On site now: <b className="text-ink">{here.join(', ') || 'no one checked in'}</b></span>
      </div>
      {items.length === 0 && <Empty>No updates from site yet.</Empty>}
      {days.map((day) => (
        <section key={day} className="mb-6">
          <h3 className="mb-2.5 mt-0 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.1em] text-accent-text">
            {fmtD(day)}{day === TODAY ? ' · Today' : ''}
            <i className="h-px flex-1 bg-line" />
          </h3>
          <div className="grid gap-gap [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
            {items.filter((f) => f.at.slice(0, 10) === day).map((f, i) => {
              const note = f.transcript || f.text || f.aiSummary || '';
              const caption = f.type === 'photo' ? (f.text || f.aiSummary) : (f.transcript ? f.text : '');
              return (
                <article key={i} className="flex flex-col overflow-hidden rounded-r3 border border-line bg-surface">
                  {f.type === 'photo' ? (
                    <div className="h-40 flex-none overflow-hidden bg-surface-2"><Ph hue={f.hue} seed={f.seed} ar={1.6} className="h-full" /></div>
                  ) : (
                    <div className="flex h-40 flex-none flex-col gap-2 overflow-hidden bg-accent-soft p-3.5 text-accent-text">
                      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"><Icon name={f.transcript ? 'mic' : 'edit'} small />{f.transcript ? `Voice note${f.dur ? ` · ${f.dur}` : ''}` : 'Note'}</span>
                      <p className="m-0 line-clamp-5 text-[13px] leading-snug">{note}</p>
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-1.5 p-3 text-[13px]">
                    <div className="flex items-center justify-between gap-2"><b>{first(f.by)}</b><span className="text-xs text-ink-3">{fmtT(f.at)}</span></div>
                    {caption && <p className="m-0 line-clamp-3 text-ink-2">{caption}</p>}
                    {f.tags && <div className="mt-auto flex flex-wrap gap-1 pt-1">{f.tags.map((t) => <span key={t} className="rounded-full bg-surface-2 px-2 text-[11px] leading-5 text-ink-3">{t}</span>)}</div>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
      <div className="mb-2.5 mt-2 flex items-center justify-between gap-3">
        <h3 className="m-0 text-xs font-semibold uppercase tracking-[0.1em] text-accent-text">Photos filed from chat, by spot</h3>
      </div>
      <Card>
        <DataTable
          cols={['Who', 'When', 'Room or spot', 'Note', '']}
          rows={filedRows({ projectId: s.projectId, kind: 'photo' }).map((x) => [
            first(x.m.by), fmtDT(x.m.at), x.room || 'Unsorted', x.m.text || '', <FromChat msgId={x.m.id} />,
          ])}
        />
      </Card>
    </>
  );
}

function DailyLog({ s }) {
  const d = state.desk.logDate || TODAY;
  const dl = svc.dailyLog(s.id, d);
  return (
    <>
      <SecHead title="Daily log" sub={`Built from the day's chat, nothing typed · ${fmtD(d)}`}>
        <input
          type="date"
          value={d}
          aria-label="Date"
          onChange={(e) => { state.desk.logDate = e.target.value; render(); }}
          className="min-h-9 rounded-r1 border border-line-2 bg-surface px-2.5 text-ink"
        />
      </SecHead>
      <div className="mb-3.5 grid grid-cols-2 gap-gap lg:grid-cols-5">
        <Tile label="Photos" value={dl.photos} />
        <Tile label="Voice notes" value={dl.voice} />
        <Tile label="Labour on site" value={dl.labour} sub={dl.who.join(', ') || 'none checked in'} />
        <Tile label="Issues" value={dl.issues.length} />
        <Tile label="Deliveries" value={dl.grns.length} />
      </div>
      {dl.lines.length > 0 && (
        <Card title="Highlights" className="mb-3.5">
          <ul className="m-0 list-disc pl-5 text-ink-2">{dl.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </Card>
      )}
      <SecHead title="Manual log entries" sub="Weather, labour by trade, equipment and delays, entered on site.">
        {(staff() || role() === 'contractor') && <Btn onClick={() => openDialog({ kind: 'log', siteId: s.id })}>Add today's log</Btn>}
      </SecHead>
      <Card>
        <DataTable
          cols={['Date', 'Weather', 'Labour by trade', 'Equipment', 'Delays', 'By']}
          rows={DAILYLOG.filter((l) => l.siteId === s.id).map((l) => [
            fmtD(l.date), l.weather,
            Object.entries(l.labour).map(([t, n]) => `${t} ${n}`).join(', '),
            (l.equipment || []).join(', '), l.delays || '', first(l.by),
          ])}
        />
      </Card>
    </>
  );
}

function Snags({ s }) {
  const close = (n) => {
    n.status = role() === 'contractor' ? 'fixed' : 'closed';
    persist();
    toast(n.status === 'fixed' ? 'Marked fixed. Site manager will check.' : 'Closed.');
  };
  return (
    <>
      <SecHead title="Snags" sub={`${svc.snags(s.id).filter((n) => n.status !== 'closed').length} open · defects to fix before handover`} />
      <Card>
      <DataTable
        cols={['Snag', 'Contractor', 'Raised by', 'Status', '']}
        rows={svc.snags(s.id).map((n) => [
          n.text, name(n.contractorId), first(n.by), <StatusPill status={n.status} />,
          n.status !== 'closed' && (can('snag', 'w') || role() === 'contractor')
            ? <Btn sm onClick={() => close(n)}>{role() === 'contractor' ? 'Mark fixed' : 'Close'}</Btn> : '',
        ])}
      />
      </Card>
    </>
  );
}

function Headcount({ s }) {
  const all = state.db.HEADCOUNT.filter((h) => h.siteId === s.id);
  const today = all.filter((h) => h.date === TODAY);
  return (
    <>
      <SecHead title="Headcount" sub="Per-trade hajri reported by each contractor, with a site photo." />
      <div className="mb-3.5 grid grid-cols-2 gap-gap lg:grid-cols-3">
        <Tile label="People recorded today" value={today.reduce((n, h) => n + h.count, 0)} />
        <Tile label="Contractors reporting today" value={new Set(today.map((h) => h.contractorId)).size} />
        <Tile label="Trades today" value={<span className="text-base leading-snug">{svc.tradesLine(today) || '—'}</span>} />
      </div>
      <Card>
        <DataTable
          cols={['Date', 'Contractor', 'Count', 'Trades', 'Reported at', 'Photo']}
          rows={all.map((h) => [
            fmtD(h.date), name(h.contractorId), h.count, svc.tradesLine([h]) || '—', h.at, <Ph hue={h.hue} seed={h.seed} ar={1.6} thumb />,
          ])}
        />
      </Card>
    </>
  );
}

function Spots({ s }) {
  const spots = state.db.SPOTS.filter((x) => x.siteId === s.id);
  return (
    <>
      <SecHead title="Photo spots" sub={`${spots.length} fixed spot${spots.length === 1 ? '' : 's'} photographed over time to show progress.`} />
      {spots.length === 0 && <Empty>No photo spots set up for this site.</Empty>}
      {spots.map((sp) => (
    <Card key={sp.name} className="mb-3.5">
      <h2 className="mt-0 text-lg font-semibold">{sp.name}</h2>
      <p className="text-ink-3">Same spot, over time.</p>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
        {sp.shots.map((sh, i) => (
          <figure key={i} className="m-0"><Ph hue={sh.hue} seed={sh.seed} /><figcaption className="text-[13px]">{fmtD(sh.at)}</figcaption></figure>
        ))}
      </div>
    </Card>
      ))}
    </>
  );
}

function Materials({ s }) {
  const list = svc.materials().filter((m) => m.siteId === s.id);
  return (
    <>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="m-0 text-lg font-semibold">Materials</h2><p className="m-0 text-[13px] text-ink-3">Samples, supplier and approval status together.</p></div>
        <AssistButton kind="compare" projectId={s.projectId} />
      </div>
      {list.length ? (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
          {list.map((m) => (
            <article key={m.id} className="overflow-hidden rounded-r3 border border-line bg-surface">
              {/* bg-black/60 + text-white: a fixed-contrast caption over a photo, intentionally theme-independent. */}
              <div className="relative"><Ph hue={m.hue} seed={m.seed} /><span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-xs text-white">Demo preview · original not attached</span></div>
              <div className="flex flex-col items-start gap-1.5 p-3">
                <h3 className="m-0 text-base font-semibold">{m.name}</h3>
                <p className="m-0">{m.vendor || 'Supplier not recorded'}</p>
                <StatusPill status={m.status} />
                <p className="m-0 text-[13px] text-ink-3">{m.clientVisible ? 'Visible to client' : 'Internal only'}</p>
                {m.status === 'client_pending' && can('material', 'a') && (
                  <Btn onClick={() => { svc.approveMaterial(m.id, true); toast('Material approved.'); }}>Approve on client's behalf</Btn>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : <Empty>No material samples shared for this site.</Empty>}
    </>
  );
}

function Visit({ s }) {
  const dl = svc.dailyLog(s.id, TODAY);
  const facts = [
    ['Photos', dl.photos], ['Voice notes', dl.voice], ['People on site', dl.labour],
    ['Issues', dl.issues.length], ['Deliveries', dl.grns.length], ['Open snags', openSnags(s.id)],
  ];
  return (
    <>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="m-0 text-xl font-semibold">Visit report</h2><p className="m-0 text-[13px] text-ink-3">Draft the day's progress report from site records, then edit before sending.</p></div>
        <AssistButton kind="daily" siteId={s.id} date={TODAY}>Draft daily report</AssistButton>
      </div>
      <div className="grid items-start gap-gap lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card title={`What the ${fmtD(TODAY)} report will draw on`}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {facts.map(([k, v]) => (
              <div key={k} className="rounded-r2 bg-surface-2 px-3.5 py-3">
                <div className="text-xs text-ink-3">{k}</div>
                <div className="text-2xl font-semibold leading-tight text-accent-text">{v}</div>
              </div>
            ))}
          </div>
          {dl.lines.length > 0 && <ul className="mb-0 mt-3 list-disc pl-5 text-ink-2">{dl.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>}
        </Card>
        <Card title="How it works">
          <ol className="m-0 flex list-decimal flex-col gap-2 pl-5 text-ink-2">
            <li>Choose a date and review the source records.</li>
            <li>Edit the draft. Nothing is sent automatically.</li>
            <li>Send it to the site conversation.</li>
          </ol>
          <p className="mb-0 mt-3 text-[13px] text-ink-3">Client updates use separately selected client-visible facts from the project overview.</p>
        </Card>
      </div>
    </>
  );
}

const TABS = {
  feed: Feed, log: DailyLog, issues: IssueWorkspace, snags: Snags, deliveries: DeliveryWorkspace,
  headcount: Headcount, spots: Spots, materials: Materials, checklists: ({ s }) => <Checklists siteIds={[s.id]} />, visit: Visit,
};

export function SitePage({ id, q }) {
  const s = svc.site(id);
  if (!s) return <Empty>No access to this site.</Empty>;
  const list = role() === 'contractor'
    ? STABS.filter(([k]) => ['feed', 'log', 'snags', 'deliveries', 'headcount', 'checklists'].includes(k))
    : STABS;
  const tab = list.some(([k]) => k === q.tab) ? q.tab : list[0][0];
  const Tab = TABS[tab];
  const cash = svc.pettyCash(s.id);
  const has = (k) => list.some(([x]) => x === k);
  const issuesN = openIssues(s.id).length;
  const short = shortN(s.id);
  const mgr = s.managerId ? name(s.managerId) : 'not assigned';
  return (
    <>
      <PageHeader title={s.name} sub={`${P(s.projectId)?.name || ''} · Site manager ${mgr} · Last visit ${fmtD(s.lastVisit)}`}>
        {navFor().some(([k]) => k === 'projects') && <Btn to={href(`#/projects/${s.projectId}`)}>Open project</Btn>}
        <ChatLink button thread={state.db.THREADS.find((t) => t.siteId === s.id)}>Site chat</ChatLink>
      </PageHeader>
      <section className="mb-4 rounded-r3 border border-line bg-surface p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="m-0 text-lg font-semibold">{s.stage}</h2>
          <span className="text-[13px] text-ink-3">Progress against plan</span>
        </div>
        <PlanBar s={s} />
      </section>
      <div className="mb-5 grid grid-cols-2 gap-gap lg:grid-cols-4">
        <Stat label="People recorded today" value={peopleToday(s.id)} sub="per-trade hajri" to={`#/sites/${s.id}?tab=headcount`} />
        {has('issues') && <Stat label="Open issues" value={issuesN} sub={issuesN ? 'need a response' : 'all clear'} tone={issuesN ? 'text-warn' : 'text-ok'} to={`#/sites/${s.id}?tab=issues`} />}
        <Stat label="Short deliveries" value={short} sub={short ? 'to chase' : 'none flagged'} tone={short ? 'text-crit' : 'text-ok'} to={`#/sites/${s.id}?tab=deliveries`} />
        {cash ? (
          <div className="rounded-r3 border border-line bg-surface px-4 py-3.5">
            <div className="text-xs text-ink-3">Site cash (petty cash)</div>
            <div className="mt-1 text-stat font-semibold leading-tight tracking-tight text-accent-text">{inr(cash.left)}</div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"><i className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, (cash.left / cash.float) * 100))}%` }} /></div>
            <div className="mt-1 text-xs text-ink-3">left of {inr(cash.float)} · {inr(cash.spent)} spent</div>
          </div>
        ) : <Stat label="Open snags" value={openSnags(s.id)} sub="to close" to={`#/sites/${s.id}?tab=snags`} />}
      </div>
      <SiteTabs id={s.id} list={list} current={tab} />
      <Tab s={s} q={q} />
    </>
  );
}
