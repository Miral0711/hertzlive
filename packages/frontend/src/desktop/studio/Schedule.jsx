import { Fragment, useEffect, useRef, useState } from 'react';
import { state, svc, can, fmtD, fmtDT, hh, toast, render, uid, persist } from '../../shared/core.js';
import { ROLES } from '../../shared/data.js';
import { addDays } from '../../shared/liveDates.js';
import { RESOURCE } from '../data';
import { Btn, Card, Field, Input, PageHeader, Pill, Select, StatusPill, Tabs, DataTable, Table, Th, Td, Tr, ToggleChip } from '../../ui/ui';
import { TONE_SOFT } from '../../ui/tones';
import Icon from '../../ui/Icon';
import { P, first, name } from '../helpers';
import { DLink } from '../nav';
import { openDialog, closeDialog } from '../session';
import Modal from '../Modal';
import { deleteHoliday, listHolidays, listLeaveRequests } from '../../api/leaveClient';
import {
  ClashBox, H2, Muted, PURPOSE, SecHead, SubText, Stat, TODAY, TextLink, approvalRecords, dateShift, hours, submitBook, tabBase,
} from './common';

function BookForm({ date, clientId }) {
  const b = { ...(state.desk.bookForm || {}), date, ...(clientId ? { clientId } : {}) };
  if (state.desk.bookForm?.date) b.date = state.desk.bookForm.date;
  const wh = svc.cfg().hours;
  const people = svc.people();
  const clients = state.db.USERS.filter((u) => u.role === 'client');
  return (
    <>
      <form onSubmit={submitBook} key={JSON.stringify(b)}>
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Field label="What for" className="sm:col-span-2"><Input name="title" required placeholder="Jagwani kitchen review" defaultValue={b.title || ''} /></Field>
          <Field label="Purpose">
            <Select name="purpose" defaultValue={b.purpose || 'office'}>
              {Object.entries(PURPOSE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Date"><Input type="date" name="date" defaultValue={b.date || TODAY} required /></Field>
          <Field label="Start">
            <Select name="start" defaultValue={b.start != null && b.start !== '' ? String(+b.start) : undefined}>
              {hours(wh.start, wh.end).map((h) => <option key={h} value={h}>{hh(h)}</option>)}
            </Select>
          </Field>
          <Field label="Length">
            <Select name="len" defaultValue={!b.len || +b.len === 1 ? '1' : String(b.len)}>
              <option value="0.5">30 min</option><option value="1">1 h</option><option value="1.5">1.5 h</option><option value="2">2 h</option>
            </Select>
          </Field>
          <Field label="With">
            <Select name="who" defaultValue={b.who || state.userId}>
              {people.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <Field label="Client">
            <Select name="clientId" defaultValue={b.clientId || ''}>
              <option value="">No client</option>
              {clients.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <Field label="Project">
            <Select name="projectId" defaultValue={b.projectId || ''}>
              <option value="">None</option>
              {state.db.PROJECTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Repeat">
            <Select name="repeat" defaultValue={b.repeat || ''}>
              <option value="">Once</option><option value="weekly">Weekly × 4</option>
            </Select>
          </Field>
        </div>
        <Btn kind="primary" type="submit" className="w-full justify-center">Book slot</Btn>
        <p className="mb-0 mt-2 text-xs text-ink-3">Office meeting reserves the room. Site visit reserves the site manager plus 1 h travel. Video call reserves people only.</p>
      </form>
      <ClashBox c={state.desk.clash} />
    </>
  );
}

function FreeSlots({ date }) {
  const wh = svc.cfg().hours;
  const draft = svc.prepBooking({ title: 'Meeting', purpose: 'office', date, start: wh.start, end: wh.start + 1, attendees: [state.userId] });
  const slots = svc.freeSlots(draft, 3);
  const pick = (x) => {
    Object.assign(state.desk.bookForm || (state.desk.bookForm = {}), { date: x.date, start: x.start, len: x.end - x.start });
    state.desk.clash = null;
    openDialog({ kind: 'book-slot', date: x.date });
  };
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2.5 text-[13px]">
      <span className="font-semibold text-ink-2">Next free</span>
      <span className="text-ink-3">·</span>
      {slots.length === 0 ? <span className="text-ink-3">No free slot in the next two weeks.</span> : slots.map((x, i) => (
        <ToggleChip key={i} on={false} disabled={!can('booking', 'w')} onClick={() => pick(x)}>
          {x.date === TODAY ? 'Today' : fmtD(x.date)} {hh(x.start)}–{hh(x.end)}
        </ToggleChip>
      ))}
    </div>
  );
}

export function BookSlotDialog({ d }) {
  return (
    <Modal title="Book a slot" wide>
      <BookForm date={d.date || TODAY} />
      <div className="mt-3 flex justify-end"><Btn onClick={closeDialog}>Cancel</Btn></div>
    </Modal>
  );
}

function Rooms({ q }) {
  const date = q.date || TODAY;
  const wh = svc.cfg().hours;
  const hrs = hours(wh.start, wh.end).filter((h) => h % 1 === 0);
  const bs = state.db.BOOKINGS.filter((b) => b.date === date && b.status !== 'declined');
  const nowH = date === TODAY ? new Date().getHours() : null;
  // The hour grid is wider than the page on most screens, so it scrolls horizontally inside its
  // own box. Native trackpad/scrollbar scrolling still works, but these arrow buttons make it
  // obvious and reliable that later hours (and the last column) are reachable, not cropped off.
  const gridRef = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const checkEdge = () => {
    const el = gridRef.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  };
  useEffect(checkEdge, [date]);
  // Jump by whole hour columns (not an arbitrary pixel amount) so the view always lands on a
  // clean column boundary instead of stopping mid-column, which would leave a sliver of the
  // previous cell's content peeking out from behind the sticky label column.
  const scrollGrid = (dir) => {
    const el = gridRef.current;
    if (!el) return;
    const colW = el.querySelector('thead th:nth-child(2)')?.offsetWidth || 120;
    el.scrollBy({ left: dir * colW * 2, behavior: 'smooth' });
  };
  const roomRows = state.db.ROOMS.map((r) => ({
    id: r.id,
    group: 'Rooms',
    title: `${r.name} · ${r.cap} seats`,
    label: <><b>{r.name}</b> <span className="text-ink-3">· {r.cap} seats{r.location && state.db.ROOMS.some((x) => x.location !== r.location) ? ' · ' + r.location : ''}</span></>,
    hit: (h) => bs.find((x) => x.roomId === r.id && x.start < h + 1 && x.end > h),
  }));
  const peopleRows = svc.people().map((u) => ({
    id: u.id,
    group: 'People',
    title: `${u.name} · ${ROLES[u.role].label}`,
    label: <><b className="font-medium">{u.name}</b> <span className="text-ink-3">· {ROLES[u.role].label}</span></>,
    hit: (h) => bs.find((x) => (x.attendees || []).includes(u.id) && x.start < h + 1 && x.end + (x.travel || 0) > h),
  }));
  // People/rooms with a meeting today sort to the top of their group, so the grid reads
  // busiest-first instead of making you scan past empty rows to find who has something on.
  const byBusy = (a, b) => hrs.some((h) => b.hit(h)) - hrs.some((h) => a.hit(h));
  const rows = [...roomRows.sort(byBusy), ...peopleRows.sort(byBusy)].map((r) => ({ ...r, busy: hrs.some((h) => r.hit(h)) }));
  const cell = (b, h) => {
    if (!b) return null;
    if (b.start > h - 1 && b.start <= h) {
      const ctx = b.projectId ? P(b.projectId).name : b.clientId ? name(b.clientId) : '';
      const tone = b.status === 'pending' ? TONE_SOFT.warn : b.kind === 'client' ? TONE_SOFT.ok : TONE_SOFT.accent;
      return (
        <div title={`${b.title}${ctx ? ' · ' + ctx : ''}${b.status === 'pending' ? ' · awaiting confirmation' : ''}`} className={`rounded-r1 border px-1.5 py-1 text-left leading-tight ${tone}`}>
          <div className="truncate text-[11px] font-semibold">{b.title}{b.status === 'pending' ? ' ?' : ''}</div>
          {ctx && <div className="truncate text-[10px] opacity-80">{ctx}</div>}
        </div>
      );
    }
    if (b.travel && h >= b.end) return <small className="text-ink-3">travel</small>;
    return <i className="mx-auto block h-1 w-6 rounded-full bg-accent/30" />;
  };
  const hol = state.db.HOLIDAYS.find((h) => h.date === date);
  const nav = 'inline-flex min-h-8 items-center px-3 text-[13px] font-semibold text-accent-text no-underline hover:bg-accent-soft';
  return (
    <div>
      <SecHead title={`${fmtD(date)}${date === TODAY ? ' · today' : ''}`} sub="Rooms and people as rows, office hours as columns.">
        {hol && <Pill kind="crit">{hol.name}</Pill>}
        <div className="inline-flex overflow-hidden rounded-r1 border border-line-2 bg-surface">
          <DLink className={nav} to={`#/schedule?tab=rooms&date=${dateShift(date, -1)}`}>‹ Prev</DLink>
          <DLink className={`${nav} border-x border-line-2`} to="#/schedule?tab=rooms">Today</DLink>
          <DLink className={nav} to={`#/schedule?tab=rooms&date=${dateShift(date, 1)}`}>Next ›</DLink>
        </div>
      </SecHead>
      <FreeSlots date={date} />
      {/* table-fixed + an explicit label-column width means the grid exactly fills its box at any
          width >= min-w, so the browser never shows a lingering/residual scrollbar when every
          column is already visible. Below min-w it still scrolls, and these buttons (shown only
          then) are a reliable, always-reachable way to the last column - placed in normal flow
          above the grid, never overlapping row or header text. */}
      {(!edge.start || !edge.end) && (
        <div className="mb-2 flex justify-end gap-1.5">
          <Btn sm disabled={edge.start} aria-label="Scroll earlier" onClick={() => scrollGrid(-1)} className="!min-h-8 !w-8 !rounded-full !px-0">
            <Icon name="chev" small className="rotate-180" />
          </Btn>
          <Btn sm disabled={edge.end} aria-label="Scroll later" onClick={() => scrollGrid(1)} className="!min-h-8 !w-8 !rounded-full !px-0">
            <Icon name="chev" small />
          </Btn>
        </div>
      )}
      <div ref={gridRef} onScroll={checkEdge} className="overflow-x-auto rounded-r3 border border-line bg-surface">
        <table className="w-full min-w-[920px] table-fixed border-collapse">
          <thead>
            <Tr>
              <Th className="sticky left-0 w-52 bg-surface-2" />
              {hrs.map((h) => (
                <Th key={h} align="center" className={nowH === h ? 'border-x border-accent text-accent-text' : ''}>
                  {hh(h)}
                  {nowH === h && <span className="ml-1 inline-block rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold leading-none text-accent-ink align-middle">now</span>}
                </Th>
              ))}
            </Tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <Fragment key={r.id}>
                {(i === 0 || rows[i - 1].group !== r.group) && (
                  <tr key={`g-${r.group}`}>
                    <td colSpan={hrs.length + 1} className={`px-2.5 pb-1.5 ${i === 0 ? 'pt-2.5' : 'border-t border-line pt-3.5'}`}>
                      <Pill kind="soft"><span className="tracking-[0.08em]">{r.group.toUpperCase()}</span></Pill>
                    </td>
                  </tr>
                )}
                <Tr className={r.busy ? '' : 'text-ink-3'}>
                  <Td title={r.title} className="sticky left-0 w-52 truncate bg-surface">{r.label}</Td>
                  {hrs.map((h) => {
                    const b = r.hit(h);
                    return (
                      <Td key={h} align="center" className={`border-l ${!b && nowH === h ? 'bg-accent/10' : ''}`}>
                        {cell(b, h)}
                      </Td>
                    );
                  })}
                </Tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-0 mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-accent" />Office</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-ok" />Client</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-warn" />Awaiting confirmation (?)</span>
        <span>Travel time is blocked after site visits</span>
      </p>
      {!state.db.ROOMS.length && <SubText className="mt-2">No rooms set up, so bookings check people only. Add rooms in Settings.</SubText>}
    </div>
  );
}

function Approvals() {
  const pend = svc.pendingBookings();
  const decided = state.db.BOOKINGS.filter((k) => k.clientId && k.status !== 'pending').slice(-5).reverse();
  const [sel, setSel] = useState({});
  const decide = (id, ok) => {
    const k = svc.decideBooking(id, ok);
    toast(ok ? `Confirmed. ${first(k.clientId || k.by)} gets a WhatsApp.` : 'Declined. Ask them for another time in chat.');
    render();
  };
  const bulk = (ok) => {
    const ids = pend.filter((k) => sel[k.id]).map((k) => k.id);
    if (!ids.length) return toast('Select at least one.');
    ids.forEach((id) => svc.decideBooking(id, ok));
    setSel({});
    toast(`${ids.length} booking${ids.length === 1 ? '' : 's'} ${ok ? 'confirmed' : 'declined'}.`);
    render();
  };
  const allSel = pend.length > 0 && pend.every((k) => sel[k.id]);
  return (
    <>
    <SecHead title="Client meeting requests" sub="Clients book only after their enquiry is accepted. Nothing goes on the calendar until an owner confirms." />
    <Card>
      {pend.length === 0 && (
        <div className="rounded-r2 bg-surface-2 px-4 py-8 text-center">
          <b className="block">No requests waiting</b>
          <span className="text-[13px] text-ink-3">New client meeting requests will appear here for you to confirm or decline.</span>
        </div>
      )}
      {pend.length > 0 && (
        <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={allSel} onChange={(e) => setSel(e.target.checked ? Object.fromEntries(pend.map((k) => [k.id, true])) : {})} /> Select all
          </label>
          <Btn sm kind="primary" onClick={() => bulk(true)}>Confirm selected</Btn>
          <Btn sm onClick={() => bulk(false)}>Decline selected</Btn>
        </div>
      )}
      {pend.length > 0 && <DataTable
        cols={['', 'When', 'Client', 'What', 'With', 'Purpose', '']}
        rows={pend.map((k) => [
          <input type="checkbox" checked={!!sel[k.id]} aria-label={`Select ${k.title}`} onChange={(e) => setSel({ ...sel, [k.id]: e.target.checked })} />,
          `${fmtD(k.date)} ${hh(k.start)}–${hh(k.end)}`,
          name(k.clientId || k.by),
          k.title,
          (k.attendees || []).filter((a) => a !== k.clientId).map(first).join(', '),
          PURPOSE[k.purpose] || '',
          <div className="flex gap-2">
            <Btn sm kind="primary" onClick={() => decide(k.id, true)}>Confirm</Btn>
            <Btn sm onClick={() => decide(k.id, false)}>Decline</Btn>
          </div>,
        ])}
      />}
    </Card>
    {decided.length > 0 && (
      <>
        <div className="mt-5"><SecHead title="Recently decided" sub="Client bookings you have already confirmed or declined." /></div>
        <Card>
          <DataTable
            cols={['When', 'Client', 'What', 'Outcome']}
            rows={decided.map((k) => [`${fmtD(k.date)} ${hh(k.start)}–${hh(k.end)}`, name(k.clientId || k.by), k.title, <StatusPill status={k.status === 'declined' ? 'declined' : 'approved'} />])}
          />
        </Card>
      </>
    )}
    </>
  );
}

function Records() {
  const recs = approvalRecords();
  const copy = () => {
    const rows = [['Kind', 'Project', 'Approver', 'What', 'When'], ...recs.map((r) => [r.kind, r.project, r.approver, r.value, r.at])];
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    navigator.clipboard?.writeText(csv);
    toast('CSV copied. Paste into a sheet.');
  };
  const kinds = [...new Set(recs.map((r) => r.kind))];
  return (
    <>
      <SecHead title="Approval records" sub="Every approval turned into a record: who approved, what, and when.">
        <Btn sm onClick={copy}>Copy CSV</Btn>
      </SecHead>
      {recs.length > 0 && (
        <div className="mb-3.5 grid grid-cols-2 gap-gap lg:grid-cols-4">
          <Stat label="Total records" value={recs.length} sub="all approvals" />
          {kinds.slice(0, 3).map((k) => <Stat key={k} label={k} value={recs.filter((r) => r.kind === k).length} sub="records" />)}
        </div>
      )}
    <Card>
      {recs.length ? (
        <DataTable
          cols={['Kind', 'Project', 'Approver', 'What', 'When']}
          rows={recs.map((r) => [r.kind, r.project, r.approver, r.value, r.at && r.at !== '—' ? fmtDT(r.at) : '—'])}
        />
      ) : <SubText>No approvals recorded yet.</SubText>}
    </Card>
    </>
  );
}

function Who() {
  const label = (a) => (a.mark === 'leave' ? 'on leave' : a.mark === 'half' ? 'half day' : a.mark === 'late' ? 'late' : a.in ? 'in' : 'not in');
  const people = svc.people();
  const att = (u) => state.db.ATTENDANCE_TODAY.find((x) => x.userId === u.id) || {};
  const count = (l) => people.filter((u) => label(att(u)) === l).length;
  return (
    <>
      <SecHead title="Who is where today" sub={`${fmtD(TODAY)} · attendance, leave and who can stand in.`} />
      <div className="mb-3.5 grid grid-cols-2 gap-gap lg:grid-cols-4">
        <Stat label="In" value={count('in')} sub="on time" tone="text-ok" />
        <Stat label="Late" value={count('late')} sub="after 09:30" tone={count('late') ? 'text-warn' : ''} />
        <Stat label="On leave" value={count('on leave')} sub="away today" />
        <Stat label="Not in yet" value={count('not in') + count('half day')} sub="no check-in" />
      </div>
      <div className="grid items-start gap-gap xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <Card title="Team">
          <DataTable
            cols={['Person', 'In', 'Status', 'Note', 'Stand-in if needed']}
            rows={people.map((u) => {
              const a = att(u);
              return [
                u.name,
                a.in || '—',
                <StatusPill status={label(a)} />,
                a.note || '',
                a.mark === 'leave' ? svc.standIns(u.id).map((x) => first(x.u.id)).join(', ') || '—' : '',
              ];
            })}
          />
        </Card>
        <Card title="Partners">
          {people.filter((u) => u.role === 'partner').map((u) => {
            const bk = state.db.BOOKINGS.filter((b) => b.date === TODAY && (b.attendees || []).includes(u.id)).sort((x, y) => x.start - y.start);
            return (
              <div key={u.id} className="border-t border-line py-2.5 first:border-t-0 first:pt-0">
                <div className="flex items-baseline justify-between gap-2">
                  <b>{u.name}</b>
                  <span className="text-xs font-semibold text-accent-text">{bk.length ? `Free from ${hh(Math.max(...bk.map((b) => b.end)))}` : 'Free now'}</span>
                </div>
                <small className="block text-ink-3">{bk.length ? bk.map((b) => `${hh(b.start)} ${b.title}`).join(' · ') : 'No meetings today'}</small>
              </div>
            );
          })}
        </Card>
      </div>
    </>
  );
}

// Four weekly columns starting the day before today, labelled like the calendar (for example "8 Sept").
export const WEEKS = [-1, 6, 13, 20].map((n) => new Date(`${addDays(TODAY, n)}T00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
export function LoadGrid({ reassign = false }) {
  const tone = (tot) => (tot > 40 ? 'bg-crit-soft text-crit' : tot < 24 ? 'bg-surface-2 text-ink-3' : '');
  const doReassign = (ri, wi, to) => {
    if (!to) return;
    const src = RESOURCE[ri];
    const wk = src.weeks[wi];
    let tgt = RESOURCE.find((r) => r.userId === to);
    if (!tgt) {
      tgt = { userId: to, weeks: src.weeks.map(() => ({})) };
      RESOURCE.push(tgt);
    }
    Object.entries(wk).forEach(([proj, h]) => {
      tgt.weeks[wi][proj] = (tgt.weeks[wi][proj] || 0) + h;
    });
    src.weeks[wi] = {};
    toast('Reassigned.');
    render();
  };
  return (
    <Table>
        <thead>
          <tr>
            <Th>Person</Th>
            {WEEKS.map((w) => <Th key={w}>Week of {w}</Th>)}
          </tr>
        </thead>
        <tbody>
          {RESOURCE.map((r, ri) => (
            <Tr key={r.userId}>
              <Td className="font-medium">{name(r.userId)}</Td>
              {r.weeks.map((w, wi) => {
                const tot = Object.values(w).reduce((a, b) => a + b, 0);
                const entries = Object.entries(w);
                return (
                  <Td key={wi} className={`!align-top !whitespace-normal ${tone(tot)}`}>
                    {entries.length
                      ? entries.map(([p, h]) => <div key={p}>{P(p).name.split(' ')[0]} {h}</div>)
                      : <span className="text-ink-3">Free</span>}
                    <small className="text-ink-3">{tot} h</small>
                    {reassign && tot > 0 && (
                      <div>
                        <Select
                          className="mt-1 !min-h-7 text-xs"
                          value=""
                          aria-label={`Reassign ${name(r.userId)} week of ${WEEKS[wi]}`}
                          onChange={(e) => doReassign(ri, wi, e.target.value)}
                        >
                          <option value="">Reassign to…</option>
                          {svc.people().filter((u) => u.id !== r.userId).map((u) => <option key={u.id} value={u.id}>{first(u.id)}</option>)}
                        </Select>
                      </div>
                    )}
                  </Td>
                );
              })}
            </Tr>
          ))}
        </tbody>
      </Table>
  );
}

function Resource() {
  const tot = (r, wi) => Object.values(r.weeks[wi] || {}).reduce((n, h) => n + h, 0);
  const cells = RESOURCE.flatMap((r) => WEEKS.map((_, wi) => tot(r, wi)));
  const over = cells.filter((t) => t > 40).length;
  const under = cells.filter((t) => t < 24).length;
  const avg = cells.length ? Math.round(cells.reduce((n, t) => n + t, 0) / cells.length) : 0;
  return (
    <>
      <SecHead title="Resource plan, next 4 weeks" sub="Hours per person per project, week by week." />
      <div className="mb-3.5 grid grid-cols-2 gap-gap lg:grid-cols-4">
        <Stat label="People planned" value={RESOURCE.length} sub={`${WEEKS.length} weeks`} />
        <Stat label="Average load" value={`${avg} h`} sub="per person per week" />
        <Stat label="Over 40 h" value={over} sub="person-weeks overloaded" tone={over ? 'text-crit' : 'text-ok'} />
        <Stat label="Under 24 h" value={under} sub="person-weeks with room" />
      </div>
      <Card>
        <p className="mb-3 mt-0 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-crit-soft ring-1 ring-crit" />Over 40 h</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-surface-2 ring-1 ring-line-2" />Under 24 h</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-surface ring-1 ring-line-2" />Balanced</span>
        </p>
        <LoadGrid />
      </Card>
    </>
  );
}

// A month grid, no calendar library - matches the app's plain-table/canvas visual style.
// Monday-first weeks; a day cell shows any org holiday plus a dot per person on leave that day.
function datesInRange(startISO, endISO) {
  const out = [];
  const cur = new Date(startISO.slice(0, 10) + 'T00:00:00.000Z');
  const end = new Date(endISO.slice(0, 10) + 'T00:00:00.000Z');
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}
function MonthCalendar({ month, holidays, leaveRequests }) {
  const [y, m] = month.split('-').map(Number);
  const totalDays = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const startWeekday = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday = 0

  const holidaysByDate = {};
  holidays.forEach((h) => {
    const k = h.date.slice(0, 10);
    (holidaysByDate[k] = holidaysByDate[k] || []).push(h);
  });
  const leaveByDate = {};
  leaveRequests.filter((l) => ['approved', 'pending'].includes(l.status)).forEach((l) => {
    datesInRange(l.startDate, l.endDate).forEach((k) => {
      (leaveByDate[k] = leaveByDate[k] || []).push(l);
    });
  });

  const cells = [...Array(startWeekday).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];
  return (
    <div className="grid grid-cols-7 gap-1 text-[12px]">
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
        <div key={d} className="text-center font-semibold text-ink-3">{d}</div>
      ))}
      {cells.map((d, i) => {
        if (!d) return <div key={i} />;
        const key = `${month}-${String(d).padStart(2, '0')}`;
        const hs = holidaysByDate[key] || [];
        const lv = leaveByDate[key] || [];
        return (
          <div key={i} className="min-h-[58px] rounded-r1 border border-line p-1">
            <div className="text-ink-3">{d}</div>
            {hs.map((h) => (
              <div
                key={h.id}
                title={h.name}
                className={`mt-0.5 truncate rounded px-1 text-[10px] font-medium text-white ${h.type === 'mandatory' ? 'bg-crit' : 'bg-warn'}`}
              >
                {h.name}
              </div>
            ))}
            {lv.length > 0 && (
              <div className="mt-0.5 flex flex-wrap gap-0.5">
                {lv.map((l) => (
                  <span
                    key={l.id}
                    title={`${l.employee?.name || 'Someone'} · ${l.leaveType?.name || 'Leave'} · ${l.status}`}
                    className={`h-2 w-2 rounded-full ${l.status === 'approved' ? 'bg-ok' : 'bg-line-2'}`}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
      <p className="col-span-7 mt-1 text-ink-3">
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-crit align-middle" /> Mandatory holiday
        <span className="ml-3 mr-1 inline-block h-2 w-2 rounded-full bg-warn align-middle" /> Optional holiday
        <span className="ml-3 mr-1 inline-block h-2 w-2 rounded-full bg-ok align-middle" /> Approved leave
        <span className="ml-3 mr-1 inline-block h-2 w-2 rounded-full bg-line-2 align-middle" /> Pending leave
      </p>
    </div>
  );
}

// Org Holiday Management, backed by the mock ../../api/leaveClient.js (state.db.ORG_HOLIDAYS).
// The old mock "push a holiday notice to site groups" demo (tied to the separate mock
// LEAVES/HOLIDAYS/chat-thread data) is kept below as-is, unrelated to this.
export function Holidays() {
  const manage = can('holiday', 'w');
  const [holidays, setHolidays] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(TODAY.slice(0, 7));

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([listHolidays(), listLeaveRequests({})])
      .then(([h, l]) => { setHolidays(h); setLeaveRequests(l); })
      .catch((e) => setError(e.message || 'Could not load holidays.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const remove = (h) => {
    if (!window.confirm(`Delete "${h.name}"?`)) return;
    deleteHoliday(h.id).then(() => { toast('Holiday deleted.'); load(); }).catch((e) => toast(e.message));
  };
  const shiftMonth = (delta) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <Card title="Holidays">
      {error && <p className="mb-2.5 text-crit">{error}</p>}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-lg font-semibold">Calendar</h2>
        <div className="flex items-center gap-2">
          <Btn sm onClick={() => shiftMonth(-1)}>‹ Prev</Btn>
          <b>{month}</b>
          <Btn sm onClick={() => shiftMonth(1)}>Next ›</Btn>
        </div>
      </div>
      {loading ? <Muted>Loading…</Muted> : <MonthCalendar month={month} holidays={holidays} leaveRequests={leaveRequests} />}

      <div className="mb-2.5 mt-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-lg font-semibold">Holidays</h2>
        {manage && <Btn kind="primary" onClick={() => openDialog({ kind: 'holiday-edit', onSaved: load })}>Add holiday</Btn>}
      </div>
      {!loading && (
        <DataTable
          cols={['Date', 'Holiday', 'Type', 'Description', ...(manage ? [''] : [])]}
          rows={holidays.map((h) => [
            fmtD(h.date.slice(0, 10)), h.name,
            <Pill kind={h.type === 'mandatory' ? '' : 'soft'}>{h.type === 'mandatory' ? 'Mandatory' : 'Optional'}</Pill>,
            h.description || '',
            ...(manage ? [(
              <div className="flex gap-2">
                <Btn sm onClick={() => openDialog({ kind: 'holiday-edit', holiday: h, onSaved: load })}>Edit</Btn>
                <Btn sm onClick={() => remove(h)}>Delete</Btn>
              </div>
            )] : []),
          ])}
        />
      )}

      <H2>Push a holiday notice to site groups</H2>
      <SubText>Demo feature, unrelated to the org holiday list above - posts a message to every site chat group.</SubText>
      <DataTable
        cols={['Date', 'Holiday', '']}
        rows={state.db.HOLIDAYS.map((h) => [
          fmtD(h.date),
          h.name,
          ['partner', 'hr'].includes(state.role) && can('thread', 'w')
            ? h.pushed
              ? `Pushed ${fmtD(h.pushed)}`
              : (
                <Btn sm onClick={() => {
                  const n = svc.pushHoliday(h.date);
                  toast(`Pushed to ${n} site group${n === 1 ? '' : 's'}.`);
                  render();
                }}>Push to site groups</Btn>
              )
            : '',
        ])}
      />
    </Card>
  );
}

function Reminders() {
  const add = (e) => {
    e.preventDefault();
    const p = Object.fromEntries(new FormData(e.currentTarget));
    state.desk.reminders.push({ id: uid(), text: p.text, when: p.when, who: state.userId, ref: '' });
    persist();
    e.currentTarget.reset();
    toast('Reminder set.');
    render();
  };
  const list = state.desk.reminders.slice().sort((a, b) => String(a.when).localeCompare(String(b.when)));
  const due = (r) => {
    const d = String(r.when).slice(0, 10);
    return d < TODAY ? ['Overdue', 'crit'] : d === TODAY ? ['Today', 'warn'] : ['Upcoming', 'soft'];
  };
  return (
    <>
      <SecHead title="Reminders" sub={`${list.length} open · tied to you, with a link back to the record where there is one.`} />
      <Card title="New reminder" className="mb-3.5">
        <form onSubmit={add} className="flex flex-wrap items-center gap-2.5">
          <Input name="text" placeholder="Remind me to…" required className="min-w-[240px] flex-1" />
          <Input type="datetime-local" name="when" defaultValue={`${addDays(TODAY, 1)}T10:00`} aria-label="When" />
          <Btn kind="primary" type="submit">Add reminder</Btn>
        </form>
      </Card>
      {list.length === 0 ? (
        <Card><div className="rounded-r2 bg-surface-2 px-4 py-8 text-center"><b className="block">No reminders</b><span className="text-[13px] text-ink-3">Add one above and it will show here with its due date.</span></div></Card>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((r) => {
            const [lbl, kind] = due(r);
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-r3 border border-line bg-surface px-4 py-3">
                <span className="min-w-0 flex-1">
                  <b className="block">{r.text}</b>
                  <small className="text-ink-3">{fmtDT(r.when)} · {first(r.who)}</small>
                </span>
                <Pill kind={kind}>{lbl}</Pill>
                {r.ref ? <TextLink to={r.ref}>Open</TextLink> : null}
                <Btn sm onClick={() => { state.desk.reminders = state.desk.reminders.filter((x) => x.id !== r.id); persist(); render(); }}>Done</Btn>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function Schedule({ q }) {
  const tab = q.tab || 'rooms';
  const pend = svc.pendingBookings().length;
  const today = state.db.BOOKINGS.filter((b) => b.date === TODAY && b.status !== 'declined');
  const away = state.db.ATTENDANCE_TODAY.filter((a) => a.mark === 'leave').length;
  const next = state.db.HOLIDAYS.filter((h) => h.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date))[0];
  const daysTo = next ? Math.round((new Date(next.date) - new Date(TODAY)) / 864e5) : null;
  const list = [
    ['rooms', 'Calendar'],
    ...(can('booking', 'a') ? [['approvals', `Approvals${pend ? ' · ' + pend : ''}`]] : []),
    ['records', 'Approval records'],
    ['people', 'Who is where'],
    ['resource', 'Resource plan'],
    ['holidays', 'Holidays'],
    ['reminders', 'Reminders'],
  ];
  const body = {
    rooms: <Rooms q={q} />,
    approvals: <Approvals />,
    records: <Records />,
    people: <Who />,
    resource: <Resource />,
    holidays: <Holidays />,
    reminders: <Reminders />,
  }[tab] || <Rooms q={q} />;
  return (
    <>
      <PageHeader title="Schedule" sub="Meetings, approvals, who is where and the resource plan.">
        {can('booking', 'w') && (
          <Btn kind="primary" icon="plus" onClick={() => openDialog({ kind: 'book-slot', date: q.date || TODAY })}>Book a slot</Btn>
        )}
      </PageHeader>
      <Card className="mb-4 !py-2.5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px]">
          <span><b className="text-accent-text">{today.length}</b> <span className="text-ink-3">meeting{today.length === 1 ? '' : 's'} today</span></span>
          <span className="text-line-2">·</span>
          <span className={pend ? 'font-semibold text-warn' : 'text-ink-3'}>{pend ? `${pend} awaiting approval` : 'All clear on approvals'}</span>
          <span className="text-line-2">·</span>
          <span><b className="text-accent-text">{away}</b> <span className="text-ink-3">away today</span></span>
          <span className="text-line-2">·</span>
          <span className="text-ink-3">Next holiday {next ? `${fmtD(next.date)} · ${next.name} · in ${daysTo} day${daysTo === 1 ? '' : 's'}` : 'none scheduled'}</span>
        </div>
      </Card>
      <Tabs base={tabBase('schedule')} list={list} current={tab} />
      {body}
    </>
  );
}
