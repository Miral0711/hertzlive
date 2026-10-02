import { state, svc, user, fmtD, hh, toast, render, isoDay } from '../../shared/core.js';
import { TODAY } from '../../shared/data.js';
import { Btn, Card, DataTable, Field, Input, Select, StatusPill } from '../../ui/ui';
import { first } from '../helpers';
import { formData } from '../session';

const PURPOSE = { office: 'Office meeting', site: 'Site visit', video: 'Video call' };
const hours = (from, to) => {
  const a = [];
  for (let h = from; h < to; h += 0.5) a.push(h);
  return a;
};
const dateShift = (d, n) => {
  const x = new Date(`${d}T00:00:00`);
  x.setDate(x.getDate() + n);
  return isoDay(x);
};

function book(form) {
  const p = formData(form);
  state.desk.bookForm = p;
  const b = {
    title: p.title,
    purpose: p.purpose,
    date: p.date,
    start: +p.start,
    end: +p.start + +(p.len || 1),
    attendees: [...new Set([state.userId, p.who].filter(Boolean))],
    clientId: p.clientId || undefined,
    projectId: p.projectId || undefined,
    repeat: p.repeat || undefined,
  };
  if (b.clientId && !b.attendees.includes(b.clientId)) b.attendees.push(b.clientId);
  const r = svc.book(b);
  if (r.conflict) {
    state.desk.clash = {
      msg: (r.at && r.at !== b.date ? `${fmtD(r.at)}: ` : '') + r.conflict.msg,
      slots: svc.freeSlots(svc.prepBooking(b)),
    };
    render();
  } else {
    state.desk.clash = null;
    state.desk.bookForm = null;
    toast(r.pending ? 'Requested. The studio will confirm.' : 'Booked.');
  }
}
function bookSlot(x) {
  Object.assign(state.desk.bookForm, { date: x.date, start: x.start, len: x.end - x.start });
  state.desk.clash = null;
  render();
}

function MeetLinks({ k }) {
  const m = svc.meetUrl(k);
  const c = svc.calendarUrl(k);
  // Same class string as the studio/MeetingsCard.jsx counterpart (and the other external,
  // target="_blank" button-styled links across the app) - these are real anchors, not Btn,
  // because Btn only renders <Link>/<button>, never an external new-tab anchor.
  const cls = 'inline-flex min-h-8 items-center rounded-r1 border border-line-2 px-2.5 text-[13px] font-semibold text-ink no-underline hover:bg-surface-2';
  return (
    <span className="inline-flex gap-1.5">
      {m && <a className={cls} href={m} target="_blank" rel="noopener noreferrer">Join Meet</a>}
      {c && <a className={cls} href={c} target="_blank" rel="noopener noreferrer">Add to Google Calendar</a>}
    </span>
  );
}

function ClashBox({ c }) {
  if (!c) return null;
  return (
    <div className="mt-3 rounded-r2 bg-accent-soft p-3 text-accent-text">
      <b>{c.msg}</b><br /><small>Next free:</small>
      {c.slots.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {c.slots.map((x) => <Btn key={`${x.date}${x.start}`} sm onClick={() => bookSlot(x)}>{fmtD(x.date)} {hh(x.start)}</Btn>)}
        </div>
      ) : <p className="mb-0">No free slot in the next two weeks.</p>}
    </div>
  );
}

// Client home: their meetings plus a request form (prototype meetingsCard).
export default function MeetingsCard({ p }) {
  const my = state.db.BOOKINGS
    .filter((k) => k.clientId === state.userId || (k.attendees || []).includes(state.userId))
    .filter((k) => k.date >= TODAY && k.status !== 'declined')
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  const b = state.desk.bookForm || {};
  const team = p.teamIds.map((id) => user(id));
  const wh = svc.cfg().hours;
  return (
    <div className="mb-3.5 grid gap-gap">
      <Card title="Your meetings">
        <DataTable
          cols={['When', 'What', 'With', 'Status', '']}
          rows={my.map((k) => [
            `${fmtD(k.date)} ${hh(k.start)}`,
            k.title,
            (k.attendees || []).filter((a) => a !== state.userId).map(first).join(', '),
            <StatusPill status={k.status === 'pending' ? 'awaiting studio' : k.status || 'confirmed'} />,
            <MeetLinks k={k} />,
          ])}
        />
        <p className="mb-0 text-[13px] text-ink-3">Reminders come on WhatsApp the day before and one hour before. To move a meeting, message the studio.</p>
      </Card>
      <Card title="Book a meeting">
        <form
          key={JSON.stringify(b)}
          className="max-w-[560px]"
          onSubmit={(e) => { e.preventDefault(); book(e.currentTarget); }}
        >
          <Field label="Purpose">
            <Select name="purpose" defaultValue={b.purpose}>
              {Object.entries(PURPOSE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          <Field label="With">
            <Select name="who" defaultValue={b.who}>
              {team.map((u) => <option key={u.id} value={u.id}>{u.name}, {u.title.split(' · ')[0]}</option>)}
            </Select>
          </Field>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Date"><Input type="date" name="date" defaultValue={b.date || dateShift(TODAY, 1)} min={TODAY} required /></Field>
            <Field label="Time">
              <Select name="start" defaultValue={b.start}>
                {hours(wh.start, wh.end).map((h) => <option key={h} value={h}>{hh(h)}</option>)}
              </Select>
            </Field>
            <Field label="Length">
              <Select name="len" defaultValue={b.len || '1'}>
                <option value="0.5">30 min</option>
                <option value="1">1 h</option>
              </Select>
            </Field>
          </div>
          <input type="hidden" name="title" value={`${p.name} · client meeting`} />
          <input type="hidden" name="projectId" value={p.id} />
          <div className="flex flex-wrap items-center gap-3">
            <Btn kind="primary" type="submit">Request meeting</Btn>
            <small className="text-ink-3">The studio confirms, then you get a WhatsApp.</small>
          </div>
        </form>
        <ClashBox c={state.desk.clash} />
      </Card>
    </div>
  );
}
