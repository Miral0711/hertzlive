import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../shared/store';
import Icon from './Icon';
import { Page, Note, backName } from './frame';
import {
  state, svc, user, me, staff, PEOPLE, viewAs, phoneOf, firstName, fmtD, TODAY, persist, render, myThreads, postMessage, can,
} from './model';
import { resetDb, hh } from '../shared/core';
import { Avatar } from './faces';

const ORDER = ['partner', 'site_manager', 'designer', 'hr', 'contractor', 'client'];
const LABEL = {
  partner: 'Partners', site_manager: 'Site managers', designer: 'Design team',
  hr: 'Office', contractor: 'Contractors and vendors', client: 'Clients',
};

export function Who() {
  useStore();
  const navigate = useNavigate();
  return (
    <Page board sheet back="/mobile/profile" backLabel="Profile" title="Switch person" sub="Try the field app as someone else">
      <Note>This changes whose records you see. It does not change the desktop login.</Note>
      {PEOPLE.map(({ id, hint }) => {
        const u = user(id);
        return (
          <button
            type="button"
            key={id}
            className="row"
            onClick={() => { viewAs(id); navigate('/mobile/chats'); }}
          >
            <Avatar person={u} />
            <span className="row-copy"><b>{u.name}</b><span>{u.title} · {hint}</span></span>
            {state.userId === id ? <span className="chip-status">You</span> : null}
          </button>
        );
      })}
    </Page>
  );
}

export function People() {
  useStore();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const employee = staff();
  const list = state.db.USERS.filter((u) => {
    if (u.id === state.userId) return false;
    if (!(`${u.name} ${u.title}`).toLowerCase().includes(query)) return false;
    if (employee) return true;
    return ['partner', 'site_manager'].includes(u.role) || svc.projects().some((p) => (p.teamIds || []).includes(u.id));
  });
  const groups = ORDER.map((role) => [LABEL[role], list.filter((u) => u.role === role)]).filter(([, us]) => us.length);
  return (
    <Page board sheet back="/mobile/profile" backLabel="Profile" title="People" sub="Tap the phone to call" bare>
      <label className="search">
        <Icon name="search" />
        <input type="search" value={q} placeholder="Search people" aria-label="Search people" onChange={(e) => setQ(e.target.value)} />
      </label>
      {groups.map(([name, us]) => (
        <section key={name}>
          <h2 className="sect">{name}</h2>
          {us.map((u) => {
            const vendor = state.db.VENDORS.find((v) => v.userId === u.id);
            const dm = state.db.THREADS.find((t) => t.kind === 'dm' && t.memberIds.includes(u.id) && t.memberIds.includes(state.userId));
            const phone = phoneOf(u);
            return (
              <div className="row" key={u.id}>
                <Avatar person={u} />
                <span className="row-copy"><b>{u.name}</b><span>{vendor ? vendor.trade || vendor.name : u.title} · {phone}</span></span>
                {dm ? <Link className="icon-btn" to={`/mobile/chats/${dm.id}`} aria-label={`Chat with ${firstName(u.id)}`}><Icon name="chat" /></Link> : null}
                <a className="icon-btn" href={`tel:${phone.replace(/\s/g, '')}`} aria-label={`Call ${firstName(u.id)}`}><Icon name="call" /></a>
              </div>
            );
          })}
        </section>
      ))}
      {!groups.length && <div className="empty"><h3>No one matches</h3></div>}
    </Page>
  );
}

function DayRow({ date, title, detail, extra }) {
  const d = new Date(`${date}T00:00:00`);
  return (
    <div className="row">
      <span className="dcell"><b>{d.getDate()}</b><span>{d.toLocaleDateString('en-IN', { month: 'short' })}</span></span>
      <span className="row-copy"><b>{title}</b><span>{detail}</span></span>
      {extra}
    </div>
  );
}

export function Holidays() {
  useStore();
  const hol = (state.db.HOLIDAYS || []).filter((h) => h.date >= TODAY);
  const mine = staff() ? (state.db.LEAVES || []).filter((l) => l.userId === state.userId && l.to >= TODAY) : [];
  const pending = can('leave', 'a') ? (state.db.LEAVES || []).filter((l) => l.status === 'pending') : [];
  const team = staff() ? (state.db.LEAVES || []).filter((l) => l.userId !== state.userId && l.status === 'approved' && l.to >= TODAY).slice(0, 5) : [];
  return (
    <Page board sheet back="/mobile/profile" backLabel="Profile" title={staff() ? 'Holidays and leave' : 'Holidays'} sub="Office calendar" bare>
      {pending.length > 0 && (
        <section>
          <h2 className="sect">Leave requests</h2>
          {pending.map((l) => (
            <div className="day-row" key={l.id}>
              <div>
                <b>{user(l.userId).name} · {l.days} day{l.days > 1 ? 's' : ''}</b>
                <span>{l.type} · {fmtD(l.from)} to {fmtD(l.to)} · {l.reason}</span>
                <div className="mat-acts">
                  <button type="button" onClick={() => { svc.decideLeave(l.id, true); render(); }}>Approve</button>
                  <button type="button" onClick={() => { svc.decideLeave(l.id, false); render(); }}>Decline</button>
                  <Link to={`/mobile/standin/${l.userId}?leave=${l.id}`}>Who covers?</Link>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
      {staff() && (
        <section>
          <h2 className="sect">My leave</h2>
          {mine.length ? mine.map((l) => (
            <DayRow key={l.id} date={l.from} title={`${l.type} · ${l.days} day${l.days > 1 ? 's' : ''}`} detail={l.from === l.to ? fmtD(l.from) : `${fmtD(l.from)} to ${fmtD(l.to)} · ${l.reason}`} extra={<span className="row-end"><span className={`chip-status${l.status === 'pending' ? ' open' : l.status === 'approved' ? ' ok' : ''}`}>{l.status}</span><Link to={`/mobile/standin/${l.userId}?leave=${l.id}`}>Who covers?</Link></span>} />
          )) : <div className="empty"><h3>Nothing planned</h3><p>Ask for leave in the studio chat.</p></div>}
        </section>
      )}
      <section>
        <h2 className="sect">Holidays</h2>
        {hol.map((h) => (
          <DayRow key={h.date + h.name} date={h.date} title={h.name} detail={`${new Date(`${h.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long' })} · ${h.site ? 'site closed, no labour' : 'office only, site works'}`} />
        ))}
      </section>
      {team.length > 0 && (
        <section>
          <h2 className="sect">Who is away</h2>
          {team.map((l) => (
            <DayRow key={l.id} date={l.from} title={firstName(l.userId)} detail={`${l.from === l.to ? fmtD(l.from) : `${fmtD(l.from)} to ${fmtD(l.to)}`} · ${l.type}`} />
          ))}
        </section>
      )}
    </Page>
  );
}

export function Punches() {
  useStore();
  const month = svc.punches();
  return (
    <Page board sheet back="/mobile/profile" backLabel="Profile" title="Punch history" sub={`${month.days} day${month.days === 1 ? '' : 's'} · ${month.late} late · ${month.hours}h`}>
      {month.rows.length > 0 && (
        <section>
          {month.rows.map((r) => (
            <div className="row" key={r.date + r.in}>
              <span className="row-copy">
                <b className={r.late ? 'late' : ''}>{fmtD(r.date)}{r.late ? ' · late' : ''}</b>
                <span>{r.in}–{r.out || '—'} · {r.site}</span>
              </span>
            </div>
          ))}
        </section>
      )}
      {!month.rows.length && <div className="empty"><h3>No punches this month</h3></div>}
    </Page>
  );
}

export function MyPerformance() {
  useStore();
  const period = svc.performancePeriod();
  const metrics = can('performance', 'r') ? svc.personMetrics(state.userId, period.id) : null;
  const history = metrics ? svc.pointsHistory(state.userId, period.id) : [];
  return (
    <Page board sheet back="/mobile/profile" backLabel="Profile" title="My performance" sub={period.label}>
      {!metrics && <div className="empty"><h3>Performance isn’t available for this login</h3></div>}
      {metrics && (
        <>
          <div className="day-row"><div><small>{period.label}</small><b>{metrics.performance?.score == null ? 'Not enough evidence' : metrics.performance.partial ? `${metrics.performance.score} · partial` : metrics.performance.score}</b><span>{metrics.performance?.coverage}{metrics.performance?.partial && metrics.performance?.score != null ? ' This is a partial score, not a complete evaluation.' : ''}</span></div></div>
          <details className="day-row">
            <summary>How calculated?</summary>
            <p>{metrics.performance?.formula}</p>
          </details>
          {(metrics.performance?.dimensions || []).map((d) => (
            <div className="day-row" key={d.id}><div><small>{d.label} · weight {d.weight}</small><b>{d.score == null ? 'Not enough evidence' : d.score}</b><span>{d.formula}</span></div></div>
          ))}
          <h2 className="sect">Goals</h2>
          {metrics.goals.filter((g) => g.scope === 'individual').map((g) => (
            <div className="day-row" key={g.id}><div><small>{g.current == null ? 'Not enough evidence' : `${g.current}% of ${g.target}%`}</small><b>{g.name}</b><span>{g.formula}</span></div></div>
          ))}
          {!metrics.goals.some((g) => g.scope === 'individual') && <div className="empty"><h3>No goals this period</h3></div>}
          <h2 className="sect">Recognition</h2>
          {metrics.recognitions.map((r) => (
            <div className="day-row" key={r.id}><div><small>{fmtD(r.at)}</small><b>{r.message}</b></div></div>
          ))}
          {!metrics.recognitions.length && <div className="empty"><h3>None this period</h3></div>}
          <h2 className="sect">Achievements</h2>
          {metrics.achievements.map((a) => (
            <div className="day-row" key={a.id}><div><small>{fmtD(a.earnedAt)} · {a.badge.desc}</small><b>{a.badge.name}</b><span>{a.reason}</span></div></div>
          ))}
          {!metrics.achievements.length && <div className="empty"><h3>None yet</h3><p>A badge records a rule that was met. It is not a rating or a bonus.</p></div>}
          <h2 className="sect">Points history</h2>
          {history.map((e) => (
            <div className="day-row" key={e.id}><div><small>{fmtD(e.createdAt || e.at)} · {e.reason}</small><b>+{e.points}</b></div></div>
          ))}
          {!history.length && <div className="empty"><h3>No points this period</h3></div>}
        </>
      )}
    </Page>
  );
}

export function Reviews() {
  useStore();
  const rows = svc.reviews(state.userId);
  return (
    <Page board sheet back="/mobile/profile" backLabel="Profile" title="My reviews" sub="Monthly score, strengths and growth">
      <section>
      {rows.map((r) => (
        <article key={r.id} className="day-row">
          <div>
            <small>{r.month} · {r.score}/5 · {user(r.by).name}</small>
            <b>{r.reason}</b>
            <span>Strengths: {r.strengths.join(', ')}</span>
            <span>Grow: {r.growth}</span>
          </div>
        </article>
      ))}
      {!rows.length && <div className="empty"><h3>No review for you yet</h3></div>}
      </section>
    </Page>
  );
}

export function Notice() {
  useStore();
  const navigate = useNavigate();
  const ideas = ['Office closed tomorrow', 'Site visit Saturday, all hands', 'Salary credited today'];
  const [text, setText] = useState('');
  const threads = myThreads().filter(({ t }) => t.kind !== 'dm');
  if (state.role !== 'partner') {
    return <Page board sheet back="/mobile/profile" backLabel="Profile" title="Notice"><div className="empty"><h3>Only a partner can send a notice</h3></div></Page>;
  }
  function send(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    threads.forEach(({ t }) => postMessage(t.id, { text: value, notice: true }));
    navigate('/mobile/chats');
  }
  return (
    <Page board sheet back="/mobile/profile" backLabel="Profile" title="Notice to everyone" sub={`${threads.length} project chats`}>
      <Note>Goes to every project chat you are in, marked as a notice.</Note>
      <div className="filters">
        {ideas.map((idea) => <button type="button" key={idea} onClick={() => setText(idea)}>{idea}</button>)}
      </div>
      <form className="stack" onSubmit={send}>
        <label>Message<textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} aria-label="Notice" /></label>
        <button className="primary" type="submit">Send to {threads.length} chats</button>
      </form>
    </Page>
  );
}

export function Appearance() {
  useStore();
  const options = [['system', 'Phone'], ['light', 'Light'], ['dark', 'Dark']];
  return (
    <Page board sheet back="/mobile/profile" backLabel="Profile" title="Appearance">
      <section>
        {options.map(([id, label]) => (
          <button type="button" key={id} className="day-row" aria-pressed={state.theme === id} onClick={() => { state.theme = id; persist(); render(); }}>
            <div><b>{label}</b>{state.theme === id ? <span>Using this</span> : null}</div>
          </button>
        ))}
      </section>
    </Page>
  );
}

export function Language() {
  useStore();
  const current = sessionStorage.getItem('field-lang') || 'English';
  const langs = ['English', 'हिन्दी', 'ગુજરાતી'];
  const [, setTick] = useState(current);
  return (
    <Page board sheet back="/mobile/profile" backLabel="Profile" title="Language">
      <Note>Menus and tabs only. Write or talk in any language.</Note>
      <section>
        {langs.map((lang) => (
          <button type="button" key={lang} className="day-row" aria-pressed={current === lang} onClick={() => { sessionStorage.setItem('field-lang', lang); setTick(lang); render(); }}>
            <div><b>{lang}</b>{current === lang ? <span>Using this</span> : null}</div>
          </button>
        ))}
      </section>
    </Page>
  );
}

function upcomingDays() {
  const days = [];
  const start = new Date(`${TODAY}T00:00:00`);
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (d.getDay() === 0) continue;
    const p = (n) => String(n).padStart(2, '0');
    days.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
  }
  return days;
}

export function Book() {
  useStore();
  const [params] = useSearchParams();
  const from = params.get('from');
  const meet = params.get('kind') === 'meet' || state.role === 'client';
  const hours = svc.cfg().hours || { start: 9, end: 18 };
  const days = upcomingDays();
  const times = [];
  for (let h = hours.start; h < hours.end; h += 1) times.push(h);
  const people = meet
    ? state.db.USERS.filter((u) => u.role === 'partner')
    : svc.people().filter((u) => u.id !== state.userId);
  const sites = svc.projects();
  const [date, setDate] = useState(days[1] || days[0]);
  const [hour, setHour] = useState(11);
  const [half, setHalf] = useState(0);
  const [len, setLen] = useState(1);
  const [purpose, setPurpose] = useState('office');
  const [who, setWho] = useState(people[0]?.id || '');
  const [projectId, setProjectId] = useState(sites[0]?.id || '');
  const [title, setTitle] = useState(meet ? `${sites[0]?.name || 'Project'} · client meeting` : '');
  const [clash, setClash] = useState(null);
  const [slots, setSlots] = useState([]);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const room = state.db.ROOMS?.[0]?.name || 'room';

  function save(e) {
    e.preventDefault();
    setError('');
    setDone('');
    const start = hour + half;
    const row = {
      title: title.trim() || (meet ? 'Client meeting' : 'Room booking'),
      purpose,
      date,
      start,
      end: start + Number(len),
      attendees: [state.userId, who].filter(Boolean),
      clientId: meet ? state.userId : undefined,
      projectId: purpose === 'site' ? projectId : undefined,
    };
    try {
      const result = svc.book(row);
      if (result.conflict) {
        setClash(result.conflict);
        setSlots(svc.freeSlots(svc.prepBooking(row)));
        return;
      }
      setClash(null);
      setSlots([]);
      render();
      setDone(result.pending
        ? `Asked for ${fmtD(date)} ${hh(start)}. The studio will confirm.`
        : `Booked ${fmtD(date)} ${hh(start)}.`);
    } catch (err) {
      setError(err.message === 'forbidden' ? 'You cannot book from this login.' : err.message);
    }
  }

  if (!can('booking', 'w')) {
    return <Page board back="/mobile/today" backLabel="Today" title="Booking"><div className="empty"><h3>Booking isn’t available for this login</h3></div></Page>;
  }

  return (
    <Page board sheet back={from && from.startsWith('/mobile/') ? from : '/mobile/today'} backLabel={from && from.startsWith('/mobile/') ? backName(from) : 'Today'} title={meet ? 'Book a meeting' : `Book the ${room.toLowerCase()}`}>
      {meet && <Note>The studio confirms. You get a WhatsApp the day before and one hour before.</Note>}
      <form className="stack" onSubmit={save}>
        <span className="lab">Day</span>
        <div className="filters">
          {days.map((d) => <button type="button" key={d} className={date === d ? 'on' : ''} onClick={() => setDate(d)}>{d === TODAY ? 'Today' : fmtD(d)}</button>)}
        </div>
        <span className="lab">Time</span>
        <div className="filters">
          {times.map((h) => <button type="button" key={h} className={hour === h ? 'on' : ''} onClick={() => setHour(h)}>{hh(h)}</button>)}
        </div>
        <div className="filters">
          <button type="button" className={half === 0 ? 'on' : ''} onClick={() => setHalf(0)}>On the hour</button>
          <button type="button" className={half === 0.5 ? 'on' : ''} onClick={() => setHalf(0.5)}>Half past</button>
        </div>
        <span className="lab">How long</span>
        <div className="filters">
          {[[0.5, '30 min'], [1, '1 hour'], [2, '2 hours']].map(([value, label]) => (
            <button type="button" key={label} className={Number(len) === value ? 'on' : ''} onClick={() => setLen(value)}>{label}</button>
          ))}
        </div>
        <span className="lab">{meet ? 'What kind' : 'Purpose'}</span>
        <div className="filters">
          {[['office', meet ? 'Come to the office' : 'Office meeting'], ['video', 'Video call'], ['site', 'Site visit']].map(([value, label]) => (
            <button type="button" key={value} className={purpose === value ? 'on' : ''} onClick={() => setPurpose(value)}>{label}</button>
          ))}
        </div>
        {purpose === 'site' && sites.length > 1 && (
          <label>Which site
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Which site">
              {sites.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
        <label>With
          <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="With">
            {people.map((u) => <option key={u.id} value={u.id}>{firstName(u.id)}</option>)}
          </select>
        </label>
        {!meet && (
          <label>What for
            <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="What for" placeholder="Jagwani kitchen review" />
          </label>
        )}
        {clash && (
          <div className="view-card">
            <b>Not free</b>
            <p>{clash.msg}</p>
            {slots.length ? (
              <div className="filters">
                {slots.slice(0, 6).map((slot) => (
                  <button type="button" key={`${slot.date}-${slot.start}`} onClick={() => { setDate(slot.date); setHour(Math.floor(slot.start)); setHalf(slot.start % 1); setLen(slot.end - slot.start); setClash(null); }}>
                    {fmtD(slot.date)} {hh(slot.start)}
                  </button>
                ))}
              </div>
            ) : <p>Nothing free in two weeks. Message the studio.</p>}
          </div>
        )}
        {error ? <p className="warn-text">{error}</p> : null}
        {done ? <p className="note">{done}</p> : <button className="primary" type="submit">{meet ? 'Ask for this time' : 'Book'}</button>}
      </form>
    </Page>
  );
}

export function StandIn() {
  useStore();
  const { userId } = useParams();
  const [params] = useSearchParams();
  const leaveId = params.get('leave') || '';
  let list = [];
  try { list = svc.standIns(userId); } catch { list = []; }
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  return (
    <Page board back="/mobile/holidays" backLabel="Holidays" title={`Who can cover ${firstName(userId)}?`} sub="Present today, shares a skill, lightest load first">
      {list.length ? list.map((row) => (
        <article className="view-card" key={row.u.id}>
          <b>{row.u.name}</b>
          <span>{row.u.title} · {row.load} open task{row.load === 1 ? '' : 's'} · {row.overlap.join(', ')}</span>
          {leaveId && can('leave', 'a') && (
            <button type="button" className="primary" onClick={() => {
              try {
                svc.reassignForLeave(leaveId, row.u.id, '');
                render();
                setNote(`Tasks reassigned to ${firstName(row.u.id)}.`);
                setError('');
              } catch (err) { setError(err.message === 'forbidden' ? 'You cannot reassign this leave.' : err.message); }
            }}>Reassign to {firstName(row.u.id)}</button>
          )}
        </article>
      )) : <div className="empty"><h3>No one qualified is in today</h3></div>}
      {note ? <p className="note">{note}</p> : null}
      {error ? <p className="warn-text">{error}</p> : null}
      {!can('leave', 'a') && <Note>A partner or HR names the cover and moves the open tasks.</Note>}
    </Page>
  );
}

export function startOver() {
  resetDb();
  render();
}

export { me };
