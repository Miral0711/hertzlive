// Feature module: money (money, vendors, sign pages + estimate/proposal/raise-vendor/invoice/invoice-nudge dialogs).
import {
  state, svc, can, go, toast, render, persist, inr, fmtD, fmtDT, uid, AIProvider, user,
} from '../../shared/core.js';
import { TODAY } from '../../shared/data.js';
import { FEES, FEE_STAGES, HOURLY } from '../../shared/data2.js';
import { seedFilings } from '../../shared/filing.js';
import {
  Btn, Card, Grid2, Row, PageHeader, Empty, Tabs, Field, Input, Select, Textarea,
  DataTable, StatusPill, Pill, Item,
} from '../../ui/ui';
import { DLink, href } from '../nav';
import { P, V, days, first, role } from '../helpers';
import { PROPOSALS, msFor, INVOICE_MS } from '../data';
import Modal, { ModalActions } from '../Modal';
import { openDialog, closeDialog, formData } from '../session';
import { Stat, SecHead } from '../studio/common';
import { useState } from 'react';

const mono = (s) => <span className="font-mono">{s}</span>;

// ---------- helpers ported from the prototype ----------
const ym = (d) => (d || '').slice(0, 7);
function monthsBack(n) {
  const [y, m] = TODAY.split('-').map(Number);
  return Array.from({ length: n }, (_, k) => {
    const d = new Date(y, m - 1 - (n - 1 - k), 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  });
}
const cashRow = (mo) => ({
  mo,
  label: new Date(mo + '-01').toLocaleString('en-IN', { month: 'short' }),
  planned: state.db.INVOICES.filter((i) => ym(i.due) === mo).reduce((a, i) => a + i.amount, 0),
  got: state.db.INVOICES.filter((i) => i.paid && ym(i.paid) === mo).reduce((a, i) => a + i.amount, 0),
});
function deliveryFacts(g) {
  const known = Number.isFinite(g.ordered) && g.ordered > 0 && Number.isFinite(g.qty) && g.qty >= 0 && !!g.unit;
  const remaining = known ? Math.max(0, Number((g.ordered - g.qty).toPrecision(12))) : null;
  return { known, remaining };
}

function CashChart() {
  const rows = monthsBack(6).map(cashRow);
  const max = Math.max(1, ...rows.flatMap((r) => [r.planned, r.got]));
  const h = (v) => Math.max(2, Math.round((v / max) * 100));
  const totalGot = rows.reduce((a, r) => a + r.got, 0);
  const totalDue = rows.reduce((a, r) => a + r.planned, 0);
  return (
    <Card title="Cash in vs due, last 6 months">
      <div className="mb-3 flex flex-wrap gap-6 text-[13px]">
        <span><b className="block text-xl font-semibold text-accent-text">{inr(totalGot)}</b><span className="text-ink-3">received</span></span>
        <span><b className="block text-xl font-semibold">{inr(totalDue)}</b><span className="text-ink-3">due by invoice date</span></span>
      </div>
      <div role="img" aria-label="Cash received against invoices due, by month" className="flex h-44 items-end gap-3 border-b border-line">
        {rows.map((r) => (
          <div key={r.mo} className="flex h-full flex-1 flex-col items-center justify-end">
            <div className="flex h-full w-full items-end justify-center gap-1.5">
              <i className="block w-4 rounded-t bg-surface-3" style={{ height: `${r.planned ? h(r.planned) : 0}%` }} title={`Due ${inr(r.planned)}`} />
              <i className="block w-4 rounded-t bg-accent" style={{ height: `${r.got ? h(r.got) : 0}%` }} title={`Received ${inr(r.got)}`} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-3">{rows.map((r) => <span key={r.mo} className="flex-1 text-center text-xs text-ink-3">{r.label}</span>)}</div>
      <p className="mb-0 mt-3 text-[13px] text-ink-3">
        <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-surface-3" /> Due by invoice date{' '}
        <i className="ml-3 mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-accent" /> Received
      </p>
    </Card>
  );
}

// ---------- actions ----------
function pay(id) {
  const i = state.db.INVOICES.find((x) => x.id === id);
  i.status = 'paid';
  i.paid = TODAY;
  svc.log('Payment recorded · ' + i.no, 'Invoice ' + i.id);
  persist();
  toast('Payment recorded.');
}
function chase(id) {
  const i = state.db.INVOICES.find((x) => x.id === id);
  const t = state.db.THREADS.find((x) => x.kind === 'client' && x.projectId === i.projectId);
  if (t) {
    svc.addMessage(t.id, {
      text: `Gentle reminder: invoice ${i.no} for ${inr(i.amount)} was due on ${fmtD(i.due)}. Please let us know if anything is holding it up.`,
    });
  }
  seedFilings();
  toast('Reminder sent in client chat.');
}
function tallyCopy(id) {
  const list = id ? state.db.INVOICES.filter((i) => i.id === id) : state.db.INVOICES;
  navigator.clipboard?.writeText(svc.tallyCsv(list));
  toast(`Copied ${list.length} invoice${list.length === 1 ? '' : 's'} as Tally CSV. Paste into a .csv file and import.`);
}
async function invoiceNudge(id) {
  const inv = state.db.INVOICES.find((x) => x.id === id);
  const dlg = { kind: 'invoice-nudge', invId: inv.id, lang: 'English', text: 'Thinking…' };
  openDialog(dlg);
  const text = await AIProvider.draftNudge(inv, 'English');
  if (state.desk.dialog === dlg) { dlg.text = text; render(); }
}
async function nudgeLang(d, lang) {
  const inv = state.db.INVOICES.find((x) => x.id === d.invId);
  d.lang = lang;
  d.text = 'Thinking…';
  render();
  const text = await AIProvider.draftNudge(inv, lang);
  if (state.desk.dialog === d) { d.text = text; render(); }
}

// ---------- money page ----------
function ClientMoney() {
  const inv = state.db.INVOICES.filter((i) => svc.myProjectIds().includes(i.projectId));
  const open = inv.filter((i) => i.status !== 'paid');
  const next = open.slice().sort((a, b) => a.due.localeCompare(b.due))[0];
  return (
    <>
      <PageHeader title="Invoices" sub="Your invoices for this project. Mark one as paid once you have paid it." />
      <div className="mb-5 grid grid-cols-2 gap-gap lg:grid-cols-4">
        <Stat label="To pay" value={inr(open.reduce((a, i) => a + i.amount, 0))} sub={`${open.length} invoice${open.length === 1 ? '' : 's'}`} tone={open.length ? 'text-warn' : 'text-ok'} />
        <Stat label="Paid" value={inr(inv.filter((i) => i.status === 'paid').reduce((a, i) => a + i.amount, 0))} sub="so far" tone="text-ok" />
        <Stat label="Next due" value={next ? fmtD(next.due) : '—'} sub={next ? next.no : 'nothing outstanding'} />
        <Stat label="All invoices" value={inv.length} sub="on your projects" />
      </div>
      <Card>
        {inv.length === 0 ? <div className="rounded-r2 bg-surface-2 px-4 py-9 text-center"><b className="block">No invoices yet</b><span className="text-[13px] text-ink-3">Invoices appear here when the studio raises them.</span></div> : (
          <DataTable
            cols={['Invoice', 'Stage', '₹Amount', 'Issued', 'Due', 'Status', '']}
            rows={inv.map((i) => [
              mono(i.no), FEE_STAGES[i.stage].name, inr(i.amount), fmtD(i.issued), fmtD(i.due),
              <StatusPill key="s" status={i.status} />,
              i.status !== 'paid' ? <Btn key="b" sm kind="primary" onClick={() => pay(i.id)}>Mark as paid</Btn> : '',
            ])}
          />
        )}
      </Card>
    </>
  );
}

function Dashboard({ unpaid, wip }) {
  const age = (i) => days(i.due, TODAY);
  const buckets = [
    ['Not due', (i) => age(i) <= 0, 'bg-secondary'],
    ['1 to 30 days', (i) => age(i) > 0 && age(i) <= 30, 'bg-warn'],
    ['31 to 60 days', (i) => age(i) > 30 && age(i) <= 60, 'bg-warn'],
    ['Over 60 days', (i) => age(i) > 60, 'bg-crit'],
  ];
  const late = unpaid.filter((i) => age(i) > 0);
  const receivable = unpaid.reduce((a, i) => a + i.amount, 0);
  const overdueAmt = late.reduce((a, i) => a + i.amount, 0);
  const fees = Object.values(FEES).reduce((a, b) => a + b, 0);
  const wipTotal = wip.reduce((a, w) => a + w.wip, 0);
  const margin = wip.length ? Math.round(wip.reduce((a, w) => a + w.margin, 0) / wip.length) : 0;
  const bucketRows = buckets.map(([l, f, c]) => { const rows = unpaid.filter(f); return { l, c, n: rows.length, amt: rows.reduce((a, i) => a + i.amount, 0) }; });
  const maxAmt = Math.max(1, ...bucketRows.map((b) => b.amt));
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-gap lg:grid-cols-4">
        <Stat label="Fees under contract" value={inr(fees)} sub={`${wip.length} projects`} />
        <Stat label="Receivable" value={inr(receivable)} sub={overdueAmt ? `${inr(overdueAmt)} overdue` : 'nothing overdue'} tone={overdueAmt ? 'text-crit' : 'text-ok'} />
        <Stat label="Work in progress" value={inr(wipTotal)} sub="earned, not yet billed" />
        <Stat label="Studio margin" value={`${margin}%`} sub="average across projects" tone={margin < 40 ? 'text-warn' : 'text-ok'} />
      </div>
      <div className="mb-3.5 grid items-start gap-gap xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <CashChart />
        <Card title="Receivables ageing">
          {bucketRows.map((b) => (
            <div key={b.l} className="border-t border-line py-2.5 first:border-t-0 first:pt-0">
              <div className="flex items-baseline justify-between gap-2"><b>{b.l}</b><span className="text-[13px] text-ink-2">{inr(b.amt)} <span className="text-ink-3">· {b.n} invoice{b.n === 1 ? '' : 's'}</span></span></div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"><i className={`block h-full rounded-full ${b.c}`} style={{ width: `${b.amt ? Math.max(4, (b.amt / maxAmt) * 100) : 0}%` }} /></div>
            </div>
          ))}
        </Card>
      </div>
      <div className="grid items-start gap-gap xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <Card title="Profitability by project">
          <DataTable
            cols={['Project', '₹Fee', '₹Team cost', 'Margin', '₹Unbilled work']}
            rows={wip.map((w) => [
              w.p.name, inr(w.fee), inr(w.cost),
              <Pill key="m" kind={w.margin < 30 ? 'crit' : w.margin < 50 ? 'warn' : 'ok'}>{w.margin}%</Pill>,
              inr(w.wip),
            ])}
          />
          <p className="mb-0 mt-2 text-[13px] text-ink-3">Team cost is hours logged times hourly rate, scaled to the month.</p>
        </Card>
        <Card title={`Chase list${late.length ? ` · ${late.length}` : ''}`}>
          <div className="flex flex-col gap-1.5">
            {late.map((i) => (
              <Item key={i.id}>
                <span className="min-w-0 grow"><b className="block truncate">{P(i.projectId).name}</b><small className="text-ink-3">{i.no} · {inr(i.amount)} · {age(i)} days late</small></span>
                <Btn sm onClick={() => chase(i.id)}>Send reminder</Btn>
              </Item>
            ))}
            {!late.length && <Empty>Nothing overdue.</Empty>}
          </div>
        </Card>
      </div>
    </>
  );
}

function Invoices({ inv }) {
  const A = state.db.AGENCY;
  const [f, setF] = useState('all');
  const isLate = (i) => i.status === 'overdue' || (i.status === 'sent' && i.due < TODAY);
  const shown = inv.filter((i) => f === 'all' || (f === 'overdue' && isLate(i)) || (f === 'unpaid' && i.status !== 'paid') || (f === 'paid' && i.status === 'paid'));
  const unpaidAmt = inv.filter((i) => i.status !== 'paid').reduce((a, i) => a + i.amount, 0);
  const lateAmt = inv.filter(isLate).reduce((a, i) => a + i.amount, 0);
  const paidAmt = inv.filter((i) => i.status === 'paid').reduce((a, i) => a + i.amount, 0);
  const chip = (on) => `inline-flex min-h-8 items-center rounded-full border px-3 text-[13px] font-semibold ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line-2 bg-surface text-ink-2 hover:border-accent hover:text-accent-text'}`;
  return (
    <>
      <SecHead title="Invoices" sub={`GST 18% on ${svc.cfg().name} fees, SAC ${A.sac || '9983'}. Same state bills CGST + SGST, other states IGST. Open an invoice for the split.`}>
        <Btn onClick={() => tallyCopy()}>Copy all for Tally</Btn>
        <Btn kind="primary" icon="plus" onClick={() => openDialog({ kind: 'raise-invoice' })}>Raise invoice</Btn>
      </SecHead>
      <div className="mb-3.5 grid grid-cols-2 gap-gap lg:grid-cols-4">
        <Stat label="Outstanding" value={inr(unpaidAmt)} sub={`${inv.filter((i) => i.status !== 'paid').length} invoices`} />
        <Stat label="Overdue" value={inr(lateAmt)} sub={`${inv.filter(isLate).length} to nudge`} tone={lateAmt ? 'text-crit' : 'text-ok'} />
        <Stat label="Paid" value={inr(paidAmt)} sub="received" tone="text-ok" />
        <Stat label="All invoices" value={inv.length} sub="raised so far" />
      </div>
      <Card>
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter invoices">
          {[['all', 'All'], ['unpaid', 'Unpaid'], ['overdue', 'Overdue'], ['paid', 'Paid']].map(([k, l]) => <button key={k} type="button" aria-pressed={f === k} className={chip(f === k)} onClick={() => setF(k)}>{l}</button>)}
        </div>
        <DataTable
          cols={['Invoice', 'Project', '₹Amount', 'Due', 'Status', 'Milestone', '']}
          rows={shown.map((i) => {
            const ms = msFor(i);
            const mss = P(i.projectId).milestones || [];
            const overdue = state.role === 'partner' && isLate(i);
            return [
              mono(i.no),
              <span key="p"><b className="block font-medium">{P(i.projectId).name}</b><small className="text-ink-3">{FEE_STAGES[i.stage].name} · issued {fmtD(i.issued)}</small></span>,
              inr(i.amount),
              <span key="d">{fmtD(i.due)}{i.paid && <small className="block text-ink-3">paid {fmtD(i.paid)}</small>}</span>,
              <StatusPill key="s" status={i.status} />,
              mss.length ? (
                <Select
                  key="m"
                  aria-label={`Milestone for ${i.no}`}
                  value={ms ? ms.id : ''}
                  onChange={(e) => { INVOICE_MS[i.id] = e.target.value; toast('Linked to milestone.'); }}
                >
                  {mss.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </Select>
              ) : '—',
              <Row key="a" className="!flex-wrap !gap-1.5">
                <Btn sm onClick={() => openDialog({ kind: 'invoice', invId: i.id })}>GST split</Btn>
                {i.status !== 'paid' && <Btn sm onClick={() => pay(i.id)}>Record payment</Btn>}
                {i.status !== 'paid' && overdue && <Btn sm onClick={() => invoiceNudge(i.id)}>Draft nudge</Btn>}
              </Row>,
            ];
          })}
        />
      </Card>
    </>
  );
}

function Changes() {
  const cs = state.db.CHANGES;
  const total = cs.reduce((a, c) => a + c.cost, 0);
  const signed = cs.filter((c) => c.signedAt);
  return (
    <>
      <SecHead title="Change orders" sub="Scope changes across all projects, with cost, time and signature status." />
      <div className="mb-3.5 grid grid-cols-2 gap-gap lg:grid-cols-4">
        <Stat label="Change orders" value={cs.length} sub="all projects" />
        <Stat label="Total value" value={inr(total)} sub="added to fees" />
        <Stat label="Signed" value={signed.length} sub={inr(signed.reduce((a, c) => a + c.cost, 0))} tone="text-ok" />
        <Stat label="Awaiting signature" value={cs.length - signed.length} sub="with the client" tone={cs.length - signed.length ? 'text-warn' : ''} />
      </div>
      <Card>
        <DataTable
          cols={['Project', 'No', 'Change', '₹Cost', 'Days', 'Status', 'Signed']}
          rows={cs.map((c) => [
            P(c.projectId).name, c.no, c.title, inr(c.cost), c.days,
            <StatusPill key="s" status={c.status} />, c.signedAt ? fmtD(c.signedAt) : '—',
          ])}
        />
      </Card>
    </>
  );
}

function Proposals() {
  const decided = PROPOSALS.filter((p) => ['won', 'lost'].includes(p.status)).length;
  const won = PROPOSALS.filter((p) => p.status === 'won').length;
  const pipeline = PROPOSALS.filter((p) => ['draft', 'sent'].includes(p.status));
  const send = (p) => { p.status = 'sent'; p.at = TODAY; persist(); toast('Sent for signature.'); render(); };
  return (
    <>
      <SecHead title="Proposals and fees" sub="Estimate a fee, send it for signature and turn a signed proposal into a project.">
        <Btn kind="primary" icon="plus" onClick={() => openDialog({ kind: 'estimate' })}>Estimate a fee</Btn>
      </SecHead>
      <div className="mb-3.5 grid grid-cols-2 gap-gap lg:grid-cols-4">
        <Stat label="Pipeline" value={inr(pipeline.reduce((a, p) => a + p.fee, 0))} sub={`${pipeline.length} draft or sent`} />
        <Stat label="Signed" value={PROPOSALS.filter((p) => p.status === 'signed').length} sub="ready for a project" tone="text-ok" />
        <Stat label="Win rate" value={decided ? `${Math.round((won / decided) * 100)}%` : '—'} sub="this year" />
        <Stat label="All proposals" value={PROPOSALS.length} sub="on record" />
      </div>
      {state.desk.estimate && (
        <div className="mb-3.5 whitespace-pre-line rounded-r3 bg-accent-soft px-4 py-3 text-accent-text">{state.desk.estimate}</div>
      )}
      <Card>
        <DataTable
          cols={['Client', 'Kind', 'Area', '₹Fee', 'Basis', 'Owner', 'Sent', 'Status', '']}
          rows={PROPOSALS.map((p) => [
            p.client, p.kind, p.area, inr(p.fee), p.basis, first(p.owner), fmtD(p.at),
            <StatusPill key="s" status={p.status} />,
            p.status === 'draft' ? (
              <Btn key="a" sm kind="primary" onClick={() => send(p)}>Send for signature</Btn>
            ) : p.status === 'sent' ? (
              <DLink key="a" to={`#/sign/proposal/${p.id}`}>Open to sign</DLink>
            ) : p.status === 'signed' ? (
              <Row key="a">
                <DLink to={`#/sign/proposal/${p.id}`}>View signed</DLink>
                {!p.projectId && (
                  <Btn sm onClick={() => openDialog({ kind: 'template', name: p.client, tkind: 'Project' })}>Create project</Btn>
                )}
              </Row>
            ) : '',
          ])}
        />
      </Card>
    </>
  );
}

function Expenses() {
  const es = state.db.EXPENSES;
  const sum = (f) => es.filter(f).reduce((a, e) => a + e.amount, 0);
  return (
    <>
      <SecHead title="Expenses by project" sub="Claims and site cash per project. Approving claims happens under People.">
        <DLink to="#/people?tab=expenses" className="inline-flex min-h-9 items-center rounded-r1 border border-line-2 bg-surface px-3.5 font-semibold text-accent-text no-underline hover:border-accent hover:bg-accent-soft">Approve claims</DLink>
      </SecHead>
      <div className="mb-3.5 grid grid-cols-2 gap-gap lg:grid-cols-4">
        <Stat label="Total claimed" value={inr(sum(() => true))} sub={`${es.length} claims`} />
        <Stat label="Pending" value={inr(sum((e) => e.status === 'pending'))} sub={`${es.filter((e) => e.status === 'pending').length} to approve`} tone={es.some((e) => e.status === 'pending') ? 'text-warn' : ''} />
        <Stat label="From site cash" value={inr(sum((e) => e.paidBy === 'cash'))} sub="paid in cash on site" />
        <Stat label="Projects" value={svc.projects().length} sub="with claims" />
      </div>
      <Card>
        <DataTable
          cols={['Project', 'Claims', '₹Total', 'From site cash', 'Site cash left', 'Pending']}
          rows={svc.projects().map((p) => {
            const pe = es.filter((e) => e.projectId === p.id);
            const site = state.db.SITES.find((x) => x.projectId === p.id);
            const pc = site ? svc.pettyCash(site.id) : null;
            return [
              p.name, pe.length, inr(pe.reduce((a, e) => a + e.amount, 0)),
              inr(pe.filter((e) => e.paidBy === 'cash').reduce((a, e) => a + e.amount, 0)),
              pc ? <span key="c">{inr(pc.left)} <small className="text-ink-3">of {inr(pc.float)}</small></span> : '—',
              pe.filter((e) => e.status === 'pending').length,
            ];
          })}
        />
      </Card>
    </>
  );
}

function Money({ q }) {
  if (role() === 'client') return <ClientMoney />;
  if (!can('budget', 'r', role())) {
    return (
      <>
        <PageHeader title="Money" sub="Receivables, invoices, change orders, fees and expenses." />
        <Empty>Money figures are for partners. Your expense claims are under People.</Empty>
      </>
    );
  }
  const tab = q.tab || 'dashboard';
  const inv = state.db.INVOICES;
  const unpaid = inv.filter((i) => i.status !== 'paid');
  const wip = state.db.PROJECTS.map((p) => {
    const fee = FEES[p.id] || 0;
    const earned =
      FEE_STAGES.filter((s) => s.phase < p.phase).reduce((a, s) => a + (fee * s.pct) / 100, 0) +
      ((fee * (FEE_STAGES[p.phase]?.pct || 0)) / 100) * 0.5;
    const billed = inv.filter((i) => i.projectId === p.id).reduce((a, i) => a + i.amount, 0);
    const hrs =
      state.db.TIMESHEETS.filter((t) => t.projectId === p.id).reduce((a, t) => a + t.hours * (HOURLY[user(t.userId).role] || 0), 0) * 12;
    return { p, fee, earned, billed, wip: Math.max(0, earned - billed), cost: hrs, margin: fee ? Math.round(((fee - hrs) / fee) * 100) : 0 };
  });
  const T = {
    dashboard: () => <Dashboard unpaid={unpaid} wip={wip} />,
    invoices: () => <Invoices inv={inv} />,
    changes: () => <Changes />,
    proposals: () => <Proposals />,
    expenses: () => <Expenses />,
  };
  return (
    <>
      <PageHeader title="Money" sub="Receivables, invoices, change orders, fees and expenses." />
      <Tabs
        base={href('#/money')}
        current={tab}
        list={[
          ['dashboard', 'Partner dashboard'],
          ['invoices', 'Invoices'],
          ['changes', 'Change orders'],
          ['proposals', 'Proposals and fees'],
          ['expenses', 'Expenses'],
        ]}
      />
      {(T[tab] || T.dashboard)()}
    </>
  );
}

// ---------- vendors ----------
function VendorRow({ v, preselect }) {
  const open = state.desk.vendorOpen === v.id;
  const finished = svc.projects().filter((p) => (p.status || 'active') === 'finished');
  const projOpts = finished.length ? finished : svc.projects();
  const save = (e) => {
    e.preventDefault();
    const p = formData(e.currentTarget);
    svc.rateVendor(v.id, p.projectId, +p.stars, p.note);
    state.desk.vendorOpen = null;
    toast('Rating saved.');
    render();
  };
  return (
    <div className="border-b border-line py-2">
      <Row className="flex-wrap">
        <b>{v.name}</b>
        <span className="grow" />
        <span>{v.trade}</span>
        <span>{'★'.repeat(v.rating) + '☆'.repeat(5 - v.rating)}</span>
        <span>{v.phone}</span>
        <span>{(v.projects || []).length} projects</span>
        <Btn sm onClick={() => { state.desk.vendorOpen = open ? null : v.id; render(); }}>{open ? 'Close' : 'Rate'}</Btn>
      </Row>
      {open && (
        <form onSubmit={save} className="mt-2 flex flex-wrap items-center gap-2.5">
          <Select name="projectId" aria-label="Project" defaultValue={preselect}>
            {projOpts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select name="stars" aria-label="Stars">
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}
          </Select>
          <Input name="note" placeholder="Note" aria-label="Note" />
          <Btn kind="primary" type="submit">Save rating</Btn>
        </form>
      )}
    </div>
  );
}

function Vendors({ q }) {
  const tab = q.tab || 'list';
  const trade = state.desk.vendorTrade || '';
  const trades = [...new Set(state.db.VENDORS.map((v) => v.trade))];
  const preselect = q.project || '';
  return (
    <>
      <PageHeader title="Vendors">
        {tab === 'list' && (
          <Select
            aria-label="Filter by trade"
            value={trade}
            onChange={(e) => { state.desk.vendorTrade = e.target.value; render(); }}
          >
            <option value="">All trades</option>
            {trades.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        )}
      </PageHeader>
      <Tabs base={href('#/vendors')} current={tab} list={[['list', 'Directory'], ['rates', 'Rate library']]} />
      <Card>
        {tab === 'rates' ? (
          <DataTable
            cols={['Item', 'Vendor', '₹Rate', 'Unit', 'Quoted']}
            rows={state.db.VENDORS.flatMap((v) => v.rates.map((r) => [r.item, v.name, r.rate.toLocaleString('en-IN'), r.unit, fmtD(r.at)]))
              .sort((a, b) => a[0].localeCompare(b[0]))}
          />
        ) : (
          [...state.db.VENDORS].filter((v) => !trade || v.trade === trade)
            .sort((a, b) => b.rating - a.rating)
            .map((v) => <VendorRow key={v.id} v={v} preselect={preselect} />)
        )}
      </Card>
    </>
  );
}

// ---------- sign ----------
function Sign({ parts }) {
  const [kind, id] = parts;
  if (kind !== 'proposal') return <Empty>Nothing here.</Empty>;
  const p = PROPOSALS.find((x) => x.id === id);
  if (!p) return <Empty>Proposal not found.</Empty>;
  const A = state.db.AGENCY;
  const submit = (e) => {
    e.preventDefault();
    const f = formData(e.currentTarget);
    p.status = 'signed';
    p.signedAt = new Date().toISOString().slice(0, 16);
    p.signedBy = f.name;
    persist();
    toast('Signed. The studio has been told.');
    go('#/money?tab=proposals');
  };
  const gst = Math.round(p.fee * 0.18);
  return (
    <div className="mx-auto max-w-[760px]">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.12em] text-accent-text">{A.name}</p>
          <h1 className="m-0 mt-1 text-[30px] font-semibold leading-tight tracking-tight">Proposal for {p.client}</h1>
          <p className="m-0 mt-1 text-[13px] text-ink-3">{p.kind} · prepared by {first(p.owner)} · {fmtD(p.at)}</p>
        </div>
        <StatusPill status={p.status} />
      </div>
      <div className="mb-3.5 grid grid-cols-2 gap-gap sm:grid-cols-3">
        <Stat label="Built-up area" value={p.area} sub="as discussed" />
        <Stat label="Professional fee" value={inr(p.fee)} sub={p.basis} />
        <Stat label="GST 18%" value={inr(gst)} sub={`Total ${inr(p.fee + gst)}`} />
      </div>
      <Card title="Fee by stage" className="mb-3.5">
        <DataTable
          cols={['Stage', 'Share', '₹Amount']}
          rows={FEE_STAGES.map((st) => [st.name, `${st.pct}%`, inr(Math.round((p.fee * st.pct) / 100))])}
        />
        <p className="mb-0 mt-3 text-[13px] text-ink-3">Each stage is invoiced when its milestone is reached. Invoices are due 15 days from issue.</p>
      </Card>
      <Card title="Terms" className="mb-3.5">
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-ink-2">
          <li>Fee covers design, drawings and site coordination as listed for {p.kind.toLowerCase()}.</li>
          <li>Changes to scope are raised as change orders and signed before work starts.</li>
          <li>GST at 18% is added to every invoice.</li>
        </ul>
      </Card>
      <Card title="Accept and sign">
        {p.status === 'signed' ? (
          <Pill kind="ok">Signed by {p.signedBy} · {fmtDT(p.signedAt)}</Pill>
        ) : (
          <form onSubmit={submit}>
            <Field label="Type your full name to sign">
              <Input name="name" required placeholder={p.client} />
            </Field>
            <p className="mb-3 mt-0 text-[13px] text-ink-3">By signing you accept this proposal and the fee schedule above.</p>
            <Btn kind="primary" type="submit" className="!min-h-11 !px-6">Sign and accept</Btn>
          </form>
        )}
      </Card>
    </div>
  );
}

// ---------- dialogs ----------
function EstimateDialog() {
  const run = (e) => {
    e.preventDefault();
    const p = formData(e.currentTarget);
    const cost = p.area * p.rate;
    const fee = Math.round((cost * p.kind) / 100);
    state.desk.estimate = `Estimated build cost ${inr(cost)} at ₹${p.rate}/sq ft.\nFee at ${p.kind}%: ${inr(fee)}.\nBy stage: ${FEE_STAGES.map((s) => `${s.name} ${inr((fee * s.pct) / 100)}`).join(', ')}.\nBased on ${PROPOSALS.length} past proposals; similar jobs closed at 2.8 to 3.6%.`;
    state.desk.dialog = null;
    render();
  };
  return (
    <Modal title="Estimate a fee">
      <form onSubmit={run}>
        <Field label="Kind">
          <Select name="kind">
            <option value="3.2">Residential · Villa</option>
            <option value="2.8">Commercial · Office</option>
            <option value="3.6">Hospitality</option>
          </Select>
        </Field>
        <Field label="Built-up area, sq ft"><Input name="area" type="number" defaultValue={5000} /></Field>
        <Field label="Expected build cost per sq ft, ₹"><Input name="rate" type="number" defaultValue={3800} /></Field>
        <ModalActions>
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn kind="primary" type="submit">Estimate</Btn>
        </ModalActions>
      </form>
    </Modal>
  );
}

function ProposalDialog({ d }) {
  const e = state.db.ENQUIRIES.find((x) => x.id === d.enquiryId);
  const svcType = state.db.SERVICE_TYPES.find((t) => t.id === e?.typeId);
  const save = (ev) => {
    ev.preventDefault();
    const p = formData(ev.currentTarget);
    const enq = state.db.ENQUIRIES.find((x) => x.id === d.enquiryId);
    const fee = Math.round((p.cost * p.pct) / 100);
    const id = uid();
    PROPOSALS.unshift({
      id, client: enq ? enq.name : '', kind: p.kind, area: p.area, fee,
      basis: `${p.pct}% of estimated cost`, status: 'draft', at: TODAY, owner: state.userId, enquiryId: enq?.id,
    });
    if (enq) enq.proposalId = id;
    state.desk.dialog = null;
    persist();
    toast('Proposal drafted.');
    go('#/money?tab=proposals');
  };
  return (
    <Modal title={`Make a proposal · ${e?.name || ''}`}>
      <form onSubmit={save}>
        <Field label="Kind"><Input name="kind" defaultValue={svcType?.name || ''} required /></Field>
        <Field label="Built-up area"><Input name="area" defaultValue="2,500 sq ft" required /></Field>
        <Grid2>
          <Field label="Fee basis, % of build cost"><Input name="pct" type="number" step="0.1" defaultValue={3.2} /></Field>
          <Field label="Expected build cost, ₹"><Input name="cost" type="number" defaultValue={7500000} /></Field>
        </Grid2>
        <p className="my-3 rounded-r1 bg-accent-soft px-3.5 py-2.5 text-accent-text">
          AI-drafted scope, edit before sending: Design and execution drawings for {svcType?.name || 'the project'}, covering concept, working drawings, site supervision and handover, in stages of {FEE_STAGES.map((s) => s.name).join(', ')}.
        </p>
        <ModalActions>
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn kind="primary" type="submit">Save draft</Btn>
        </ModalActions>
      </form>
    </Modal>
  );
}

function RaiseVendorDialog({ d }) {
  const g = state.db.GRNS.find((x) => x.id === d.grnId && svc.site(x.siteId));
  const t = g && svc.threads().find((x) => x.kind === 'site' && x.siteId === g.siteId);
  if (!g || !t || !can('thread', 'w', role())) {
    return (
      <Modal title="Delivery unavailable">
        <p>This record or site conversation is no longer available.</p>
        <ModalActions><Btn onClick={closeDialog}>Close</Btn></ModalActions>
      </Modal>
    );
  }
  const vendor = g.vendorId ? V(g.vendorId).name : null;
  const facts = deliveryFacts(g);
  const dflt = `${vendor ? `Hi ${vendor}, ` : ''}${g.item} received on ${fmtD(g.date)}: ${g.qty} ${g.unit}.${facts.known ? ` Ordered: ${g.ordered} ${g.unit}. Outstanding: ${facts.remaining} ${g.unit}.` : ' The delivery is recorded as short; please confirm the ordered and remaining quantities.'} Please confirm when the balance can arrive.`;
  const send = (e) => {
    e.preventDefault();
    const text = String(formData(e.currentTarget).text || '').trim();
    d.text = text;
    try {
      if (!can('thread', 'w', role())) throw new Error('This site conversation is no longer available.');
      if (!text) throw new Error('Write a follow-up before sending.');
      if (!svc.addMessage(t.id, { text })) throw new Error(state.storageError || 'Could not send. Your draft is still here.');
      state.desk.dialog = null;
      toast('Sent to site thread.');
    } catch (error) {
      d.error = error.message;
      toast(error.message);
    }
  };
  return (
    <Modal title={`Follow up on ${g.item}`}>
      <form onSubmit={send}>
        <p className="mt-0 text-ink-3">To: {t.name}. This posts to the site conversation, not directly to the supplier.</p>
        <Field label="Message"><Textarea name="text" rows={5} required defaultValue={d.text ?? dflt} /></Field>
        {d.error && <p role="alert" className="text-crit">{d.error}</p>}
        <ModalActions>
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn kind="primary" type="submit">Send to site thread</Btn>
        </ModalActions>
      </form>
    </Modal>
  );
}

function InvoiceDialog({ d }) {
  const inv = state.db.INVOICES.find((x) => x.id === d.invId);
  if (!inv) return null;
  const g = svc.gst(inv);
  const A = state.db.AGENCY;
  const row = (k, v) => (
    <tr key={k}><th className="py-1 pr-4 text-left font-medium text-ink-2">{k}</th><td className="py-1 text-right">{v}</td></tr>
  );
  return (
    <Modal title={`${inv.no} · ${P(inv.projectId).name}`}>
      <p className="mt-0 text-ink-3">
        {A.name} · GSTIN {A.gstin || 'not set'} · SAC {g.sac || '9983'} · Place of supply {g.placeOfSupply}
      </p>
      <table className="w-full">
        <tbody>
          {row('Stage', FEE_STAGES[inv.stage].name)}
          {row('Issued', fmtD(inv.issued))}
          {row('Due', fmtD(inv.due))}
          {row('Taxable', inr(g.taxable))}
          {g.inter ? row('IGST 18%', inr(g.igst)) : [row('CGST 9%', inr(g.cgst)), row('SGST 9%', inr(g.sgst))]}
          {row(<b>Total</b>, <b>{inr(g.total)}</b>)}
          {row('Status', <StatusPill status={inv.status} />)}
        </tbody>
      </table>
      <p className="my-3 rounded-r1 bg-accent-soft px-3.5 py-2.5 text-accent-text">
        {g.inter ? 'Client billed from another state, so IGST.' : 'Client in the same state as the studio, so CGST + SGST.'} Change the billing state on the project if this is wrong.
      </p>
      <ModalActions>
        <Btn onClick={() => tallyCopy(inv.id)}>Copy for Tally</Btn>
        <Btn kind="primary" onClick={closeDialog}>Close</Btn>
      </ModalActions>
    </Modal>
  );
}

function RaiseInvoiceDialog() {
  const projects = svc.projects().filter((p) => FEES[p.id]);
  const save = (e) => {
    e.preventDefault();
    const p = formData(e.currentTarget);
    const pr = P(p.projectId);
    const st = +p.stage;
    state.db.INVOICES.push({
      id: uid(), projectId: pr.id, no: 'HA/26-27/0' + (34 + state.db.INVOICES.length - 6), stage: st,
      amount: Math.round((FEES[pr.id] * FEE_STAGES[st].pct) / 100), status: 'sent', issued: TODAY, due: p.due || '2026-09-24', paid: null,
    });
    svc.log('Invoice raised · ' + pr.name, 'Project ' + pr.id);
    persist();
    state.desk.dialog = null;
    toast('Invoice raised.');
    render();
  };
  return (
    <Modal title="Raise invoice">
      <form onSubmit={save}>
        <Field label="Project">
          <Select name="projectId" required defaultValue="">
            <option value="" disabled>Choose a project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Fee stage">
          <Select name="stage" defaultValue="0">
            {FEE_STAGES.map((st, i) => <option key={st.name} value={i}>{st.name} · {st.pct}%</option>)}
          </Select>
        </Field>
        <Field label="Due date"><Input type="date" name="due" defaultValue="2026-09-24" /></Field>
        <p className="mt-0 text-[13px] text-ink-3">The amount is the stage share of the project fee. GST is split on the invoice.</p>
        <ModalActions><Btn onClick={closeDialog}>Cancel</Btn><Btn kind="primary" type="submit">Raise invoice</Btn></ModalActions>
      </form>
    </Modal>
  );
}

function NudgeDialog({ d }) {
  const inv = state.db.INVOICES.find((x) => x.id === d.invId);
  const send = (e) => {
    e.preventDefault();
    const p = formData(e.currentTarget);
    const t = state.db.THREADS.find((x) => x.kind === 'client' && x.projectId === inv.projectId);
    if (t) svc.addMessage(t.id, { text: p.text });
    state.desk.dialog = null;
    toast('Sent to client group.');
  };
  const copy = (e) => {
    const ta = e.currentTarget.form?.elements?.text;
    if (ta?.value) navigator.clipboard?.writeText(ta.value);
    toast('Copied.');
  };
  return (
    <Modal title={`Draft nudge · ${P(inv.projectId).name}`}>
      <form onSubmit={send}>
        <p className="mt-0 rounded-r1 bg-accent-soft px-3.5 py-2.5 text-accent-text">AI suggestion, edit before sending</p>
        <Field label="Language">
          <Select name="lang" value={d.lang || 'English'} onChange={(e) => nudgeLang(d, e.target.value)}>
            <option>English</option>
            <option>Hinglish</option>
            <option>Gujlish</option>
          </Select>
        </Field>
        <Field label="Message"><Textarea key={d.text} name="text" rows={4} defaultValue={d.text || ''} /></Field>
        <ModalActions>
          <Btn onClick={copy}>Copy</Btn>
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn kind="primary" type="submit">Send to client group</Btn>
        </ModalActions>
      </form>
    </Modal>
  );
}

export const pages = {
  money: ({ q }) => <Money q={q} />,
  vendors: ({ q }) => <Vendors q={q} />,
  sign: ({ parts }) => <Sign parts={parts} />,
};
export const dialogs = {
  estimate: EstimateDialog,
  proposal: ProposalDialog,
  'raise-vendor': RaiseVendorDialog,
  invoice: InvoiceDialog,
  'invoice-nudge': NudgeDialog,
  'raise-invoice': RaiseInvoiceDialog,
};
