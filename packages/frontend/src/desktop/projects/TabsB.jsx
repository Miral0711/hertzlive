import { state, svc, can, toast, persist, render, uid, fmtD, fmtDT, inr, user } from '../../shared/core.js';
import { TODAY } from '../../shared/data.js';
import { addDays } from '../../shared/liveDates.js';
import { seedFilings } from '../../shared/filing.js';
import { FEES, FEE_STAGES } from '../../shared/data2.js';
import { Btn, Card, DataTable, Empty, Kpi, Kpis, Bar, Select, StatusPill } from '../../ui/ui';
import { DLink } from '../nav';
import Icon from '../../ui/Icon';
import { filedRows } from '../parts';
import { FINISHES } from '../data.js';
import { P, V, first } from '../helpers';
import { AssistCompareButton } from '../chat/assist';
import {
  role, staff, FromChat, Ph, Sub, H2, Hdr, Mono,
} from './common';

// ---------- finishes ----------
function finishAsk(id) {
  if (!can('material', 'w')) return;
  const f = FINISHES.find((x) => x.id === id);
  f.clientStatus = 'asked';
  const t = state.db.THREADS.find((x) => x.kind === 'client' && x.projectId === f.projectId);
  if (t) {
    svc.addMessage(t.id, { text: `Please choose: ${f.item}, ${f.spec} (${inr((f.qty || 1) * (f.unitCost || f.cost))}).` });
  }
  persist();
  toast('Asked the client to choose.');
}
function finishSelect(id, ok) {
  const f = FINISHES.find((x) => x.id === id);
  f.clientStatus = ok ? 'selected' : 'rejected';
  persist();
  toast(ok ? 'Selected.' : 'Noted. Studio will offer another option.');
}
export function FinishesTab({ p }) {
  const rows = FINISHES.filter((f) => f.projectId === p.id);
  const total = rows.reduce((a, f) => a + (f.qty || 1) * (f.unitCost || f.cost), 0);
  return (
    <Card>
      <Hdr>
        <h2 className="m-0 text-lg font-semibold">Finishes and furniture schedule</h2>
        <AssistCompareButton projectId={p.id} />
      </Hdr>
      <Sub>Everything specified by room, with cost and where it stands.</Sub>
      <DataTable
        cols={['Room', 'Item', 'Specification', 'Vendor', 'Qty', '₹Unit', '₹Total', 'Status', 'Client status', '']}
        rows={rows.map((f) => [
          f.room, f.item, f.spec, V(f.vendorId).name, f.qty || 1,
          inr(f.unitCost || f.cost), inr((f.qty || 1) * (f.unitCost || f.cost)),
          <StatusPill status={f.status} />,
          <StatusPill status={f.clientStatus || 'pending'} />,
          role() === 'client'
            ? f.clientStatus === 'asked'
              ? (
                <div className="flex items-center gap-2.5">
                  <Btn sm kind="primary" onClick={() => finishSelect(f.id, true)}>Select</Btn>
                  <Btn sm onClick={() => finishSelect(f.id, false)}>Reject</Btn>
                </div>
              )
              : ''
            : can('material', 'w') && (!f.clientStatus || f.clientStatus === 'pending')
              ? <Btn sm onClick={() => finishAsk(f.id)}>Ask client to choose</Btn>
              : '',
        ])}
      />
      <p className="text-ink-3">Total specified: {inr(total)}.</p>
      <H2>Samples mentioned in chat</H2>
      <DataTable
        cols={['Who', 'Message', 'Room', '']}
        rows={filedRows({ projectId: p.id, kind: 'sample' }).map((x) => [first(x.m.by), x.m.text, x.room || '', <FromChat msgId={x.m.id} />])}
      />
    </Card>
  );
}

// ---------- selections ----------
function choose(e, id) {
  e.preventDefault();
  const s = state.desk.selections.find((x) => x.id === id);
  s.chosen = Object.fromEntries(new FormData(e.currentTarget)).o;
  s.clientStatus = 'approved';
  const t = state.db.THREADS.find((x) => x.kind === 'client' && x.projectId === s.projectId);
  if (t && svc.thread(t.id)) {
    svc.addMessage(t.id, { text: `Decision: ${s.item}, ${s.chosen}`, decision: true });
    seedFilings();
  }
  persist();
  toast('Choice saved.');
}
function poRaise(id) {
  const s = state.desk.selections.find((x) => x.id === id);
  const fin = FINISHES.find((f) => f.projectId === s.projectId && f.item.toLowerCase().includes(s.item.split(' ')[1]?.toLowerCase() || ''));
  s.po = {
    no: 'PO-' + P(s.projectId).code.slice(3) + '-' + String(10 + state.desk.selections.filter((x) => x.po).length),
    vendorId: fin?.vendorId || 'v5',
    amount: fin?.cost || 0,
    status: 'draft',
    eta: null,
  };
  svc.log('PO raised · ' + s.po.no, 'Selection ' + s.id);
  persist();
  toast('Purchase order drafted.');
}
export function SelectionsTab({ p }) {
  return (
    <Card title="Client selections">
      <DataTable
        cols={['Item', 'Options', 'Chosen', 'Client', 'Purchase order', 'Vendor', '₹Amount', 'PO status', 'ETA']}
        rows={state.desk.selections.filter((s) => s.projectId === p.id).map((s) => [
          s.item,
          s.options.join(' / '),
          s.chosen
            ? s.chosen
            : role() === 'client'
              ? (
                <form className="flex items-center gap-2.5" onSubmit={(e) => choose(e, s.id)}>
                  <Select name="o" aria-label="Option">{s.options.map((o) => <option key={o}>{o}</option>)}</Select>
                  <Btn sm kind="primary" type="submit">Choose</Btn>
                </form>
              )
              : <span className="text-ink-3">Waiting for client</span>,
          <StatusPill status={s.clientStatus} />,
          s.po
            ? <Mono>{s.po.no}</Mono>
            : staff() && s.chosen && can('material', 'a')
              ? <Btn sm onClick={() => poRaise(s.id)}>Raise PO</Btn>
              : '—',
          s.po ? V(s.po.vendorId).name : '',
          s.po ? inr(s.po.amount) : '',
          s.po ? <StatusPill status={s.po.status} /> : '',
          s.po?.eta ? fmtD(s.po.eta) : '',
        ])}
      />
    </Card>
  );
}

// ---------- checklists ----------
function ckDone(ckId, i) {
  const c = state.desk.checklists.find((x) => x.id === ckId);
  c.items[i][1] = true;
  c.items[i][2] = state.userId;
  persist();
  toast('Ticked.');
}
export function StageChecklists({ siteIds }) {
  const cks = state.desk.checklists.filter((c) => siteIds.includes(c.siteId));
  if (!cks.length) return <Empty>No checklists for this stage.</Empty>;
  return cks.map((c) => {
    const done = c.items.filter((i) => i[1]).length;
    return (
      <Card key={c.id} className="mb-3.5">
        <Hdr>
          <h2 className="m-0 text-lg font-semibold">{c.stage}</h2>
          <span className="text-ink-3">Due {fmtD(c.due)} · {done} of {c.items.length} done</span>
        </Hdr>
        <Bar value={Math.round((done / c.items.length) * 100)} />
        <div className="mt-2.5">
          <DataTable
            cols={['Check', 'Done', 'By', '']}
            rows={c.items.map((it, i) => [
              it[0],
              <StatusPill status={it[1] ? 'done' : 'open'} />,
              it[2] ? first(it[2]) : '',
              !it[1] && staff() ? <Btn sm onClick={() => ckDone(c.id, i)}>Tick</Btn> : '',
            ])}
          />
        </div>
      </Card>
    );
  });
}
export function ChecklistsTab({ p }) {
  return <StageChecklists siteIds={state.db.SITES.filter((s) => s.projectId === p.id).map((s) => s.id)} />;
}

// ---------- budget ----------
function budgetToggle(id) {
  const p = P(id);
  p.budgetVisible = !p.budgetVisible;
  persist();
  render();
}
export function BudgetTab({ p }) {
  const ratio = (a, b) => a / b;
  return (
    <>
      <Kpis>
        <Kpi label="Budget" value={inr(p.budget)} />
        <Kpi label="Spent" value={inr(p.actual)} />
        <Kpi label="Used" value={Math.round((p.actual / p.budget) * 100) + '%'} crit={p.actual / p.budget > 0.8} />
        <Kpi label="Fee" value={inr(FEES[p.id] || 0)} />
      </Kpis>
      <Card title="By head">
        <DataTable
          cols={['Head', '₹Budget', '₹Spent', 'Used', '']}
          rows={p.budgetLines.map((l) => [
            l.head, inr(l.budget), inr(l.actual), Math.round(ratio(l.actual, l.budget) * 100) + '%',
            <div className="min-w-[80px]"><Bar value={Math.round(ratio(l.actual, l.budget) * 100)} tone={ratio(l.actual, l.budget) > 0.9 ? 'crit' : ratio(l.actual, l.budget) > 0.75 ? 'warn' : ''} /></div>,
          ])}
        />
        <p className="mb-0 mt-4 flex flex-wrap items-center gap-2.5 text-ink-3">
          Client can see budget: {P(p.id).budgetVisible ? 'Yes' : 'No'}.{' '}
          <Btn sm onClick={() => budgetToggle(p.id)}>{P(p.id).budgetVisible ? 'Hide from client' : 'Show to client'}</Btn>
        </p>
      </Card>
    </>
  );
}

// ---------- fees ----------
function raiseInvoice(projectId, st) {
  const p = P(projectId);
  state.db.INVOICES.push({
    id: uid(),
    projectId: p.id,
    no: 'HA/26-27/0' + (34 + state.db.INVOICES.length - 6),
    stage: st,
    amount: Math.round((FEES[p.id] * FEE_STAGES[st].pct) / 100),
    status: 'sent',
    issued: TODAY,
    due: addDays(TODAY, 15),
    paid: null,
  });
  svc.log('Invoice raised · ' + p.name, 'Project ' + p.id);
  persist();
  toast('Invoice raised.');
}
export function FeesTab({ p }) {
  const fee = FEES[p.id] || 0;
  const inv = state.db.INVOICES.filter((i) => i.projectId === p.id);
  const billed = inv.reduce((a, i) => a + i.amount, 0);
  const earned = FEE_STAGES.filter((s) => s.phase < p.phase).reduce((a, s) => a + (fee * s.pct) / 100, 0)
    + ((fee * (FEE_STAGES[p.phase]?.pct || 0)) / 100) * 0.5;
  return (
    <>
      <Kpis>
        <Kpi label="Agreed fee" value={inr(fee)} />
        <Kpi label="Earned so far" value={inr(earned)} />
        <Kpi label="Invoiced" value={inr(billed)} />
        <Kpi label="Work in progress" value={inr(Math.max(0, earned - billed))} crit={earned - billed > 100000} />
      </Kpis>
      <Card title="Fee stages">
        <DataTable
          cols={['Stage', 'Share', '₹Amount', 'Invoice', 'Status']}
          rows={FEE_STAGES.map((s) => {
            const i = inv.find((x) => x.stage === s.phase);
            return [
              s.name,
              s.pct + '%',
              inr((fee * s.pct) / 100),
              i
                ? <Mono>{i.no}</Mono>
                : s.phase < p.phase
                  ? <Btn sm onClick={() => raiseInvoice(p.id, s.phase)}>Raise invoice</Btn>
                  : '—',
              i
                ? <StatusPill status={i.status} />
                : s.phase < p.phase
                  ? <StatusPill status="not billed" />
                  : s.phase === p.phase ? <StatusPill status="in progress" /> : '',
            ];
          })}
        />
      </Card>
    </>
  );
}

// ---------- team ----------
export function TeamTab({ p }) {
  const folders = svc.peopleFolder(p.id);
  return (
    <div className="grid gap-gap-lg">
      <Card>
        <Hdr><h2 className="m-0 text-lg font-semibold">Team</h2><span className="text-[13px] text-ink-3">{p.teamIds.length} people</span></Hdr>
        <DataTable
          cols={['Person', 'Role', 'Skills', 'Hours last week', 'In today']}
          rows={p.teamIds.map((id) => {
            const u = user(id);
            const a = state.db.ATTENDANCE_TODAY.find((x) => x.userId === id);
            return [
              <b className="font-medium">{u.name}</b>,
              u.title || u.role,
              (u.skills || []).join(', '),
              state.db.TIMESHEETS.filter((t) => t.userId === id && t.projectId === p.id).reduce((s, t) => s + t.hours, 0),
              a?.in ? <StatusPill status={'in ' + a.in} /> : a?.mark === 'leave' ? <StatusPill status="on leave" /> : '—',
            ];
          })}
        />
      </Card>
      <Card>
        <Hdr><h2 className="m-0 text-lg font-semibold">Contractors on site</h2></Hdr>
        <DataTable
          cols={['Firm', 'Trade', 'Rating', 'Phone']}
          rows={state.db.VENDORS.filter((v) => (v.projects || []).includes(p.id)).map((v) => [
            <b className="font-medium">{v.name}</b>, v.trade, <span className="text-warn">{'★'.repeat(v.rating)}</span>, staff() ? v.phone : 'via studio',
          ])}
        />
      </Card>
      <div>
        <h2 className="mb-3 mt-0 text-lg font-semibold">People folder</h2>
        <div className="grid items-start gap-gap-lg lg:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
          {folders.filter((g) => g.people.length > 0).map((g) => (
            <Card key={g.name}>
              <Hdr><h3 className="m-0 text-base font-semibold">{g.name}</h3><span className="text-[13px] text-ink-3">{g.people.length}</span></Hdr>
              <div className="divide-y divide-line">
                {g.people.map((x) => (
                  <div key={x.name + (x.title || '')} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-text">{x.name.slice(0, 1)}</span>
                    <span className="min-w-0 flex-1"><b className="block truncate font-medium">{x.name}</b><small className="block truncate text-ink-3">{x.title || ''}</small></span>
                    <small className="flex-none text-right text-ink-3">{x.last ? fmtDT(x.last) : '—'}</small>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- decisions ----------
export function DecisionsTab({ p }) {
  const fromChatD = filedRows({ projectId: p.id, kind: 'decision' });
  const items = [
    ...p.decisions.map((d) => ({ text: d, source: 'Project record', kind: 'Record', link: null })),
    ...fromChatD.map((x) => ({ text: x.m.text, source: `${first(x.m.by)} · ${fmtD(x.m.at)}`, kind: 'Chat', link: <FromChat msgId={x.m.id} /> })),
    ...state.db.MEETINGS.filter((m) => m.projectId === p.id && m.approved).map((m) => ({
      text: m.summary,
      source: fmtD(m.at),
      kind: 'Meeting',
      link: <DLink to={`#/projects/${p.id}?tab=meetings`} className="font-medium text-accent-text no-underline hover:underline">Open meeting</DLink>,
    })),
  ];
  const tone = { Record: 'bg-accent-soft text-accent-text', Chat: 'bg-ok-soft text-ok', Meeting: 'bg-warn-soft text-warn' };
  return (
    <Card>
      <Hdr>
        <h2 className="m-0 text-lg font-semibold">Decisions</h2>
        <span className="text-[13px] text-ink-3">{items.length} pinned</span>
      </Hdr>
      <Sub>Pinned decisions from chat and meetings. Nothing here changes without a new decision.</Sub>
      {items.length === 0 ? <Empty>No decisions pinned yet.</Empty> : (
        <ul className="m-0 list-none divide-y divide-line overflow-hidden rounded-r3 border border-line p-0">
          {items.map((d, i) => (
            <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-surface px-4 py-3">
              <span className={`w-[4.75rem] flex-none rounded-full text-center text-xs font-semibold leading-6 ${tone[d.kind]}`}>{d.kind}</span>
              <div className="min-w-[220px] flex-1">
                <p className="m-0 font-medium leading-snug">{d.text}</p>
                <small className="text-ink-3">{d.source}</small>
              </div>
              {d.link && <div className="flex-none">{d.link}</div>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------- moodboard ----------
function toBoard(msgId) {
  if (!svc.fileToMoodboard(msgId)) return toast(state.storageError || 'Could not save to moodboard. Try again.');
  toast('Added to moodboard.');
}
export function MoodboardTab({ p }) {
  const items = svc.moodboard(p.id);
  const links = filedRows({ projectId: p.id, kind: 'link' }).filter((x) => !x.m.filed);
  return (
    <Card>
      <Hdr>
        <h2 className="m-0 text-lg font-semibold">Moodboard</h2>
        <AssistCompareButton projectId={p.id} />
      </Hdr>
      <p className="mb-4 mt-0 text-[13px] text-ink-3">For optional finish palettes, open a photo in its conversation and choose Explore finishes.</p>
      {items.length ? (
        <div className="grid gap-gap [grid-template-columns:repeat(auto-fill,minmax(210px,1fr))]">
          {items.map((b) => (
            <figure key={b.id ?? b.title} className="m-0 flex flex-col overflow-hidden rounded-r3 border border-line bg-surface transition hover:border-accent hover:shadow-s1">
              <div className="aspect-[4/3] overflow-hidden bg-surface-2 [&_canvas]:!h-full [&_canvas]:w-full [&_canvas]:object-cover [&>div]:h-full">
                <Ph hue={b.hue} seed={b.seed} ar={1.333} />
              </div>
              <figcaption className="flex flex-1 flex-col items-start gap-2 p-3">
                <span className="text-[14px] font-medium leading-snug">{b.title}</span>
                {b.decided && <StatusPill status="decided" />}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : <Empty>No references yet.</Empty>}
      {links.length > 0 && (
        <>
          <div className="mt-6"><H2>References shared in chat, not yet on the board</H2></div>
          <DataTable
            cols={['Who', 'Reference', '', '']}
            rows={links.map((x) => [
              first(x.m.by), x.m.link.title,
              <Btn sm onClick={() => toBoard(x.m.id)}>Add to moodboard</Btn>,
              <FromChat msgId={x.m.id} />,
            ])}
          />
        </>
      )}
    </Card>
  );
}

// ---------- handover ----------
export function HandoverTab({ p }) {
  const docs = state.db.DOCS.filter((d) => d.projectId === p.id && ['Warranty', 'As-built', 'Approval'].includes(d.kind));
  const snags = state.db.SNAGS.filter((n) => n.siteId === p.siteId);
  return (
    <Card title="Handover pack">
      <Sub>Warranties, as-builts, approvals and the final snag list. Ready when everything is green.</Sub>
      <ul className="m-0 list-none divide-y divide-line overflow-hidden rounded-r3 border border-line p-0">
        {[
          ['Warranties and manuals', docs.some((d) => d.kind === 'Warranty') ? 'received' : 'pending'],
          ['As-built drawings', docs.some((d) => d.kind === 'As-built') ? 'received' : 'pending'],
          ['Statutory approvals', docs.some((d) => d.kind === 'Approval') ? 'received' : 'pending'],
          ['Snags closed', snags.every((n) => n.status === 'closed') ? 'done' : `${snags.filter((n) => n.status !== 'closed').length} open`],
          ['Final invoice', state.db.INVOICES.some((i) => i.projectId === p.id && i.stage === 4) ? 'raised' : 'pending'],
        ].map(([item, status]) => (
          <li key={item} className="flex items-center gap-3 bg-surface px-4 py-3">
            <span className={`grid h-8 w-8 flex-none place-items-center rounded-full ${/received|done|raised/.test(status) ? 'bg-ok-soft text-ok' : /open/.test(status) ? 'bg-crit-soft text-crit' : 'bg-warn-soft text-warn'}`}>
              <Icon name={/received|done|raised/.test(status) ? 'check' : 'clock'} small />
            </span>
            <span className="min-w-0 flex-1 font-medium">{item}</span>
            <StatusPill status={status} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
