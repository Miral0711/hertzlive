// Right side of the navbar: notifications, settings and the profile menu (with "Switch to" roles).
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { state, svc, me, fmtDT, persist, render } from '../shared/core.js';
import Icon from '../ui/Icon';
import { Divider, DropdownItem } from '../ui/ui';
import { DLink, href } from './nav';
import { PERSONAS } from './data';
import { cycleTheme, logout, resetSampleData, switchPersona } from './session';

const themeLabel = { system: 'System', light: 'Light', dark: 'Dark' };
const btn = 'relative grid h-9 w-9 flex-none cursor-pointer list-none place-items-center rounded-r1 border border-line-2 bg-surface text-ink-2 hover:border-accent hover:text-accent-text [&::-webkit-details-marker]:hidden';

// A navbar popover: icon trigger plus a panel. Closes on outside click and Escape.
function Pop({ label, trigger, children, width = 'w-80', className = '', onOpen, badge = 0 }) {
  const ref = useRef(null);
  useEffect(() => {
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) ref.current.open = false; };
    const esc = (e) => { if (e.key === 'Escape' && ref.current) ref.current.open = false; };
    document.addEventListener('click', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('click', away); document.removeEventListener('keydown', esc); };
  }, []);
  return (
    <details ref={ref} className={`relative ${className}`} onToggle={(e) => e.currentTarget.open && onOpen?.()}>
      <summary aria-label={label} title={label} className={btn}>
        {trigger}
        {badge > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-crit px-1 text-[10px] font-bold leading-none text-white">{badge > 9 ? '9+' : badge}</span>}
      </summary>
      <div className={`absolute right-0 top-full z-40 mt-1.5 max-w-[calc(100vw-1rem)] rounded-r3 border border-line bg-surface p-2 shadow-s2 ${width}`}>{children}</div>
    </details>
  );
}

function Notifications() {
  const navigate = useNavigate();
  const notes = svc.notifications();
  const read = state.desk.notesRead || (state.desk.notesRead = {});
  const key = (n, i) => n.id || `n${i}`;
  const unread = notes.filter((n, i) => !read[key(n, i)]).length;
  // Only the notification you open is marked read, so the badge counts down one at a time.
  const open = (n, i, e) => {
    read[key(n, i)] = true;
    persist();
    e.currentTarget.closest('details').open = false;
    navigate(href(n.ref || '#/today'));
    render();
  };
  const markAll = () => { notes.forEach((n, i) => { read[key(n, i)] = true; }); persist(); render(); };
  return (
    <Pop label="Notifications" trigger={<Icon name="bell" small />} badge={unread}>
      <div className="flex items-center justify-between gap-2 px-2.5 pb-1.5 pt-1">
        <b>Notifications</b>
        {unread > 0
          ? <button type="button" onClick={markAll} className="border-0 bg-transparent p-0 text-xs font-semibold text-accent-text hover:underline">Mark all as read</button>
          : <span className="text-xs text-ink-3">All read</span>}
      </div>
      <div className="max-h-[min(60vh,380px)] overflow-auto">
        {notes.length === 0 && <p className="m-0 px-2.5 py-6 text-center text-ink-3">Nothing new.</p>}
        {notes.map((n, i) => {
          const isNew = !read[key(n, i)];
          return (
            <button
              key={key(n, i)}
              type="button"
              onClick={(e) => open(n, i, e)}
              className="flex w-full items-start gap-2.5 rounded-r1 border-0 bg-transparent px-2.5 py-2 text-left hover:bg-surface-2"
            >
              <i className={`mt-1.5 h-2 w-2 flex-none rounded-full ${isNew ? 'bg-accent' : 'bg-surface-3'}`} />
              <span className="min-w-0"><span className={`block text-[13px] ${isNew ? 'font-semibold text-ink' : 'text-ink-2'}`}>{n.text}</span><small className="text-ink-3">{fmtDT(n.at)}</small></span>
            </button>
          );
        })}
      </div>
    </Pop>
  );
}

function Profile() {
  const navigate = useNavigate();
  const u = me();
  const close = (e) => { e.currentTarget.closest('details').open = false; };
  return (
    <Pop label="Account" width="w-72" trigger={<span className="text-xs font-semibold">{u.ini || u.name.slice(0, 1)}</span>}>
      <div className="flex items-center gap-3 px-2.5 pb-2 pt-1.5">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-accent text-sm font-semibold text-accent-ink">{u.ini || u.name.slice(0, 1)}</span>
        <span className="min-w-0"><b className="block truncate">{u.name}</b><small className="block truncate text-ink-3">{u.title || u.role}</small></span>
      </div>
      <Divider className="my-1" />
      <p className="m-0 px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-accent-text">Switch to</p>
      {PERSONAS.map(([id, l]) => (
        <button
          key={id}
          type="button"
          onClick={(e) => { close(e); switchPersona(id); }}
          className={`flex min-h-9 w-full items-center justify-between gap-2 rounded-r1 border-0 px-2.5 text-left text-[13px] hover:bg-surface-2 ${state.userId === id ? 'bg-accent-soft font-semibold text-accent-text' : 'bg-transparent text-ink'}`}
        >
          <span className="truncate">{l}</span>
          {state.userId === id && <Icon name="check" small />}
        </button>
      ))}
      <Divider className="my-1" />
      <DropdownItem icon="settings" onClick={(e) => { close(e); navigate(href('#/settings?tab=prefs')); }}>Account settings</DropdownItem>
      <DropdownItem icon="moon" onClick={cycleTheme}>Theme: {themeLabel[state.theme]}</DropdownItem>
      <DropdownItem icon="reset" onClick={(e) => { close(e); resetSampleData(); }}>Reset sample data</DropdownItem>
      <DropdownItem icon="logout" onClick={(e) => { close(e); logout(); navigate('/login', { replace: true }); }}>Log out</DropdownItem>
      <small className="block px-2.5 pb-1 pt-1.5 text-ink-3">Interactive preview · sample records</small>
    </Pop>
  );
}

export default function NavActions() {
  return (
    <div className="flex flex-none items-center gap-1.5 sm:gap-2">
      <Notifications />
      <DLink to="#/settings" aria-label="Settings" title="Settings" className={`${btn} no-underline max-md:hidden`}><Icon name="settings" small /></DLink>
      <Profile />
    </div>
  );
}
