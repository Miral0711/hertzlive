import { state, svc, can, inr, fmtD, fmtT, fmtDT, toast, persist, render } from '../../shared/core.js';
import { TODAY } from '../../shared/data.js';
import { DAILYLOG } from '../data';
import { Btn, Card, DataTable, Empty, PageHeader, Bar, StatusPill } from '../../ui/ui';
import Icon from '../../ui/Icon';
import { DLink } from '../nav';
import { navFor, P, name, first, role, staff } from '../helpers';
import { SiteLink, ChatLink, FromChat, filedRows } from '../parts';
import { openDialog } from '../session';
import { AssistButton } from '../chat/assist';
import Ph from './Ph';
import { IssueWorkspace, DeliveryWorkspace } from './Work';
import { Details, Progress } from './bits';

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

function SitesChart() {
  const rows = svc.sites().map((s) => ({ s, plan: sitePlan(s) }));
  if (!rows.length) return null;
  return (
    <Card title="Progress against plan" className="mb-3.5">
      {rows.map(({ s, plan }) => (
        <div key={s.id} className="mb-2 grid grid-cols-[minmax(90px,1fr)_2fr_minmax(90px,1fr)] items-center gap-3">
          <span><SiteLink id={s.id}>{s.name}</SiteLink></span>
          <div className="relative h-2 rounded bg-surface-3">
            <i className={`block h-full rounded ${siteOnTrack(s) ? 'bg-accent' : 'bg-warn'}`} style={{ width: `${s.progress}%` }} />
            {plan !== null && <em title={`Plan ${plan}% by today`} className="absolute -top-1 h-4 w-0.5 bg-ink" style={{ left: `${plan}%` }} />}
          </div>
          <small className="text-ink-3">{s.progress}% done{plan === null ? '' : `, plan ${plan}%`}</small>
        </div>
      ))}
      <p className="text-ink-3">Plan is working days between project start and handover, site holidays from Settings skipped. Tick marks where the site should be today.</p>
    </Card>
  );
}

export function SitesIndex() {
  const sites = svc.sites();
  return (
    <>
      <PageHeader title="Sites" sub="Progress, people and the work that needs a response." />
      {sites.length ? (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
          {sites.map((s) => {
            const issues = openIssues(s.id);
            const short = state.db.GRNS.filter((g) => g.siteId === s.id && g.status === 'short').length;
            return (
              <article key={s.id} className="rounded-r3 border border-line bg-surface p-4">
                <div className="flex items-center gap-2"><Icon name="sites" /><h2 className="m-0 text-lg font-semibold"><SiteLink id={s.id}>{s.name}</SiteLink></h2></div>
                <p>{s.stage}</p>
                <Progress label={`Recorded progress · ${s.progress}%`} value={s.progress} />
                <div className="my-2 flex flex-col text-[13px] text-ink-2">
                  <span>Site manager <b>{name(s.managerId)}</b></span>
                  <span>Last visit <b>{fmtD(s.lastVisit)}</b></span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {role() !== 'contractor'
                    ? <DLink to={`#/sites/${s.id}?tab=issues`}>{issues.length} open issues</DLink>
                    : <SiteLink id={s.id}>Open site feed</SiteLink>}
                  <DLink to={`#/sites/${s.id}?tab=deliveries`}>{short} short deliveries</DLink>
                </div>
              </article>
            );
          })}
        </div>
      ) : <Empty>No sites available for your role.</Empty>}
      <div className="mt-3.5">
        <Details summary="Site register · contractors, attendance and progress">
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
        </Details>
        {role() === 'partner' && <Details summary="Progress against plan"><SitesChart /></Details>}
      </div>
    </>
  );
}

const STABS = [
  ['feed', 'Feed'], ['log', 'Daily log'], ['issues', 'Issues'], ['snags', 'Snags'], ['deliveries', 'Deliveries'],
  ['headcount', 'Headcount'], ['spots', 'Photo spots'], ['materials', 'Materials'], ['checklists', 'Checklists'], ['visit', 'Visit report'],
];
const PRIMARY = ['feed', 'issues', 'deliveries', 'log'];

function SiteTabs({ id, list, current }) {
  const extra = list.filter(([k]) => !PRIMARY.includes(k));
  const entry = ([key, label]) => (
    <DLink
      key={key}
      to={`#/sites/${id}?tab=${key}`}
      aria-current={key === current ? 'page' : undefined}
      className={`inline-flex min-h-[38px] items-center rounded-r1 px-3 py-2 font-medium no-underline ${key === current ? 'bg-accent-soft font-semibold text-accent-text' : 'text-ink-2 hover:bg-surface-2'}`}
    >
      {label}
    </DLink>
  );
  return (
    <nav aria-label="Site work" className="mb-4 flex flex-wrap items-center gap-1 border-b border-line pb-2">
      {list.filter(([k]) => PRIMARY.includes(k)).map(entry)}
      {extra.length > 0 && (
        <details className="relative" open={extra.some(([k]) => k === current)} key={current}>
          <summary className="cursor-pointer rounded-r1 px-3 py-2 font-medium text-ink-2 hover:bg-surface-2">
            {extra.find(([k]) => k === current)?.[1] || 'More site tools'}
          </summary>
          <div className="mt-1 flex flex-wrap gap-1">{extra.map(entry)}</div>
        </details>
      )}
    </nav>
  );
}

function Checklists({ siteIds }) {
  const cks = state.desk.checklists.filter((c) => siteIds.includes(c.siteId));
  if (!cks.length) return <Empty>No checklists for this stage.</Empty>;
  const tick = (c, i) => {
    c.items[i][1] = true;
    c.items[i][2] = state.userId;
    persist();
    toast('Ticked.');
  };
  return cks.map((c) => {
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
              <StatusPill status={it[1] ? 'done' : 'open'} />,
              it[2] ? first(it[2]) : '',
              !it[1] && staff() ? <Btn sm onClick={() => tick(c, i)}>Tick</Btn> : '',
            ])}
          />
        </div>
      </Card>
    );
  });
}
export { Checklists };

function Feed({ s }) {
  return (
    <Card>
      <h2 className="mt-0 text-lg font-semibold">Site feed</h2>
      <p className="text-ink-3">On site now: {svc.checkins(s.id).map((c) => `${first(c.userId)} ${fmtT(c.at)}`).join(', ') || 'no one checked in'}</p>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
        {svc.feed(s.id).map((f, i) => (
          <figure key={i} className="m-0">
            {f.type === 'photo'
              ? <Ph hue={f.hue} seed={f.seed} />
              : <div className="whitespace-pre-line rounded-r2 bg-accent-soft p-2.5 text-[13px] text-accent-text">{`Voice note ${f.dur}\n${f.transcript}`}</div>}
            <figcaption className="mt-1 text-[13px]">
              <b>{first(f.by)}</b> · {fmtDT(f.at)}<br />{f.text || f.aiSummary || ''}
              {f.tags && <><br /><small className="text-ink-3">{f.tags.join(' · ')}</small></>}
            </figcaption>
          </figure>
        ))}
      </div>
      <h2 className="text-lg font-semibold">Photos filed from chat, by spot</h2>
      <DataTable
        cols={['Who', 'When', 'Room or spot', 'Note', '']}
        rows={filedRows({ projectId: s.projectId, kind: 'photo' }).map((x) => [
          first(x.m.by), fmtDT(x.m.at), x.room || 'Unsorted', x.m.text || '', <FromChat msgId={x.m.id} />,
        ])}
      />
    </Card>
  );
}

function DailyLog({ s }) {
  const d = state.desk.logDate || TODAY;
  const dl = svc.dailyLog(s.id, d);
  return (
    <>
      <Card className="mb-3.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-lg font-semibold">Daily log</h2>
          <input
            type="date"
            value={d}
            aria-label="Date"
            onChange={(e) => { state.desk.logDate = e.target.value; render(); }}
            className="min-h-9 rounded-r1 border border-line-2 bg-surface px-2.5 text-ink"
          />
        </div>
        <p className="text-ink-3">Built from today's chat, nothing typed</p>
        <ul className="m-0 list-disc pl-5">
          <li>Photos: {dl.photos}, voice notes: {dl.voice}</li>
          <li>Labour on site: {dl.labour} ({dl.who.join(', ') || 'none checked in'})</li>
          <li>Issues: {dl.issues.length}</li>
          <li>Deliveries: {dl.grns.length}</li>
          {dl.lines.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </Card>
      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-lg font-semibold">Manual log entries</h2>
          {(staff() || role() === 'contractor') && <Btn onClick={() => openDialog({ kind: 'log', siteId: s.id })}>Add today's log</Btn>}
        </div>
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
    <Card>
      <h2 className="mt-0 text-lg font-semibold">Snags</h2>
      <DataTable
        cols={['Snag', 'Contractor', 'Raised by', 'Status', '']}
        rows={svc.snags(s.id).map((n) => [
          n.text, name(n.contractorId), first(n.by), <StatusPill status={n.status} />,
          n.status !== 'closed' && (can('snag', 'w') || role() === 'contractor')
            ? <Btn sm onClick={() => close(n)}>{role() === 'contractor' ? 'Mark fixed' : 'Close'}</Btn> : '',
        ])}
      />
    </Card>
  );
}

function Headcount({ s }) {
  return (
    <Card>
      <h2 className="mt-0 text-lg font-semibold">Headcount</h2>
      <DataTable
        cols={['Date', 'Contractor', 'Count', 'Trades', 'Reported at', 'Photo']}
        rows={state.db.HEADCOUNT.filter((h) => h.siteId === s.id).map((h) => [
          fmtD(h.date), name(h.contractorId), h.count, svc.tradesLine([h]) || '—', h.at, <Ph hue={h.hue} seed={h.seed} ar={1.6} thumb />,
        ])}
      />
    </Card>
  );
}

function Spots({ s }) {
  return state.db.SPOTS.filter((x) => x.siteId === s.id).map((sp) => (
    <Card key={sp.name} className="mb-3.5">
      <h2 className="mt-0 text-lg font-semibold">{sp.name}</h2>
      <p className="text-ink-3">Same spot, over time.</p>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
        {sp.shots.map((sh, i) => (
          <figure key={i} className="m-0"><Ph hue={sh.hue} seed={sh.seed} /><figcaption className="text-[13px]">{fmtD(sh.at)}</figcaption></figure>
        ))}
      </div>
    </Card>
  ));
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
  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-lg font-semibold">Daily progress report</h2>
        <AssistButton kind="daily" siteId={s.id} date={TODAY}>Draft daily report</AssistButton>
      </div>
      <p className="text-ink-3">Choose a date, review the source records and edit the draft before sending to the site conversation. Client updates use separately selected client-visible facts from the project overview.</p>
    </Card>
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
  const link = 'rounded-r2 border border-line bg-surface px-3 py-2 no-underline';
  return (
    <>
      <PageHeader title={s.name}>
        {navFor().some(([k]) => k === 'projects') && <DLink to={`#/projects/${s.projectId}`}>Open project</DLink>}
        <ChatLink thread={state.db.THREADS.find((t) => t.siteId === s.id)}>Site chat</ChatLink>
      </PageHeader>
      <div className="mb-3.5 flex flex-wrap items-start gap-3">
        <div className="min-w-[220px] flex-1 rounded-r2 border border-line bg-surface px-3 py-2">
          <span className="font-semibold">{s.stage}</span>
          <Progress label={`Recorded progress · ${s.progress}%`} value={s.progress} />
        </div>
        <DLink className={link} to={`#/sites/${s.id}?tab=headcount`}>
          <b>{state.db.HEADCOUNT.filter((h) => h.siteId === s.id && h.date === TODAY).reduce((n, h) => n + h.count, 0)}</b> people recorded today
        </DLink>
        {list.some(([k]) => k === 'issues') && (
          <DLink className={link} to={`#/sites/${s.id}?tab=issues`}><b>{openIssues(s.id).length}</b> open issues</DLink>
        )}
        {cash && (
          <details className={link}><summary className="cursor-pointer">Site cash</summary><span>{inr(cash.left)} left of {inr(cash.float)}</span></details>
        )}
      </div>
      <SiteTabs id={s.id} list={list} current={tab} />
      <Tab s={s} q={q} />
    </>
  );
}
