import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../shared/store';
import Icon from './Icon';
import { backName } from './frame';
import { Avatar, Face, FACE_COUNT, choosePortrait, faceIndex } from './faces';
import { me, staff, state, svc, can, render } from './model';
import { logout } from '../desktop/session';
import { setOnline } from '../shared/core';
import { startOver } from './People';

const ORIGIN = 'field-profile-from';

function Row({ to, onClick, title, detail, value }) {
  const body = (
    <>
      <div><b>{title}</b>{detail ? <span>{detail}</span> : null}</div>
      {value ? <span className="day-acts">{value}</span> : null}
    </>
  );
  if (to) return <Link className="day-row" to={to}>{body}</Link>;
  return <button type="button" className="day-row" onClick={onClick}>{body}</button>;
}

export default function Profile() {
  useStore();
  const person = me();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const from = params.get('from');
  const [picking, setPicking] = useState(false);
  const chosen = faceIndex(person);
  const lang = sessionStorage.getItem('field-lang') || 'English';
  const look = { system: 'Phone', light: 'Light', dark: 'Dark' }[state.theme] || 'Phone';
  const stored = sessionStorage.getItem(ORIGIN);
  const back = from && from.startsWith('/mobile/') ? from : (stored && stored.startsWith('/mobile/') ? stored : '/mobile/chats');

  useEffect(() => {
    if (from && from.startsWith('/mobile/')) sessionStorage.setItem(ORIGIN, from);
  }, [from]);

  const bookTo = `${state.role === 'client' ? '/mobile/book?kind=meet' : '/mobile/book?kind=room'}&from=${encodeURIComponent('/mobile/profile')}`;

  return (
    <div className="screen">
      <header className="top thread-top proj-top">
        <Link className="icon-btn" to={back} aria-label={`Back to ${backName(back)}`}>
          <Icon name="back" />
        </Link>
        <div className="thread-heading">
          <h1>Profile</h1>
        </div>
      </header>
      <div className="body canvas proj profile hub">
        <div className="who">
          <Avatar person={person} size="lg" />
          <div>
            <b>{person?.name}</b>
            <span>{person?.title}</span>
            {staff() && <span>{person?.streak || 0} working days on time · {(person?.pts || 0).toLocaleString('en-IN')} points from recorded actions</span>}
            <button type="button" className="photo-pick" onClick={() => setPicking((v) => !v)}>{picking ? 'Close photos' : 'Choose photo'}</button>
          </div>
        </div>
        {picking && (
          <div className="face-grid" role="listbox" aria-label="Dummy photos">
            {Array.from({ length: FACE_COUNT }, (_, n) => (
              <button type="button" key={n} className={n === chosen ? 'on' : ''} aria-label={`Photo ${n + 1}`} onClick={() => { choosePortrait(person.id, n); setPicking(false); }}>
                <span className="av"><Face n={n} /></span>
              </button>
            ))}
          </div>
        )}
        <section>
          <h2 className="sect">This phone</h2>
          {staff() && (
            <Row to="/mobile/punches" title="This month" detail={`${svc.punches().late} late · ${svc.punches().hours}h`} value={`${svc.punches().days} days`} />
          )}
          {staff() && can('performance', 'r') && (
            <Row to="/mobile/performance" title="My performance" detail="Score, goals and recognition for this quarter" />
          )}
          {staff() && (
            <Row
              title="Optional points list"
              detail="Hide my points from that list. Work and the performance score are still recorded."
              value={person?.ptsOptOut ? 'Hidden' : 'Visible'}
              onClick={() => { svc.setOptOut(!person?.ptsOptOut); render(); }}
            />
          )}
          <Row
            title="Pretend no signal"
            detail={state.online ? 'Messages send straight away' : 'Messages wait for a signal'}
            value={state.online ? 'Off' : 'On'}
            onClick={() => setOnline(!state.online)}
          />
          <Row to="/mobile/appearance" title="Appearance" detail={look === 'Phone' ? 'Follows this phone' : 'Chosen on this phone'} value={look} />
          <Row to="/mobile/language" title="Language" detail="Menus only" value={lang} />
        </section>

        <section>
          <h2 className="sect">Studio</h2>
          <Row to="/mobile/people" title="People and contractors" detail="Phone numbers, one tap to call" />
          <Row to="/mobile/holidays" title={staff() ? 'Holidays and my leave' : 'Holidays'} detail="Office closed days" />
          {can('booking', 'w') && <Row to={bookTo} title={state.role === 'client' ? 'Book a meeting' : 'Book a room'} detail="Pick a day and time" />}
          {state.role === 'partner' && <Row to="/mobile/notice" title="Notice to everyone" detail="One message, every project chat" />}
          {staff() && can('review', 'r') && <Row to="/mobile/reviews" title="My reviews" detail="Monthly score, strengths and growth" />}
        </section>

        <section>
          <h2 className="sect">This demo</h2>
          <Row to="/desktop/dashboard" title="Open desktop studio" detail="Planning, drawings and coordination" />
          <Row to="/mobile/who" title="Switch person" detail="Try the app as someone else" />
          <Row title="Start over" detail="Clear this demo’s changes" onClick={() => { startOver(); navigate('/mobile/chats'); }} />
          <Row title="Sign out" detail="Return to the phone sign-in" onClick={() => { logout(); navigate('/mobile/login', { replace: true }); }} />
        </section>
        <p className="note">Filing, transcripts and answers are simulated on this device. Updates stay in this browser.</p>
      </div>
    </div>
  );
}
