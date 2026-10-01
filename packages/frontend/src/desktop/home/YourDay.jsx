// "Your day" strip on the Today page: punch in/out, today's meetings and the user's next tasks.
import { state, svc, fmtD, render, toast } from '../../shared/core.js';
import { TODAY } from '../../shared/data.js';
import { Btn, Card, Pill } from '../../ui/ui';
import { DLink } from '../nav';
import { first } from '../helpers';

const hh = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`;
const dots = ['bg-accent', 'bg-secondary', 'bg-ok', 'bg-warn'];
const Empty = ({ children }) => <p className="m-0 rounded-r2 bg-surface-2 px-3.5 py-5 text-center text-ink-3">{children}</p>;

export function ScheduleCard() {
  const rows = svc.bookings(TODAY).sort((a, b) => a.start - b.start);
  return (
    <Card title="Today's schedule">
      {rows.length === 0 ? <Empty>No meetings today.</Empty> : rows.map((b, i) => (
        <div key={b.id} className="flex gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0">
          <span className="w-12 flex-none pt-px text-[13px] font-semibold tabular-nums text-accent-text">{hh(b.start)}</span>
          <span className="min-w-0 flex-1">
            <b className="block truncate">{b.title}</b>
            <small className="text-ink-3">{hh(b.start)}–{hh(b.end)}{b.by ? ` · ${first(b.by)}` : ''}</small>
          </span>
          <i className={`mt-1.5 h-2 w-2 flex-none rounded-full ${dots[i % dots.length]}`} />
        </div>
      ))}
      <DLink to="#/schedule" className="mt-3 inline-block text-[13px] font-semibold text-accent-text no-underline hover:underline">Open schedule</DLink>
    </Card>
  );
}

export function TasksCard() {
  const rows = svc.tasks({ mine: true }).sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).slice(0, 4);
  return (
    <Card title="My next tasks">
      {rows.length === 0 ? <Empty>Nothing assigned to you.</Empty> : rows.map((t) => (
        <div key={t.id} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0">
          <span className="min-w-0 flex-1">
            <b className="block truncate">{t.title}</b>
            <small className="text-ink-3">{t.due ? `Due ${fmtD(t.due)}` : 'No due date'}</small>
          </span>
          {t.critical && <Pill kind="crit">Critical</Pill>}
        </div>
      ))}
    </Card>
  );
}

const soft = { background: 'color-mix(in srgb, var(--accent-ink) 14%, transparent)' };

// Top banner for staff roles: today's date, a few live counts and the punch in/out control.
export function TodayBanner({ role, attention }) {
  const mine = svc.attendance().find((a) => a.userId === state.userId);
  const d = new Date(`${TODAY}T00:00`);
  const meetings = svc.bookings(TODAY).length;
  const tasks = svc.tasks({ mine: true }).length;
  const now = new Date().toTimeString().slice(0, 5);
  const status = !mine ? 'No attendance record today'
    : !mine.in ? 'Not checked in yet'
      : mine.out ? `Checked out at ${mine.out}`
        : `Checked in at ${mine.in}${mine.mark === 'late' ? ' · late' : ''}`;
  const stats = [[attention.n, attention.label], [meetings, meetings === 1 ? 'Meeting today' : 'Meetings today'], [tasks, tasks === 1 ? 'Task for you' : 'Tasks for you']];
  return (
    <section className="mb-5 flex flex-wrap items-stretch justify-between gap-6 rounded-r3 bg-accent px-7 py-6 text-accent-ink shadow-s1">
      <div className="flex min-w-0 flex-col justify-between gap-5">
        <div>
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.12em] opacity-75">{d.toLocaleDateString('en-IN', { weekday: 'long' })} · {role}</p>
          <h1 className="m-0 mt-1 text-hero font-semibold leading-tight tracking-tight">{d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</h1>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {stats.map(([n, l]) => (
            <div key={l} className="min-w-[116px] rounded-r2 px-3.5 py-2" style={soft}>
              <b className="block text-xl font-semibold leading-tight">{n}</b>
              <span className="text-xs opacity-80">{l}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex min-w-[220px] flex-col justify-between gap-4 rounded-r2 px-5 py-4" style={soft}>
        <div>
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.12em] opacity-75">Attendance</p>
          <div className="mt-1 text-[34px] font-semibold leading-none tracking-tight">{now}</div>
          <p className="m-0 mt-1.5 text-[13px] opacity-85">{status}</p>
        </div>
        {mine && !mine.in && (
          <Btn kind="primary" className="!border-accent-ink !bg-accent-ink !text-accent" onClick={() => { const r = svc.checkIn(); toast(r.late ? `Checked in at ${r.t}, marked late.` : `Checked in at ${r.t}.`); render(); }}>Check in</Btn>
        )}
        {mine && mine.in && !mine.out && (
          <Btn onClick={() => { toast(`Checked out at ${svc.checkOut()}.`); render(); }}>Check out</Btn>
        )}
        {mine && mine.out && (
          <Btn className="!border-accent-ink !bg-accent-ink !text-accent" onClick={() => { const r = svc.checkIn(); toast(`Checked in again at ${r.t}.`); render(); }}>Check in again</Btn>
        )}
      </div>
    </section>
  );
}
