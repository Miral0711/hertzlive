import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../shared/store';
import Icon from './Icon';
import { Avatar, Face, FACE_COUNT, choosePortrait, faceIndex } from './faces';
import { me, staff, state, svc, can, render, persist } from './model';
import { logout } from '../desktop/session';
import { setOnline } from '../shared/core';
import { startOver } from './People';

export default function Profile() {
  useStore();
  const person = me();
  const navigate = useNavigate();
  const [picking, setPicking] = useState(false);
  const chosen = faceIndex(person);
  const quiet = state.gamify?.quiet || person?.quiet;
  const lang = sessionStorage.getItem('field-lang') || 'English';
  const look = { system: 'Phone', light: 'Light', dark: 'Dark' }[state.theme] || 'Phone';

  return (
    <div className="screen">
      <header className="top thread-top">
        <Link className="icon-btn" to="/mobile/chats" aria-label="Back">
          <Icon name="back" /><span>Back</span>
        </Link>
        <h1>Profile</h1>
      </header>
      <div className="body canvas">
        <div className="prof">
          <Avatar person={person} size="lg" />
          <div>
            <b>{person?.name}</b>
            <span>{person?.title}</span>
            <button type="button" className="text-btn" onClick={() => setPicking((v) => !v)}>Choose photo</button>
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
        {staff() && (
          <Link className="row" to="/mobile/punches">
            <span className="row-copy"><b>This month</b><span>{svc.punches().days} days · {svc.punches().late} late · {svc.punches().hours}h</span></span>
            <Icon name="chev" />
          </Link>
        )}
        <div className="setl">
          {staff() && (
            <button type="button" className="set" onClick={() => { state.gamify.quiet = !quiet; persist(); render(); }}>
              <span><b>Quiet mode</b><span>Hide streaks and points</span></span>
              <span className={`count ${quiet ? '' : 'off'}`}>{quiet ? 'On' : 'Off'}</span>
            </button>
          )}
          <button type="button" className="set" onClick={() => setOnline(!state.online)}>
            <span><b>Pretend no signal</b><span>See how sending works on site</span></span>
            <span className="count">{state.online ? 'Off' : 'On'}</span>
          </button>
          <Link className="set" to="/mobile/appearance"><span><b>Appearance</b><span>Light, dark or follow phone</span></span><span>{look}</span></Link>
          <Link className="set" to="/mobile/language"><span><b>Language</b><span>Menus only</span></span><span>{lang}</span></Link>
        </div>
        <div className="setl">
          <Link className="set" to="/mobile/people"><span><b>People and contractors</b><span>Phone numbers, one tap to call</span></span><Icon name="call" /></Link>
          <Link className="set" to="/mobile/holidays"><span><b>Holidays{staff() ? ' and my leave' : ''}</b><span>Office closed days</span></span><Icon name="cal" /></Link>
          {can('booking', 'w') && <Link className="set" to={state.role === 'client' ? '/mobile/book?kind=meet' : '/mobile/book?kind=room'}><span><b>{state.role === 'client' ? 'Book a meeting' : 'Book a room'}</b><span>Pick a day and time</span></span><Icon name="cal" /></Link>}
          {state.role === 'partner' && <Link className="set" to="/mobile/notice"><span><b>Notice to everyone</b><span>One message, every project chat</span></span><Icon name="bell" /></Link>}
          {staff() && can('review', 'r') && <Link className="set" to="/mobile/reviews"><span><b>My reviews</b><span>Monthly score, strengths and growth</span></span><Icon name="check" /></Link>}
        </div>
        <div className="setl">
          <Link className="set" to="/desktop/dashboard"><span><b>Open desktop studio</b><span>Planning, drawings and coordination</span></span><Icon name="desktop" /></Link>
          <Link className="set" to="/mobile/who"><span><b>Switch person</b><span>Try the app as someone else</span></span><span>Switch</span></Link>
          <button type="button" className="set" onClick={() => { startOver(); navigate('/mobile/chats'); }}>
            <span><b>Start over</b><span>Clear this demo’s changes</span></span><span>Reset</span>
          </button>
          <button type="button" className="set" onClick={() => { logout(); navigate('/mobile/login', { replace: true }); }}>
            <span><b>Sign out</b><span>Return to the phone sign-in</span></span><Icon name="logout" />
          </button>
        </div>
        <p className="note">Filing, transcripts and answers are simulated on this device. Updates stay in this browser.</p>
      </div>
    </div>
  );
}
