import { state, svc, user, fmtD, hh } from '../../shared/core.js';
import { TODAY } from '../../shared/data.js';
import { Btn, Card, Field, Input, Select, StatusPill, DataTable, Grid3 } from '../../ui/ui';
import { first } from '../helpers';
import { ClashBox, PURPOSE, SubText, Muted, hours, dateShift, submitBook } from './common';

export function MeetLinks({ b }) {
  const m = svc.meetUrl(b);
  const c = svc.calendarUrl(b);
  return (
    <span className="inline-flex gap-1.5">
      {m && <a className="inline-flex min-h-8 items-center rounded-r1 border border-line-2 px-2.5 text-[13px] font-semibold text-ink no-underline hover:bg-surface-2" href={m} target="_blank" rel="noopener noreferrer">Join Meet</a>}
      {c && <a className="inline-flex min-h-8 items-center rounded-r1 border border-line-2 px-2.5 text-[13px] font-semibold text-ink no-underline hover:bg-surface-2" href={c} target="_blank" rel="noopener noreferrer">Add to Google Calendar</a>}
    </span>
  );
}

// Client-side meetings card for a project (usable by the project meetings tab).
export default function MeetingsCard({ p }) {
  const my = state.db.BOOKINGS.filter((k) => k.clientId === state.userId || (k.attendees || []).includes(state.userId))
    .filter((k) => k.date >= TODAY && k.status !== 'declined')
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  const b = state.desk.bookForm || {};
  const team = p.teamIds.map((id) => user(id));
  const wh = svc.cfg().hours;
  return (
    <div className="grid gap-3.5">
      <Card title="Your meetings">
        <DataTable
          cols={['When', 'What', 'With', 'Status', '']}
          rows={my.map((k) => [
            `${fmtD(k.date)} ${hh(k.start)}`,
            k.title,
            (k.attendees || []).filter((a) => a !== state.userId).map(first).join(', '),
            <StatusPill status={k.status === 'pending' ? 'awaiting studio' : k.status || 'confirmed'} />,
            <MeetLinks b={k} />,
          ])}
        />
        <SubText className="mt-2">Reminders come on WhatsApp the day before and one hour before. To move a meeting, message the studio.</SubText>
      </Card>
      <Card title="Book a meeting">
        <form onSubmit={submitBook} key={JSON.stringify(b)}>
          <Field label="Purpose">
            <Select name="purpose" defaultValue={b.purpose || 'office'}>
              {Object.entries(PURPOSE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          <Field label="With">
            <Select name="who" defaultValue={b.who || team[0]?.id}>
              {team.map((u) => <option key={u.id} value={u.id}>{u.name}, {u.title.split(' · ')[0]}</option>)}
            </Select>
          </Field>
          <Grid3>
            <Field label="Date"><Input type="date" name="date" defaultValue={b.date || dateShift(TODAY, 1)} min={TODAY} required /></Field>
            <Field label="Time">
              <Select name="start" defaultValue={String(+b.start || '')}>
                {hours(wh.start, wh.end).map((h) => <option key={h} value={h}>{hh(h)}</option>)}
              </Select>
            </Field>
            <Field label="Length">
              <Select name="len" defaultValue="1"><option value="0.5">30 min</option><option value="1">1 h</option></Select>
            </Field>
          </Grid3>
          <input type="hidden" name="title" value={`${p.name} · client meeting`} />
          <input type="hidden" name="projectId" value={p.id} />
          <div className="flex items-center gap-2.5">
            <Btn kind="primary" type="submit">Request meeting</Btn>
            <Muted>The studio confirms, then you get a WhatsApp.</Muted>
          </div>
        </form>
        <ClashBox c={state.desk.clash} />
      </Card>
    </div>
  );
}
