import { useEffect, useState } from 'react';
import { state, svc, can, fmtD, fmtDT, hh, toast, render, uid, persist } from '../../shared/core.js';
import { ROLES } from '../../shared/data.js';
import { RESOURCE } from '../data';
import { Btn, Card, Field, Grid3, Input, PageHeader, Pill, Select, StatusPill, Tabs, DataTable } from '../../ui/ui';
import { P, first, name } from '../helpers';
import { DLink } from '../nav';
import { openDialog } from '../session';
import { deleteHoliday, listHolidays, listLeaveRequests } from '../../api/leaveClient';
import {
  ClashBox, H2, Muted, PURPOSE, SubText, TODAY, TextLink, approvalRecords, dateShift, hours, submitBook, tabBase,
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
        <Grid3>
          <Field label="What for"><Input name="title" required placeholder="Jagwani kitchen review" defaultValue={b.title || ''} /></Field>
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
        </Grid3>
        <div className="flex flex-wrap items-center gap-2.5">
          <Btn kind="primary" type="submit">Book</Btn>
          <Muted>Office meeting reserves the room. Site visit reserves the site manager plus 1 h travel. Video call reserves people only.</Muted>
        </div>
      </form>
      <ClashBox c={state.desk.clash} />
    </>
  );
}

function Rooms({ q }) {
  const date = q.date || TODAY;
  const wh = svc.cfg().hours;
  const hrs = hours(wh.start, wh.end).filter((h) => h % 1 === 0);
  const bs = state.db.BOOKINGS.filter((b) => b.date === date && b.status !== 'declined');
  const rows = [
    ...state.db.ROOMS.map((r) => ({
      id: r.id,
      label: (
        <>
          <b>{r.name}</b><br />
          <small className="text-ink-3">{r.cap} seats{r.location && state.db.ROOMS.some((x) => x.location !== r.location) ? ' · ' + r.location : ''}</small>
        </>
      ),
      hit: (h) => bs.find((x) => x.roomId === r.id && x.start < h + 1 && x.end > h),
    })),
    ...svc.people().map((u) => ({
      id: u.id,
      label: <>{u.name}<br /><small className="text-ink-3">{ROLES[u.role].label}</small></>,
      hit: (h) => bs.find((x) => (x.attendees || []).includes(u.id) && x.start < h + 1 && x.end + (x.travel || 0) > h),
    })),
  ];
  const cell = (b, h) => {
    if (!b) return null;
    if (b.start > h - 1 && b.start <= h) {
      return <Pill kind={b.status === 'pending' ? 'warn' : b.kind === 'client' ? 'ok' : 'soft'}><span title={b.title}>{b.title.slice(0, 22)}{b.status === 'pending' ? ' ?' : ''}</span></Pill>;
    }
    if (b.travel && h >= b.end) return <small className="text-ink-3">travel</small>;
    return '·';
  };
  const hol = state.db.HOLIDAYS.find((h) => h.date === date);
  const nav = 'inline-flex min-h-8 items-center rounded-r1 border border-line-2 bg-surface px-2.5 text-[13px] font-semibold text-ink no-underline hover:bg-surface-2';
  return (
    <Card>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-lg font-semibold">
          {fmtD(date)}{date === TODAY ? ' · today' : ''}{hol && <> · <Pill kind="crit">{hol.name}</Pill></>}
        </h2>
        <div className="flex gap-2">
          <DLink className={nav} to={`#/schedule?tab=rooms&date=${dateShift(date, -1)}`}>‹ Prev</DLink>
          <DLink className={nav} to="#/schedule?tab=rooms">Today</DLink>
          <DLink className={nav} to={`#/schedule?tab=rooms&date=${dateShift(date, 1)}`}>Next ›</DLink>
        </div>
      </div>
      <div className="overflow-x-auto rounded-r3 border border-line">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="border-b border-line bg-surface-2 p-2" />
              {hrs.map((h) => <th key={h} className="border-b border-line bg-surface-2 p-2 text-xs font-semibold text-ink-2">{hh(h)}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap border-b border-line p-2">{r.label}</td>
                {hrs.map((h) => {
                  const b = r.hit(h);
                  return <td key={h} className={`border-b border-line p-1.5 text-center ${b ? 'bg-accent-soft' : ''}`}>{cell(b, h)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!state.db.ROOMS.length && <SubText className="mt-2">No rooms set up, so bookings check people only. Add rooms in Settings.</SubText>}
      {can('booking', 'w') && (
        <>
          <H2 className="mt-[18px]">Book</H2>
          <BookForm date={date} clientId={q.client} />
        </>
      )}
    </Card>
  );
}

function Approvals() {
  const pend = svc.pendingBookings();
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
    <Card title="Client meeting requests">
      <SubText>Clients book only after their enquiry is accepted. Nothing goes on the calendar until an owner confirms.</SubText>
      {pend.length > 0 && (
        <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={allSel} onChange={(e) => setSel(e.target.checked ? Object.fromEntries(pend.map((k) => [k.id, true])) : {})} /> Select all
          </label>
          <Btn sm kind="primary" onClick={() => bulk(true)}>Confirm selected</Btn>
          <Btn sm onClick={() => bulk(false)}>Decline selected</Btn>
        </div>
      )}
      <DataTable
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
      />
    </Card>
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
  return (
    <Card>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-lg font-semibold">Approval records</h2>
        <Btn sm onClick={copy}>Copy CSV</Btn>
      </div>
      <SubText>Every approval turned into a record: who approved, what, and when.</SubText>
      {recs.length ? (
        <DataTable
          cols={['Kind', 'Project', 'Approver', 'What', 'When']}
          rows={recs.map((r) => [r.kind, r.project, r.approver, r.value, r.at && r.at !== '—' ? fmtDT(r.at) : '—'])}
        />
      ) : <SubText>No approvals recorded yet.</SubText>}
    </Card>
  );
}

function Who() {
  const label = (a) => (a.mark === 'leave' ? 'on leave' : a.mark === 'half' ? 'half day' : a.mark === 'late' ? 'late' : a.in ? 'in' : 'not in');
  return (
    <Card title="Who is where today">
      <DataTable
        cols={['Person', 'In', 'Status', 'Note', 'Stand-in if needed']}
        rows={svc.people().map((u) => {
          const a = state.db.ATTENDANCE_TODAY.find((x) => x.userId === u.id) || {};
          return [
            u.name,
            a.in || '—',
            <StatusPill status={label(a)} />,
            a.note || '',
            a.mark === 'leave' ? svc.standIns(u.id).map((x) => first(x.u.id)).join(', ') || '—' : '',
          ];
        })}
      />
      <H2>Partners</H2>
      <DataTable
        cols={['Partner', 'Today', 'Next free']}
        rows={svc.people().filter((u) => u.role === 'partner').map((u) => {
          const bk = state.db.BOOKINGS.filter((b) => b.date === TODAY && (b.attendees || []).includes(u.id));
          return [
            u.name,
            bk.map((b) => `${hh(b.start)} ${b.title}`).join(', ') || 'Free',
            bk.length ? hh(Math.max(...bk.map((b) => b.end))) : 'Now',
          ];
        })}
      />
    </Card>
  );
}

export const WEEKS = ['8 Sep', '15 Sep', '22 Sep', '29 Sep'];
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
    <div className="overflow-x-auto rounded-r3 border border-line">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="border-b border-line bg-surface-2 p-2 text-left text-xs">Person</th>
            {WEEKS.map((w) => <th key={w} className="border-b border-line bg-surface-2 p-2 text-left text-xs">Week of {w}</th>)}
          </tr>
        </thead>
        <tbody>
          {RESOURCE.map((r, ri) => (
            <tr key={r.userId}>
              <td className="border-b border-line p-2"><b>{name(r.userId)}</b></td>
              {r.weeks.map((w, wi) => {
                const tot = Object.values(w).reduce((a, b) => a + b, 0);
                const entries = Object.entries(w);
                return (
                  <td key={wi} className={`border-b border-line p-2 align-top ${tone(tot)}`}>
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
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Resource() {
  return (
    <Card title="Resource plan, next 4 weeks">
      <SubText>Hours per person per project. Over 40 is red, under 24 is grey.</SubText>
      <LoadGrid />
    </Card>
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
    toast('Reminder set.');
  };
  return (
    <Card>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-lg font-semibold">Reminders</h2>
        <form onSubmit={add} className="flex flex-wrap items-center gap-2">
          <Input name="text" placeholder="Remind me to…" required />
          <Input type="datetime-local" name="when" defaultValue="2026-09-10T10:00" aria-label="When" />
          <Btn type="submit">Add</Btn>
        </form>
      </div>
      <DataTable
        cols={['Reminder', 'When', 'For', '', '']}
        rows={state.desk.reminders.map((r) => [
          r.text,
          fmtDT(r.when),
          first(r.who),
          r.ref ? <TextLink to={r.ref}>Open</TextLink> : '',
          <Btn sm onClick={() => { state.desk.reminders = state.desk.reminders.filter((x) => x.id !== r.id); persist(); render(); }}>Done</Btn>,
        ])}
      />
    </Card>
  );
}

export default function Schedule({ q }) {
  const tab = q.tab || 'rooms';
  const pend = svc.pendingBookings().length;
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
      <PageHeader title="Schedule" sub="Meetings, approvals, who is where and the resource plan." />
      <Tabs base={tabBase('schedule')} list={list} current={tab} />
      {body}
    </>
  );
}
