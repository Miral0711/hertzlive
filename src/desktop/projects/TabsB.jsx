import { state, svc, can, toast, persist, render, uid, fmtD, fmtDT, inr, user } from '../../shared/core.js';
import { TODAY } from '../../shared/data.js';
import { seedFilings } from '../../shared/filing.js';
import { FEES, FEE_STAGES } from '../../shared/data2.js';
import { Btn, Card, DataTable, Empty, Kpi, Kpis, Bar, Select, StatusPill } from '../../ui/ui';
import { DLink } from '../nav';
import { filedRows } from '../parts';
import { FINISHES } from '../data.js';
import { P, V, first } from '../helpers';
import { AssistCompareButton } from '../chat/assist';
import {
  role, staff, FromChat, Ph, Photos, Figure, Sub, H2, H3, Hdr, Mono,
} from './common';

// ---------- finishes ----------
function finishAsk(id) {
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
            : !f.clientStatus || f.clientStatus === 'pending'
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
        <p className="text-ink-3">
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
    due: '2026-09-24',
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
  return (
    <Card title="Team">
      <DataTable
        cols={['Person', 'Role', 'Skills', 'Hours last week', 'In today']}
        rows={p.teamIds.map((id) => {
          const u = user(id);
          const a = state.db.ATTENDANCE_TODAY.find((x) => x.userId === id);
          return [
            u.name,
            u.title || u.role,
            (u.skills || []).join(', '),
            state.db.TIMESHEETS.filter((t) => t.userId === id && t.projectId === p.id).reduce((s, t) => s + t.hours, 0),
            a?.in ? <StatusPill status={'in ' + a.in} /> : a?.mark === 'leave' ? <StatusPill status="on leave" /> : '—',
          ];
        })}
      />
      <H2>Contractors on site</H2>
      <DataTable
        cols={['Firm', 'Trade', 'Rating', 'Phone']}
        rows={state.db.VENDORS.filter((v) => (v.projects || []).includes(p.id)).map((v) => [
          v.name, v.trade, '★'.repeat(v.rating), staff() ? v.phone : 'via studio',
        ])}
      />
      <H2>People folder</H2>
      {svc.peopleFolder(p.id).map((g) => (
        <div key={g.name}>
          <H3>{g.name}</H3>
          <DataTable
            cols={['Name', 'Title', 'Last active']}
            rows={g.people.map((x) => [x.name, x.title || '', x.last ? fmtDT(x.last) : '—'])}
          />
        </div>
      ))}
    </Card>
  );
}

// ---------- decisions ----------
export function DecisionsTab({ p }) {
  const fromChatD = filedRows({ projectId: p.id, kind: 'decision' });
  return (
    <Card title="Decisions">
      <Sub>Pinned decisions from chat and meetings. Nothing here changes without a new decision.</Sub>
      <DataTable
        cols={['Decision', 'Source', '']}
        rows={[
          ...p.decisions.map((d) => [d, 'Project record', '']),
          ...fromChatD.map((x) => [x.m.text, `Chat · ${first(x.m.by)} · ${fmtD(x.m.at)}`, <FromChat msgId={x.m.id} />]),
          ...state.db.MEETINGS.filter((m) => m.projectId === p.id && m.approved).map((m) => [
            m.summary,
            `Meeting · ${fmtD(m.at)}`,
            <DLink to={`#/projects/${p.id}?tab=meetings`} className="text-accent-text underline">Meeting</DLink>,
          ]),
        ]}
      />
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
      <p className="text-ink-3">For optional finish palettes, open a photo in its conversation and choose Explore finishes.</p>
      {items.length ? (
        <Photos>
          {items.map((b) => (
            <Figure key={b.id ?? b.title} caption={<>{b.title}{b.decided && <> <StatusPill status="decided" /></>}</>}>
              <Ph hue={b.hue} seed={b.seed} ar={b.tall ? 0.8 : 1.333} />
            </Figure>
          ))}
        </Photos>
      ) : <Empty>No references yet.</Empty>}
      {links.length > 0 && (
        <>
          <H2>References shared in chat, not yet on the board</H2>
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
      <DataTable
        cols={['Item', 'Status']}
        rows={[
          ['Warranties and manuals', <StatusPill status={docs.some((d) => d.kind === 'Warranty') ? 'received' : 'pending'} />],
          ['As-built drawings', <StatusPill status={docs.some((d) => d.kind === 'As-built') ? 'received' : 'pending'} />],
          ['Statutory approvals', <StatusPill status={docs.some((d) => d.kind === 'Approval') ? 'received' : 'pending'} />],
          ['Snags closed', <StatusPill status={snags.every((n) => n.status === 'closed') ? 'done' : `${snags.filter((n) => n.status !== 'closed').length} open`} />],
          ['Final invoice', <StatusPill status={state.db.INVOICES.some((i) => i.projectId === p.id && i.stage === 4) ? 'raised' : 'pending'} />],
        ]}
      />
    </Card>
  );
}
