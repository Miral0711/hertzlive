import { Link } from 'react-router-dom';
import { useStore } from '../shared/store';
import Icon from './Icon';
import { attentionItems, waitingItems, fmtD, fmtT, myThreads, me, firstName, projectName, onPhone, stamp, svc, state, can, user, render, staff, TODAY } from './model';
import { t } from './copy';
import { Avatar } from './faces';
import { hh } from '../shared/core';

export default function Today() {
  useStore();
  const actions = attentionItems();
  const waiting = waitingItems();
  const site = myThreads().find(({ t }) => t.kind === 'site');
  const person = me();
  const day = TODAY || stamp().slice(0, 10);
  const involved = (b) => b.clientId === state.userId || (b.attendees || []).includes(state.userId) || b.by === state.userId;
  const mineMeetings = (state.db.BOOKINGS || []).filter((b) => b.date >= day && b.status !== 'declined' && involved(b));
  const todayMeetings = (state.role === 'partner' ? svc.bookings(day) : mineMeetings.filter((b) => b.date === day))
    .filter((b) => b.status !== 'declined')
    .sort((a, b) => a.start - b.start);
  const laterMeetings = mineMeetings.filter((b) => b.date > day);
  const decisions = ['partner', 'designer', 'client'].includes(state.role)
    ? svc.decisionsDue().filter((d) => onPhone(d.projectId)).sort((a, b) => (b.late ? 1 : 0) - (a.late ? 1 : 0)).slice(0, 3)
    : [];
  const siteToday = ['partner', 'designer', 'site_manager', 'contractor'].includes(state.role)
    ? svc.sites().flatMap((s) => svc.feed(s.id).map((f) => ({ ...f, site: s })))
      .filter((f) => (f.at || '').startsWith(day))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 3)
    : [];
  const pendingBooks = can('booking', 'a') ? svc.pendingBookings() : [];
  const reminders = svc.followups();
  const quiet = !actions.length && !todayMeetings.length && !decisions.length && !siteToday.length;
  const line = [
    todayMeetings.length && `${todayMeetings.length} meeting${todayMeetings.length === 1 ? '' : 's'} today`,
    decisions.length && `${decisions.length} decision${decisions.length === 1 ? '' : 's'} waiting`,
    siteToday.length && `${siteToday.length} update${siteToday.length === 1 ? '' : 's'} from site`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="screen">
      <header className="top">
        <h1>{t('today')}<span>{person ? firstName(person.id) : ''}</span></h1>
        <Link className="icon-btn" to="/mobile/profile" aria-label="Profile">
          <Avatar person={person} size="sm" />
        </Link>
      </header>
      <div className="body canvas">
        <div className="day-head">
          <h2>{actions.length ? `${actions.length} thing${actions.length === 1 ? '' : 's'} need you` : quiet ? 'You’re up to date' : 'Your day'}</h2>
          <span>{fmtD(day)}</span>
        </div>
        {line ? <p className="note">{line}</p> : null}
        {!state.online && <p className="banner">Your message will send when the network is back.</p>}
        {site && (
          <Link className="primary" to={`/mobile/camera?thread=${site.t.id}`}>
            <Icon name="camera" /> {t('sendSitePhoto')}
          </Link>
        )}
        {actions.length ? (
          <>
            <p className="today-h">Needs you</p>
            {actions.map((item, i) => (
              <Link key={item.key} className={`task ${i === 0 ? 'next' : ''} ${item.hot ? 'hot' : ''}`} to={item.issueId ? `/mobile/issues/${item.issueId}` : `/mobile/projects/${item.projectId}`}>
                <small>{i === 0 ? 'Next · ' : ''}{item.kind}</small>
                <b>{item.title}</b>
                <span>{item.meta}</span>
              </Link>
            ))}
          </>
        ) : quiet ? (
          <div className="clear">
            <Icon name="check" />
            <h3>Nothing waiting on you</h3>
            <p>Open Projects for drawings and site notes.</p>
            <Link to="/mobile/projects">Open projects</Link>
          </div>
        ) : null}
        {todayMeetings.length > 0 && (
          <>
            <p className="today-h">Today’s meetings</p>
            {todayMeetings.map((b) => {
              const body = (
                <>
                  <small>{hh(b.start)}–{hh(b.end)}</small>
                  <b>{b.title}</b>
                  <span>{(state.db.ROOMS || []).find((r) => r.id === b.roomId)?.name || { client: 'Client meeting', review: 'Studio review', travel: 'Out of the office', focus: 'Focus time' }[b.kind] || 'Studio'}</span>
                </>
              );
              return b.projectId && onPhone(b.projectId)
                ? <Link key={b.id} className="task" to={`/mobile/projects/${b.projectId}`}>{body}</Link>
                : <article key={b.id} className="task">{body}</article>;
            })}
          </>
        )}
        {decisions.length > 0 && (
          <>
            <p className="today-h">{state.role === 'client' ? 'Waiting on you' : 'Decisions waiting'}</p>
            {decisions.map((d) => (
              <Link key={d.id} className={`task ${d.late ? 'hot' : ''}`} to={`/mobile/projects/${d.projectId}`}>
                <small>{d.late ? 'Late' : `Due ${fmtD(d.due)}`}</small>
                <b>{d.title}</b>
                <span>{projectName(d.projectId)} · {state.role === 'client' ? 'The studio needs your answer' : 'Waiting on the client'}</span>
              </Link>
            ))}
          </>
        )}
        {siteToday.length > 0 && (
          <>
            <p className="today-h">On site today</p>
            {siteToday.map((f) => {
              const thread = svc.threads().find((t) => t.kind === 'site' && t.siteId === f.site.id);
              const text = (f.text || f.aiSummary || 'Update').trim();
              const cut = text.indexOf('. ');
              const head = (cut > 0 && cut < 70 ? text.slice(0, cut) : text).slice(0, 70);
              return (
                <Link key={f.id} className="task" to={thread ? `/mobile/chats/${thread.id}` : `/mobile/projects/${f.site.projectId}`}>
                  <small>{fmtT(f.at)}</small>
                  <b>{firstName(f.by)} · {head}{head.length < text.length ? '…' : ''}</b>
                  <span>{f.site.name}</span>
                </Link>
              );
            })}
          </>
        )}
        <details className="waiting">
          <summary>{t('more')}</summary>
          {can('booking', 'w') && (
            <>
              {laterMeetings.length ? laterMeetings.map((b) => (
                <div className="wait-row" key={b.id}>
                  <b>{fmtD(b.date)} {hh(b.start)} · {b.title}</b>
                  <span>{b.status === 'pending' ? 'Waiting for the studio' : 'Confirmed'}</span>
                </div>
              )) : <p className="note">{state.role === 'client' ? 'No meeting booked. Pick a day and time, the studio confirms.' : 'Nothing booked by you this week.'}</p>}
              <Link className="ghost" to={state.role === 'client' ? '/mobile/book?kind=meet' : '/mobile/book?kind=room'}>
                {state.role === 'client' ? 'Book a meeting' : `Book ${(state.db.ROOMS?.[0]?.name || 'a room').toLowerCase()}`}
              </Link>
            </>
          )}
          {reminders.map((f) => (
            <article className="task" key={f.id}>
              <small>Reminder</small>
              <b>{f.msg?.text || 'Message'}</b>
              <div className="stack">
                {f.msg ? <Link className="ghost" to={`/mobile/chats/${f.msg.threadId}#${f.msg.id}`}>Open</Link> : null}
                <button type="button" className="ghost" onClick={() => { svc.doneFollowup(f.id); render(); }}>Done</button>
              </div>
            </article>
          ))}
          {svc.assistKinds().includes('ask') && <Link className="ghost" to="/mobile/assist?kind=ask">Ask</Link>}
          <Link className="ghost" to="/mobile/holidays">{staff() ? 'Leave' : 'Holidays'}</Link>
        </details>
        {pendingBooks.map((b) => (
          <article className="task hot" key={b.id}>
            <small>Client wants to meet</small>
            <b>{user(b.clientId || b.by).name} · {fmtD(b.date)} {hh(b.start)}</b>
            <span>{b.title}</span>
            <div className="stack">
              <button type="button" className="primary" onClick={() => { svc.decideBooking(b.id, true); render(); }}>Confirm</button>
              <button type="button" className="ghost" onClick={() => { svc.decideBooking(b.id, false); render(); }}>Decline</button>
            </div>
          </article>
        ))}
        {waiting.length > 0 && (
          <details className="waiting">
            <summary>Waiting on others <b>{waiting.length}</b></summary>
            {waiting.map((item) => (
              <div key={item.key} className="wait-row">
                <b>{item.title}</b>
                <span>{item.meta}</span>
              </div>
            ))}
          </details>
        )}
      </div>
    </div>
  );
}
