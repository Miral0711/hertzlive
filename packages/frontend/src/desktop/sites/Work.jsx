import { useEffect, useRef } from 'react';
import { state, svc, can, fmtD, fmtDT, accessibleMessage, toast, go } from '../../shared/core.js';
import { TODAY } from '../../shared/data.js';
import { addDays } from '../../shared/liveDates.js';
import { Btn, DataTable, Empty, StatusPill } from '../../ui/ui';
import Icon from '../../ui/Icon';
import { DLink } from '../nav';
import { V, name, role } from '../helpers';
import { filedRows } from '../parts';
import { openDialog } from '../session';
import { Details, SourceExcerpt } from './bits';

export const workHref = (site, tab, filter, record = '') =>
  `#/sites/${site.id}?tab=${tab}&filter=${encodeURIComponent(filter)}${record ? `&record=${encodeURIComponent(record)}` : ''}`;

export function deliveryFacts(g) {
  const known = Number.isFinite(g.ordered) && g.ordered > 0 && Number.isFinite(g.qty) && g.qty >= 0 && !!g.unit;
  const remaining = known ? Math.max(0, Number((g.ordered - g.qty).toPrecision(12))) : null;
  return {
    known,
    remaining,
    summary: known
      ? remaining > 0 ? `${remaining} ${g.unit} outstanding`
        : g.qty > g.ordered ? `${Number((g.qty - g.ordered).toPrecision(12))} ${g.unit} over ordered` : 'Ordered quantity received'
      : g.status === 'short' ? 'Short delivery · quantity to confirm' : 'Ordered quantity not recorded',
  };
}

// List + detail split. Selecting a record changes ?record=; keep scroll position and move focus
// to the detail (or back to the list) like the prototype did.
function WorkSplit({ record, hasSelected, list, detail }) {
  const detailRef = useRef(null);
  const listRef = useRef(null);
  const scroll = useRef(null);
  const first = useRef(true);
  const main = () => document.querySelector('main');
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const m = main();
    if (scroll.current != null && m) m.scrollTop = scroll.current;
    scroll.current = null;
    if (record && detailRef.current) {
      detailRef.current.focus({ preventScroll: true });
      if (m && m.clientWidth < 725) detailRef.current.scrollIntoView({ block: 'start' });
    } else listRef.current?.querySelector('a')?.focus({ preventScroll: true });
  }, [record]);
  const remember = () => { scroll.current = main()?.scrollTop || 0; };
  return (
    <div className={`grid items-start gap-gap md:grid-cols-[minmax(240px,1fr)_minmax(0,1.4fr)] ${record && hasSelected ? '' : ''}`} onClickCapture={(e) => { if (e.target.closest?.('a')) remember(); }}>
      <div ref={listRef} aria-label="Records" className={`flex flex-col gap-1.5 ${record && hasSelected ? 'max-md:hidden' : ''}`}>{list}</div>
      {detail && (
        <section ref={detailRef} tabIndex={-1} className="rounded-r3 border border-line bg-surface p-4 outline-none" aria-label="Selected record">
          {detail}
        </section>
      )}
    </div>
  );
}

const rowCls = (on) => `flex min-h-11 items-center gap-3 rounded-r2 border px-3.5 py-2.5 no-underline ${on ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-surface-3'}`;
const Symbol = ({ attention, icon }) => (
  <span className={`grid h-9 w-9 flex-none place-items-center rounded-full ${attention ? 'bg-warn-soft text-warn' : 'bg-surface-3 text-ink-2'}`}><Icon name={icon} small /></span>
);
const Back = ({ to, children }) => (
  <DLink to={to} className="mb-2 inline-flex items-center gap-1 text-sm no-underline md:hidden"><Icon name="back" small /> {children}</DLink>
);
const Facts = ({ items }) => (
  <dl className="my-3 grid grid-cols-2 gap-3">
    {items.map(([k, v]) => <div key={k}><dt className="text-xs text-ink-3">{k}</dt><dd className="m-0 font-medium">{v}</dd></div>)}
  </dl>
);
const FilterLink = ({ to, on, children }) => (
  <DLink to={to} aria-current={on ? 'true' : undefined}
    className={`inline-flex min-h-8 items-center rounded-r1 border px-2.5 text-[13px] font-semibold no-underline ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line-2 bg-surface text-ink hover:bg-surface-2'}`}
    style={on ? { color: 'var(--accent-ink)' } : undefined}>{children}</DLink>
);
const SectionHead = ({ title, sub, children }) => (
  <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
    <div><h2 className="m-0 text-xl font-semibold">{title}</h2><p className="m-0 text-[13px] text-ink-3">{sub}</p></div>
    <nav className="flex gap-2">{children}</nav>
  </div>
);

export function DeliveryWorkspace({ s: site, q }) {
  const all = state.db.GRNS.filter((g) => g.siteId === site.id).slice()
    .sort((a, b) => (b.status === 'short') - (a.status === 'short') || (b.date || '').localeCompare(a.date || ''));
  const filter = q.filter === 'short' ? 'short' : 'all';
  const rows = all.filter((g) => filter === 'all' || g.status === 'short');
  const selected = rows.find((g) => g.id === q.record) || rows[0];
  const source = selected?.msgId && accessibleMessage(selected.msgId);
  const facts = selected && deliveryFacts(selected);
  const thread = svc.threads().find((t) => t.kind === 'site' && t.siteId === site.id);
  const other = filedRows({ projectId: site.projectId, kind: 'delivery' })
    .filter((x) => !all.some((g) => g.msgId === x.m.id) && !x.m.assistDraft && !x.m.siteAnswer);
  const shortN = all.filter((g) => g.status === 'short').length;
  const hasSource = source && (source.photo || source.file || source.album);
  return (
    <>
      <section className="mb-3.5">
        <SectionHead title="Deliveries" sub={`${shortN} short deliver${shortN === 1 ? 'y' : 'ies'} · select a record to review its evidence.`}>
          <FilterLink to={workHref(site, 'deliveries', 'all')} on={filter === 'all'}>All ({all.length})</FilterLink>
          <FilterLink to={workHref(site, 'deliveries', 'short')} on={filter === 'short'}>Short ({shortN})</FilterLink>
        </SectionHead>
        <WorkSplit
          record={q.record}
          hasSelected={!!selected}
          list={rows.length ? rows.map((g) => (
            <DLink key={g.id} to={workHref(site, 'deliveries', filter, g.id)} aria-current={selected.id === g.id ? 'true' : undefined} className={rowCls(selected.id === g.id)} style={{ color: 'inherit' }}>
              <Symbol attention={g.status === 'short'} icon="delivery" />
              <span className="min-w-0 flex-1">
                <b className="block">{g.item}</b>
                <strong className={`block text-sm ${g.status === 'short' ? 'text-crit' : ''}`}>{deliveryFacts(g).summary}</strong>
                <small className="text-ink-3">{g.qty} {g.unit} received · {fmtD(g.date)}</small>
              </span>
              <Icon name="chev" small />
            </DLink>
          )) : <Empty>No deliveries in this view. Select All to see other records.</Empty>}
          detail={selected && (
            <>
              <Back to={workHref(site, 'deliveries', filter)}>Back to deliveries</Back>
              <div className="flex items-center gap-2"><StatusPill status={selected.status} /><span>{fmtD(selected.date)}</span></div>
              <h3 className="mb-1 mt-2 text-lg font-semibold">{selected.item}</h3>
              <p className="my-1 text-2xl font-bold">{selected.qty} <span className="text-base font-normal text-ink-2">{selected.unit} received</span></p>
              {facts.known ? (
                <label className="flex flex-col gap-1 text-[13px] text-ink-2">{selected.qty} of {selected.ordered} {selected.unit}
                  <progress max={selected.ordered} value={Math.min(selected.qty, selected.ordered)} className="h-2 w-full">{selected.qty} of {selected.ordered}</progress></label>
              ) : <p className="text-ink-3">Ordered quantity not recorded. Completion is unknown.</p>}
              <p className="font-medium">{facts.summary}</p>
              <Facts items={[['Supplier', selected.vendorId ? V(selected.vendorId).name : 'Not recorded'], ['Recorded by', name(selected.by)]]} />
              {selected.note && <p>{selected.note}</p>}
              <h4 className="mb-1.5 font-semibold">Source &amp; evidence</h4>
              {source ? <SourceExcerpt m={source} /> : <p className="text-ink-3">No source message linked to this record.</p>}
              {!hasSource && <p className="rounded-r1 bg-surface-2 p-2 text-ink-3">No challan or photo attached.</p>}
              {selected.status === 'short' && thread && can('thread', 'w', role()) && (
                <Btn kind="primary" onClick={() => openDialog({ kind: 'raise-vendor', grnId: selected.id })}>Draft delivery follow-up</Btn>
              )}
            </>
          )}
        />
      </section>
      <Details summary="Full delivery register">
        <DataTable
          cols={['Date', 'Item', 'Received', 'Ordered', 'Vendor', 'Status', 'Note', 'By']}
          rows={all.map((g) => [fmtD(g.date), g.item, `${g.qty} ${g.unit}`, deliveryFacts(g).known ? `${g.ordered} ${g.unit}` : 'Not recorded', V(g.vendorId).name, <StatusPill status={g.status} />, g.note || '', name(g.by)])}
        />
      </Details>
      <Details summary={`Other delivery mentions · ${other.length}`}>
        <p className="text-ink-3">Conversation context; these mentions are not confirmed delivery records.</p>
        {other.length ? other.map((x) => <SourceExcerpt key={x.m.id} m={x.m} />) : <p className="text-ink-3">No other mentions.</p>}
      </Details>
    </>
  );
}

export function IssueWorkspace({ s: site, q }) {
  const all = svc.issues().filter((i) => i.siteId === site.id).slice()
    .sort((a, b) => (a.status === 'closed') - (b.status === 'closed') || (a.due || '9999').localeCompare(b.due || '9999'));
  const filter = q.filter === 'all' ? 'all' : 'open';
  const rows = all.filter((i) => filter === 'all' || i.status !== 'closed');
  const selected = rows.find((i) => i.id === q.record) || rows[0];
  const detail = selected && svc.siteIssueDetails(selected.id);
  const other = filedRows({ projectId: site.projectId, kind: 'issue' })
    .filter((x) => !all.some((i) => svc.siteIssueDetails(i.id)?.sources.some((m) => m.id === x.m.id)) && !x.m.assistDraft && !x.m.siteAnswer);
  const openN = all.filter((i) => i.status !== 'closed').length;
  const last = detail?.answers.length ? detail.answers[detail.answers.length - 1] : null;
  const raise = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    svc.addIssue({
      siteId: site.id, projectId: site.projectId, title: new FormData(form).get('title'), type: 'Site query',
      drawing: '', sla: '24 h', assignee: 'u5', due: `${addDays(TODAY, 2)}T09:00`, source: 'desk',
    });
    form.reset();
    toast('Issue raised.');
  };
  return (
    <>
      <section className="mb-3.5">
        <SectionHead title="Issues" sub="The question, its owner and the evidence in one place.">
          <FilterLink to={workHref(site, 'issues', 'open')} on={filter === 'open'}>Open ({openN})</FilterLink>
          <FilterLink to={workHref(site, 'issues', 'all')} on={filter === 'all'}>All ({all.length})</FilterLink>
        </SectionHead>
        {can('issue', 'w') && (
          <details className="mb-3 rounded-r2 border border-line bg-surface px-3.5 py-2">
            <summary className="cursor-pointer font-semibold">Raise an issue</summary>
            <form onSubmit={raise} className="mt-2 flex items-end gap-2.5">
              <label className="flex flex-1 flex-col gap-1 text-[13px] font-semibold text-ink-2">Issue title
                <input name="title" placeholder="What needs resolving?" required className="min-h-9 rounded-r1 border border-line-2 bg-surface px-2.5 text-ink" /></label>
              <Btn type="submit">Raise</Btn>
            </form>
          </details>
        )}
        <WorkSplit
          record={q.record}
          hasSelected={!!selected}
          list={rows.length ? rows.map((i) => (
            <DLink key={i.id} to={workHref(site, 'issues', filter, i.id)} aria-current={selected.id === i.id ? 'true' : undefined} className={rowCls(selected.id === i.id)} style={{ color: 'inherit' }}>
              <Symbol attention={i.status !== 'closed'} icon={i.status === 'closed' ? 'check' : 'chat'} />
              <span className="min-w-0 flex-1">
                <b className="block">{i.title}</b>
                <small className="block text-ink-3">{i.assignee ? name(i.assignee) : 'Unassigned'}</small>
                <small className="block text-ink-3">{i.due ? `Due ${fmtD(i.due)}${i.status !== 'closed' && i.due.slice(0, 10) < TODAY ? ' · Overdue' : ''}` : 'Due date not set'}</small>
              </span>
              <StatusPill status={i.status} />
            </DLink>
          )) : <Empty>No open issues. Select All to view closed work.</Empty>}
          detail={selected && (
            <>
              <Back to={workHref(site, 'issues', filter)}>Back to issues</Back>
              <div className="flex items-center gap-2"><StatusPill status={selected.status} /><span>{selected.type || 'Site issue'}</span></div>
              <h3 className="mb-1 mt-2 text-lg font-semibold">{selected.title}</h3>
              <Facts items={[
                ['Owner', selected.assignee ? name(selected.assignee) : 'Unassigned'],
                ['Due', selected.due ? fmtDT(selected.due) : 'Not set'],
                ['Raised by', name(selected.raisedBy)],
                ['Response target', selected.sla || 'Not set'],
              ]} />
              {selected.drawing && (
                <p className="flex flex-wrap items-center gap-1.5"><Icon name="drawing" small /> {selected.drawing}<small className="text-ink-3">Referenced drawing · verify revision before use</small></p>
              )}
              <h4 className="mb-1.5 font-semibold">Source &amp; evidence</h4>
              {detail?.sources.length ? detail.sources.map((m) => <SourceExcerpt key={m.id} m={m} />) : <p className="rounded-r1 bg-surface-2 p-2 text-ink-3">No source message or original file linked.</p>}
              {last && (
                <>
                  <h4 className="mb-1.5 font-semibold">Latest office answer</h4>
                  <SourceExcerpt m={last} />
                  <p className="text-ink-3">{last.siteAnswer.response === 'acknowledged' ? 'Acknowledged on site' : last.siteAnswer.response === 'clarification' ? 'Site requested clarification' : 'Awaiting site acknowledgement'}</p>
                </>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {detail?.sources.length > 0 && (
                  <Btn kind="primary" onClick={() => { if (svc.siteIssueDetails(selected.id)) { state.desk.dialog = null; go(`#/review/${encodeURIComponent(selected.id)}`); } }}>
                    {detail.canAnswer && selected.status !== 'closed' ? 'Review / reply to site' : 'View updates and answers'}
                  </Btn>
                )}
                {selected.status !== 'closed' && can('issue', 'w') && (
                  <Btn onClick={() => { svc.closeIssue(selected.id); toast('Issue closed.'); }}>Close issue</Btn>
                )}
              </div>
            </>
          )}
        />
      </section>
      <Details summary="Full issue register">
        <DataTable
          cols={['Issue', 'Type', 'Drawing', 'Raised by', 'Assignee', 'Due', 'SLA', 'Status']}
          rows={all.map((i) => [i.title, i.type, i.drawing || '', name(i.raisedBy), i.assignee ? name(i.assignee) : 'Unassigned', i.due ? fmtDT(i.due) : 'Not set', i.sla || 'Not set', <StatusPill status={i.status} />])}
        />
      </Details>
      <Details summary={`Other problems mentioned in chat · ${other.length}`}>
        {other.length ? other.map((x) => <SourceExcerpt key={x.m.id} m={x.m} />) : <p className="text-ink-3">No other mentions.</p>}
      </Details>
    </>
  );
}
