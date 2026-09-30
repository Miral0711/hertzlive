import { state, svc, can, inr, fmtD, fmtDT, fmtT, hh, toast, render, AIProvider } from '../../shared/core.js';
import { TODAY, NAS_TREE, PHASES } from '../../shared/data.js';
import { Btn, Card, Item, Kpi, Kpis, Pill, StatusPill, DataTable, List, Banner } from '../../ui/ui';
import Icon from '../../ui/Icon';
import { DLink, href } from '../nav';
import { P, name, first, days } from '../helpers';
import { SiteLink } from '../parts';
import { openDialog } from '../session';
import { SiteReviewQueue, openDesktopAssist } from '../chat/assist';
import { Mono, Grow, Small, Dot, LinkRow, ListCard, Grid, PhCanvas, NeedList } from './bits';
import MeetingsCard from './MeetingsCard';
import { fileKind, winPath } from './files';

const SRC = { web: 'Web form', whatsapp: 'WhatsApp', phone: 'Phone', instagram: 'Instagram', facebook: 'Facebook', vapi: 'AI call' };
const ym = (d) => (d || '').slice(0, 7);
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;

// ---------- ACT handlers used by the homes ----------
function nudge(id) {
  const inv = state.db.INVOICES.find((x) => x.id === id);
  openDialog({ kind: 'invoice-nudge', invId: inv.id, lang: 'English', text: 'Thinking…' });
  AIProvider.draftNudge(inv, 'English').then((text) => {
    if (state.desk.dialog?.kind === 'invoice-nudge') state.desk.dialog.text = text;
    render();
  });
}
function rememberDrawing(projectId, no) {
  const p = svc.project(projectId);
  const d = p?.drawings.find((x) => x.no === no);
  if (!d || !can('drawing', 'r', state.role)) return false;
  try {
    const key = `archos-desktop-drawings:${state.userId}:${state.role}`;
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    const old = Array.isArray(data.recent) ? data.recent : [];
    data.recent = [{ projectId, no, rev: d.rev }, ...old.filter((x) => x && (x.projectId !== projectId || x.no !== no))].slice(0, 12);
    localStorage.setItem(key, JSON.stringify(data));
    state.desk.drawingSaveError = '';
    return true;
  } catch (_) {
    state.desk.drawingSaveError = 'Drawing shortcut could not be saved on this device. Try again.';
    toast(state.desk.drawingSaveError);
    return false;
  }
}
function drawingView(projectId, no) {
  if (!can('drawing', 'r', state.role) || !svc.project(projectId)?.drawings.some((d) => d.no === no)) return toast('Drawing unavailable.');
  rememberDrawing(projectId, no);
  state.desk.zoom = 1;
  openDialog({ kind: 'drawing-view', projectId, no });
}
function fileOpen(path) {
  const k = fileKind(path);
  if (k === 'Photo' || k === 'PDF') openDialog({ kind: 'file-preview', path });
  else {
    navigator.clipboard?.writeText(winPath(path));
    toast(`No preview for ${k}. Path copied, open it in your CAD app.`);
  }
}
const decisionDone = (id) => { svc.decideDecision(id); toast('Marked decided.'); };
const leaveNo = (id) => { svc.decideLeave(id, false); toast('Leave rejected.'); };
const ViewBtn = ({ no, projectId }) => <Btn sm onClick={() => drawingView(projectId, no)}>View</Btn>;

// ---------- data helpers ----------
export function needsYou() {
  const need = [];
  svc.myEnquiries().forEach((x) =>
    need.push([`${x.name} · New enquiry · ${svc.serviceType(x.typeId)} via ${SRC[x.source] || x.source}`, '#/enquiries']));
  if (can('booking', 'a'))
    svc.pendingBookings().forEach((k) =>
      need.push([`Client meeting to confirm · ${k.title}, ${fmtD(k.date)} ${hh(k.start)}`, '#/schedule?tab=approvals']));
  if (can('leave', 'a'))
    svc.leaves({ status: 'pending' }).forEach((l) =>
      need.push([`${name(l.userId)} · Leave request · ${l.days} day${l.days > 1 ? 's' : ''} from ${fmtD(l.from)}`, '#/people?tab=leaves']));
  state.db.CHANGES.filter((c) => c.status === 'awaiting_client' && svc.myProjectIds().includes(c.projectId)).forEach((c) =>
    need.push([`Change order ${c.no} waiting for client · ${P(c.projectId).name}`, `#/projects/${c.projectId}?tab=changes`]));
  svc.materials().filter((m) => m.status === 'client_pending').forEach((m) =>
    need.push([`Material pending client approval · ${m.name}`, `#/sites/${m.siteId}?tab=materials`]));
  svc.issues().filter((i) => i.status !== 'closed' && i.due && i.due.slice(0, 10) <= TODAY).forEach((i) =>
    need.push([`Issue due · ${i.title}`, `#/sites/${i.siteId}?tab=issues`]));
  state.db.RFIS.filter((x) => x.status === 'open' && svc.myProjectIds().includes(x.projectId)).forEach((x) =>
    need.push([`${x.no} unanswered · ${x.title}`, `#/projects/${x.projectId}?tab=changes`]));
  state.desk.reminders.filter((x) => x.who === state.userId).forEach((x) =>
    need.push([`Reminder · ${x.text} (${fmtDT(x.when)})`, x.ref]));
  return need;
}
const lastPhotoAt = (siteId) => svc.feed(siteId).filter((f) => f.type === 'photo').map((f) => f.at).sort().pop();
function sitesAtRisk() {
  return svc.sites().map((s) => {
    const why = [];
    const open = svc.issues().filter((i) => i.siteId === s.id && i.status !== 'closed').length;
    if (open > 3) why.push(`${open} open issues`);
    const late = (P(s.projectId)?.milestones || []).find((m) => !m.done && m.date < TODAY);
    if (late) why.push(`${late.name} past ${fmtD(late.date)}`);
    const last = lastPhotoAt(s.id);
    if (!last || days(last.slice(0, 10), TODAY) >= 3)
      why.push(last ? `no site photo for ${days(last.slice(0, 10), TODAY)} days` : 'no site photo yet');
    if (!state.db.HEADCOUNT.some((h) => h.siteId === s.id && h.date === TODAY) && !svc.siteHolidays(TODAY, `${TODAY}z`))
      why.push('no hajri yet today');
    return { s, why };
  }).filter((x) => x.why.length);
}
function monthsBack(n) {
  const [y, m] = TODAY.split('-').map(Number);
  return Array.from({ length: n }, (_, k) => {
    const d = new Date(y, m - 1 - (n - 1 - k), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}
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

const pulseTone = { warn: 'border-warn-soft bg-warn-soft', crit: 'border-crit-soft bg-crit-soft' };
const Pulse = ({ to, v, l, d, cls = '' }) => (
  <DLink to={to} className={`flex flex-col gap-0.5 rounded-r3 border px-4 py-3 no-underline ${pulseTone[cls] || 'border-line bg-surface'}`} style={{ color: 'inherit' }}>
    <b className="text-2xl leading-tight">{v}</b>
    <span className="text-[13px] font-medium">{l}</span>
    <small className="text-ink-3">{d}</small>
  </DLink>
);
function PulseStrip() {
  const now = cashRow(ym(TODAY));
  const open = svc.issues().filter((i) => i.status !== 'closed');
  const late = open.filter((i) => i.due && i.due < `${TODAY}T23:59`);
  const sites = svc.sites();
  const ok = sites.filter(siteOnTrack).length;
  const enq = (mo) => state.db.ENQUIRIES.filter((e) => ym(e.at) === mo).length;
  const [prev, cur] = monthsBack(2);
  const lateSite = late[0] ? `#/sites/${late[0].siteId}?tab=issues` : '#/sites';
  return (
    <div className="mb-3.5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Pulse to="#/money" v={inr(now.got)} l="Cash in this month" d={`of ${inr(now.planned)} due`} cls={now.got < now.planned ? 'warn' : ''} />
      <Pulse to={lateSite} v={late.length} l="Issues past SLA" d={`${open.length} open`} cls={late.length ? 'crit' : ''} />
      <Pulse to="#/sites" v={`${ok} of ${sites.length}`} l="Sites on track" d={`${sites.length - ok} behind plan`} cls={sites.length - ok ? 'warn' : ''} />
      <Pulse to="#/enquiries" v={enq(cur)} l="Enquiries this month" d={`${enq(prev)} last month`} />
    </div>
  );
}
// Note: this module used to export its own CashChart()/SitesChart() as well — dead code, never
// imported anywhere (pages/money.jsx has the one actually rendered on the Money page; sites/
// SiteBoard.jsx has the one actually rendered on the Sites page). Removed rather than fixed in
// place, since fixing colors on unreachable code doesn't help anyone.

function approvalsDue() {
  return state.db.STATUTORY.filter((a) => a.followUp && a.followUp <= TODAY && a.status !== 'granted').map((a) => (
    <LinkRow key={a.id || a.name + a.projectId} to={`#/projects/${a.projectId}?tab=approvals`}>
      <b>{a.name}</b> · {P(a.projectId).name}{a.authority ? `, ${a.authority}` : ''} · follow up {fmtD(a.followUp)}{a.ownerId ? `, ${first(a.ownerId)}` : ''}
    </LinkRow>
  ));
}
function folderLinks() {
  const mine = svc.myProjectIds();
  const row = (path, label) => (
    <Item key={path} to={href(`#/files?path=${encodeURIComponent(path)}`)}>
      <Icon name="folder" small /><Grow>{label}</Grow><Small>Open</Small>
    </Item>
  );
  const out = NAS_TREE.entries
    .filter((e) => mine.includes((e.map || '').replace('Project ', '')))
    .map((e) => row(`Projects/${e.p}`, e.p));
  const mineEntry = (NAS_TREE.employees?.entries || []).find((e) => e.map === `Person ${state.userId}`);
  if (mineEntry) out.push(row(`Employees/${mineEntry.p}`, `${mineEntry.p} · my WIP`));
  return out;
}

// ---------- partner ----------
export function PartnerHome() {
  const overdue = state.db.INVOICES.filter((i) => i.status === 'overdue' || (i.status === 'sent' && i.due < TODAY));
  const ready = svc.projects().filter((p) => p.phase < 4)
    .filter((p) => p.milestones.filter((m) => m.done).length > state.db.INVOICES.filter((i) => i.projectId === p.id).length);
  const money = [
    ...overdue.map((i) => (
      <Item key={i.id}>
        <Grow><b>{P(i.projectId).name}</b> · {i.no} · {inr(i.amount)}, due {fmtD(i.due)}</Grow>
        <Btn sm onClick={() => nudge(i.id)}>Chase</Btn>
      </Item>
    )),
    ...ready.map((p) => (
      <LinkRow key={`r${p.id}`} to="#/money?tab=invoices"><b>{p.name}</b> · milestone hit, invoice ready to raise</LinkRow>
    )),
  ];
  const risk = sitesAtRisk().map(({ s, why }) => (
    <Item key={s.id}><Dot /><Grow><b>{s.name}</b> · {why.join(', ')}</Grow><SiteLink id={s.id}>Open</SiteLink></Item>
  ));
  return (
    <>
      <div className="mb-3.5 grid gap-3.5 lg:grid-cols-2 [&>*]:min-w-0 [&>*]:h-full">
        <NeedList need={needsYou()} />
        <SiteReviewQueue />
        <ListCard title="Money this week" rows={money} empty="Nothing overdue, nothing to raise." />
        <ListCard title="Sites to check" rows={risk} empty="No site flags in recorded data." />
      </div>
      <details className="mb-2.5 rounded-r3 border border-line bg-surface px-[18px] py-3">
        <summary className="cursor-pointer font-semibold">Studio snapshot &amp; approval follow-ups</summary>
        <div className="mt-3"><PulseStrip /></div>
        <ListCard title="Approvals to follow up" rows={approvalsDue()} empty="No approvals waiting on a follow-up." />
      </details>
    </>
  );
}

// ---------- designer ----------
export function DesignerHome() {
  const mine = svc.myProjectIds();
  const todo = [
    ...svc.tasks({ mine: true }).map((t) => ({ k: `t${t.id}`, due: t.due, text: `${t.title} · ${P(t.projectId)?.name || ''}`, href: `#/projects/${t.projectId}?tab=tasks`, crit: t.critical })),
    ...state.db.RFIS.filter((x) => x.status === 'open' && mine.includes(x.projectId)).map((x) => ({ k: `r${x.id || x.no}`, due: x.due, text: `${x.no} · ${x.title}`, href: `#/projects/${x.projectId}?tab=changes` })),
    ...state.desk.reminders.filter((x) => x.who === state.userId).map((x, i) => ({ k: `m${i}`, due: x.when, text: `Reminder · ${x.text}`, href: x.ref })),
  ].sort((a, b) => (a.due || '').localeCompare(b.due || '')).map((t) => (
    <Item key={t.k} to={href(t.href || '#/dashboard')}>
      {t.crit && <Dot />}<Grow>{t.text}</Grow><Small>{t.due ? fmtD(t.due) : ''}</Small>
    </Item>
  ));
  const drawings = [];
  svc.projects().forEach((p) => {
    const ct = state.db.THREADS.find((t) => t.projectId === p.id && t.kind === 'client');
    (p.drawings || []).filter((d) => d.by === state.userId).forEach((d) => {
      const rev = svc.issues().some((i) => i.drawing === d.no && i.status !== 'closed');
      const comments = ct ? state.db.MESSAGES.filter((m) => m.threadId === ct.id && (m.text || '').includes(d.no)).length : 0;
      drawings.push(
        <Item key={`${p.id}${d.no}`}>
          <Grow>
            <Mono>{d.no}</Mono> {d.name} · <StatusPill status={d.status} />
            {rev && <> <Pill kind="warn">Revision needed</Pill></>}
            {comments ? ` · ${plural(comments, 'client comment')}` : ''}
          </Grow>
          <ViewBtn no={d.no} projectId={p.id} />
        </Item>,
      );
    });
  });
  const decisions = svc.decisionsDue({}).map((d) => (
    <Item key={d.id}>
      <Grow>{P(d.projectId).name} · {d.title}, due {fmtD(d.due)}{d.late ? ' · Escalated to partner' : ''}</Grow>
      <Btn sm onClick={() => decisionDone(d.id)}>Mark decided</Btn>
    </Item>
  ));
  return (
    <>
      <Grid>
        <ListCard title="My next actions" rows={todo} empty="Nothing due." />
        <ListCard title="My drawings" rows={drawings} empty="No drawings on your name." />
      </Grid>
      <Grid>
        <ListCard title="Client decisions waiting" rows={decisions} empty="Nothing pending." />
        <ListCard title="My folders" rows={folderLinks()} empty="No folders mapped yet." />
      </Grid>
    </>
  );
}

// ---------- site manager ----------
export function SiteManagerHome() {
  const sites = svc.sites();
  const ids = sites.map((s) => s.id);
  const todayRows = sites.map((s) => {
    const ins = svc.checkins(s.id).map((c) => `${first(c.userId)} ${fmtT(c.at)}`);
    const exp = (s.contractorIds || []).map((x) => name(x));
    const del = state.db.MATERIALS.filter((m) => m.siteId === s.id && m.status === 'approved').map((m) => m.name);
    return (
      <Item key={s.id}>
        <Grow>
          <b>{s.name}</b><br />
          <small className="text-ink-3">
            Checked in: {ins.join(', ') || 'no one yet'}<br />
            Contractors expected: {exp.join(', ') || 'none'}<br />
            Deliveries due: {del.join(', ') || 'none'}
          </small>
        </Grow>
        <SiteLink id={s.id}>Open</SiteLink>
      </Item>
    );
  });
  const open = [
    ...svc.issues().filter((i) => ids.includes(i.siteId) && i.status !== 'closed').map((i) => ({ k: `i${i.id}`, at: i.at || '', text: `${i.title} · ${i.sla || ''}`, href: `#/sites/${i.siteId}?tab=issues` })),
    ...state.db.SNAGS.filter((n) => ids.includes(n.siteId) && n.status !== 'closed').map((n) => ({ k: `s${n.id}`, at: n.at || '', text: `Snag · ${n.text}`, href: `#/sites/${n.siteId}?tab=snags` })),
  ].sort((a, b) => a.at.localeCompare(b.at)).map((x) => (
    <LinkRow key={x.k} to={x.href} trail={x.at ? fmtD(x.at) : ''}>{x.text}</LinkRow>
  ));
  const week = new Date(TODAY);
  week.setDate(week.getDate() - 7);
  const wk = week.toISOString().slice(0, 10);
  const pids = sites.map((s) => s.projectId);
  const waiting = [
    ...state.db.MATERIALS.filter((m) => ids.includes(m.siteId) && m.status !== 'approved').map((m) => (
      <LinkRow key={`m${m.id}`} to={`#/sites/${m.siteId}?tab=materials`}>{m.name} · <StatusPill status={m.status} /></LinkRow>
    )),
    ...state.db.TRANSMITTALS.filter((t) => pids.includes(t.projectId) && t.at.slice(0, 10) >= wk && !t.ack).map((t) => (
      <Item key={`t${t.id || t.no + t.at}`}>
        <Grow><Mono>{t.no}</Mono> {t.rev} issued to {name(t.to)} {fmtD(t.at)} · not acknowledged</Grow>
      </Item>
    )),
  ];
  const late = new Date().getHours() >= 17;
  const report = sites.map((s) => (
    <Item key={s.id}>
      <Grow><b>{s.name}</b> · builds from today's photos, check-ins and deliveries. You send it.</Grow>
      <Btn sm kind={late ? 'primary' : 'default'} onClick={() => openDesktopAssist('daily', { siteId: s.id, date: TODAY })}>Day report</Btn>
    </Item>
  ));
  return (
    <>
      {late && <Banner internal>After 5 pm. Send today's day report.</Banner>}
      <Grid>
        <ListCard title="Today on site" rows={todayRows} empty="No sites." />
        <ListCard title="Open snags and issues" rows={open} empty="Nothing open." />
      </Grid>
      <Grid>
        <ListCard title="Waiting" rows={waiting} empty="Nothing waiting." />
        <ListCard title="Day report" rows={report} empty="No sites." />
      </Grid>
    </>
  );
}

// ---------- HR ----------
export function HrHome() {
  const staffList = svc.people();
  const onLeave = state.db.LEAVES.filter((l) => l.status === 'approved' && l.from <= TODAY && l.to >= TODAY).map((l) => l.userId);
  const present = staffList.filter((u) => state.db.ATTENDANCE_TODAY.some((a) => a.userId === u.id && a.in));
  const absent = staffList.filter((u) => !present.includes(u) && !onLeave.includes(u.id));
  const att = [
    <LinkRow key="in" to="#/people?tab=attendance" trail={present.length}>Checked in · {present.map((u) => first(u.id)).join(', ') || 'no one'}</LinkRow>,
    <Item key="lv"><Grow>On leave · {onLeave.map((id) => first(id)).join(', ') || 'no one'}</Grow><Small>{onLeave.length}</Small></Item>,
    <Item key="ab"><Grow>Not in yet · {absent.map((u) => first(u.id)).join(', ') || 'no one'}</Grow><Small>{absent.length}</Small></Item>,
  ];
  const leaves = svc.leaves({ status: 'pending' }).map((l) => {
    const stand = svc.standIns(l.userId);
    return (
      <Item key={l.id}>
        <Grow>
          <b>{name(l.userId)}</b> · {l.type}, {plural(l.days, 'day')} from {fmtD(l.from)}<br />
          <small className="text-ink-3">{l.reason || 'No reason given'}{stand.length ? ` · stand-in ${stand.map((x) => first(x.u.id)).join(', ')}` : ''}</small>
        </Grow>
        <DLink to="#/people?tab=leaves">Details</DLink>
        <Btn sm kind="primary" onClick={() => openDialog({ kind: 'leave-approve', id: l.id })}>Approve</Btn>
        <Btn sm onClick={() => leaveNo(l.id)}>Reject</Btn>
      </Item>
    );
  });
  const pend = state.db.EXPENSES.filter((e) => e.status === 'pending');
  const noBill = pend.filter((e) => !e.msgId);
  const d = new Date(TODAY);
  const salary = new Date(d.getFullYear(), d.getMonth() + 1, state.db.AGENCY?.salaryDay || 1);
  const month = [
    <LinkRow key="b" to="#/people?tab=expenses">Bills awaiting partner · {pend.length}, {inr(pend.reduce((a, e) => a + e.amount, 0))}</LinkRow>,
    <LinkRow key="s" to="#/people?tab=salary">Salary run · {fmtD(salary.toISOString().slice(0, 10))}</LinkRow>,
    <Item key="n"><Grow>Claims without a bill · {noBill.length}{noBill.length ? ` · ${noBill.map((e) => first(e.userId)).join(', ')}` : ''}</Grow></Item>,
  ];
  const coming = [
    ...state.db.HOLIDAYS.filter((h) => h.date >= TODAY).slice(0, 3).map((h) => (
      <Item key={`h${h.date}`}><Grow>Holiday · {h.name}</Grow><Small>{fmtD(h.date)}</Small></Item>
    )),
    ...state.db.LEAVES.filter((l) => l.status === 'approved' && l.from > TODAY).slice(0, 3).map((l) => (
      <Item key={`l${l.id}`}><Grow>Leave · {name(l.userId)}, {plural(l.days, 'day')}</Grow><Small>{fmtD(l.from)}</Small></Item>
    )),
  ];
  return (
    <>
      <Grid>
        <ListCard title="Attendance today" rows={att} empty="" />
        <ListCard title="Leave to approve" rows={leaves} empty="Nothing pending." />
      </Grid>
      <Grid>
        <ListCard title="This month" rows={month} empty="" />
        <ListCard title="Coming up" rows={coming} empty="Nothing scheduled." />
      </Grid>
    </>
  );
}

// ---------- client ----------
function ClientFilesCard({ p }) {
  const entry = NAS_TREE.entries.find((e) => e.map === `Project ${p.id}`);
  const mine = entry ? state.desk.shares.filter((s) => s.path.startsWith(`Projects/${entry.p}/`)) : [];
  return (
    <Card title="Files shared with you" className="mb-3.5">
      <List empty="Nothing shared yet. Ask in chat and the studio sends a link.">
        {mine.map((s) => (
          <Item key={s.path + s.at}>
            <Grow><Mono>{s.path.split('/').pop()}</Mono> · from {first(s.by)}, {fmtD(s.at)}</Grow>
            <Btn sm onClick={() => fileOpen(s.path)}>Open</Btn>
          </Item>
        ))}
      </List>
    </Card>
  );
}
const HdrRow = ({ title, children }) => (
  <div className="mb-[18px] flex flex-wrap items-end justify-between gap-4">
    <h1 className="m-0 text-[30px] font-semibold leading-tight tracking-tight">{title}</h1>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
);
export function ClientHome() {
  const p = svc.projects()[0];
  const next = p.milestones.find((m) => !m.done && m.clientVisible);
  const pending = [
    ...svc.materials({ projectId: p.id }).filter((m) => m.status === 'client_pending' && m.clientVisible).map((m) => [`Approve material · ${m.name}`, '#/samples']),
    ...state.db.CHANGES.filter((c) => c.projectId === p.id && c.status === 'awaiting_client').map((c) => [`Change order ${c.no} · ${c.title} · ${inr(c.cost)}`, `#/projects/${p.id}?tab=changes`]),
    ...state.desk.selections.filter((s) => s.projectId === p.id && s.clientStatus === 'pending').map((s) => [`Choose · ${s.item}: ${s.options.join(' or ')}`, '#/samples']),
  ];
  const meeting = state.db.MEETINGS.find((m) => m.projectId === p.id && m.kind === 'client');
  const photos = svc.feed(p.siteId).filter((f) => f.type === 'photo').slice(0, 4);
  return (
    <>
      <HdrRow title={p.name}><DLink to="#/chats">Message the studio</DLink></HdrRow>
      <div className="mb-3.5 grid grid-cols-2 gap-1.5 md:grid-cols-4 lg:grid-cols-6">
        {PHASES.map((n, i) => (
          <div
            key={n}
            className={`rounded-r1 border px-2.5 py-2 text-center text-[13px] font-medium ${i < p.phase ? 'border-accent-soft bg-accent-soft text-accent-text' : i === p.phase ? 'border-accent bg-accent text-accent-ink' : 'border-line text-ink-3'}`}
          >
            {n}
          </div>
        ))}
      </div>
      <Grid>
        <Card title="Waiting for you">
          <List empty="Nothing waiting on you.">
            {pending.map(([t, h], i) => <LinkRow key={i} to={h}>{t}</LinkRow>)}
          </List>
        </Card>
        <Card title="Next milestone">
          {next ? <p><b>{next.name}</b><br /><span className="text-ink-3">{fmtD(next.date)}</span></p> : <p>All done.</p>}
          <h2 className="mb-2.5 mt-0 text-lg font-semibold">This week</h2>
          <p>{meeting?.summary || ''}</p>
        </Card>
      </Grid>
      <MeetingsCard p={p} />
      <ClientFilesCard p={p} />
      <Card title="Latest from site" className="mb-3.5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {photos.map((f, i) => (
            <figure key={i} className="m-0">
              <PhCanvas hue={f.hue} seed={f.seed} />
              <figcaption className="mt-1 text-[13px]">{f.text}<br /><small className="text-ink-3">{fmtD(f.at)}</small></figcaption>
            </figure>
          ))}
        </div>
      </Card>
      {svc.portfolio().length > 0 && (
        <LinkRow to="#/portfolio"><b>Studio portfolio</b><br /><small className="text-ink-3">See other work by the studio.</small></LinkRow>
      )}
    </>
  );
}

// ---------- contractor ----------
function latestIssued() {
  const by = {};
  state.db.TRANSMITTALS.filter((t) => t.to === state.userId).forEach((t) => {
    if (!by[t.no] || by[t.no].at < t.at) by[t.no] = t;
  });
  return Object.values(by).sort((a, b) => (a.at < b.at ? 1 : -1));
}
export function ContractorHome() {
  const s = svc.sites()[0];
  const open = svc.issues().filter((i) => i.status !== 'closed');
  const my = svc.snags(s.id).filter((n) => n.contractorId === state.userId && n.status !== 'closed');
  const ck = state.desk.checklists.filter((c) => c.siteId === s.id);
  return (
    <>
      <HdrRow title={s.name}><DLink to="#/chats">Site chat</DLink></HdrRow>
      <Kpis>
        <Kpi label="Progress" value={`${s.progress}%`} />
        <Kpi label="Open issues" value={open.length} crit={!!open.length} />
        <Kpi label="My snags" value={my.length} />
        <Kpi label="Next checklist" value={ck[0] ? fmtD(ck[0].due) : '—'} />
      </Kpis>
      <Grid>
        <Card title="Snags for you">
          <DataTable cols={['Snag', 'Status']} rows={my.map((n) => [n.text, <StatusPill status={n.status} />])} />
        </Card>
        <Card title="Drawings folder">
          <p className="mt-0 text-[13px] text-ink-3">Latest issued revision per sheet. Older revisions are hidden.</p>
          <DataTable
            cols={['Drawing', 'Rev', 'Issued', '']}
            rows={latestIssued().map((t) => [t.no, t.rev, fmtD(t.at), <ViewBtn no={t.no} projectId={t.projectId} />])}
          />
        </Card>
      </Grid>
    </>
  );
}

