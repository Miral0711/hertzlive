import { Link } from 'react-router-dom';
import { useStore } from '../shared/store';
import Icon from './Icon';
import { attentionItems, waitingItems, fmtD, myThreads, me, firstName, stamp, svc, state, can, user, render, staff } from './model';
import { t } from './copy';
import { Avatar } from './faces';
import { hh } from '../shared/core';

export default function Today() {
  useStore();
  const actions = attentionItems();
  const waiting = waitingItems();
  const site = myThreads().find(({ t }) => t.kind === 'site');
  const person = me();
  const meetings = (state.db.BOOKINGS || []).filter((b) => b.date >= stamp().slice(0, 10) && b.status !== 'declined' && (b.clientId === state.userId || (b.attendees || []).includes(state.userId) || b.by === state.userId));
  const pendingBooks = can('booking', 'a') ? svc.pendingBookings() : [];
  const reminders = svc.followups();

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
          <h2>{actions.length ? `${actions.length} thing${actions.length === 1 ? '' : 's'} need you` : 'You’re up to date'}</h2>
          <span>{fmtD(stamp().slice(0, 10))}</span>
        </div>
        {!state.online && <p className="banner">Your message will send when the network is back.</p>}
        {site && (
          <Link className="primary" to={`/mobile/camera?thread=${site.t.id}`}>
            <Icon name="camera" /> {t('sendSitePhoto')}
          </Link>
        )}
        {actions.length ? actions.map((item, i) => (
          <Link key={item.key} className={`task ${i === 0 ? 'next' : ''} ${item.hot ? 'hot' : ''}`} to={item.issueId ? `/mobile/issues/${item.issueId}` : `/mobile/projects/${item.projectId}`}>
            <small>{i === 0 ? 'Next · ' : ''}{item.kind}</small>
            <b>{item.title}</b>
            <span>{item.meta}</span>
          </Link>
        )) : (
          <div className="clear">
            <Icon name="check" />
            <h3>Nothing waiting on you</h3>
            <p>Open Projects for drawings and site notes.</p>
            <Link to="/mobile/projects">Open projects</Link>
          </div>
        )}
        <details className="waiting">
          <summary>{t('more')}</summary>
          {can('booking', 'w') && (
            <>
              {meetings.length ? meetings.map((b) => (
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
