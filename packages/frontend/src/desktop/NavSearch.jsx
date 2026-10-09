// Navbar search: live results in a dropdown, grouped by kind. Arrow keys and Enter to pick, Esc to close,
// Ctrl/Cmd + K to focus. Results come from svc.search (projects, people, chat messages, voice notes, photos).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { svc } from '../shared/core.js';
import Icon from '../ui/Icon';
import { href } from './nav';
import { navFor } from './helpers';

const KIND = { page: 'Pages', project: 'Projects', person: 'People', message: 'Messages', voice: 'Voice notes', photo: 'Photos' };
const ORDER = ['page', 'project', 'person', 'message', 'voice', 'photo'];
// Modules and their sections, searchable by name. Only pages the signed-in role can open are listed.
const SECTIONS = [
  ['money', 'Partner dashboard', '#/money?tab=dashboard', 'fees receivable margin ageing cash'],
  ['money', 'Invoices', '#/money?tab=invoices', 'gst raise nudge tally'],
  ['money', 'Change orders', '#/money?tab=changes', ''],
  ['money', 'Proposals and fees', '#/money?tab=proposals', 'estimate sign'],
  ['money', 'Expenses', '#/money?tab=expenses', ''],
  ['people', 'Directory', '#/people?tab=directory', 'team contacts'],
  ['people', 'Leaves', '#/people?tab=leaves', 'leave away holiday'],
  ['people', 'Attendance', '#/people?tab=attendance', 'punch check in'],
  ['people', 'Load', '#/people?tab=load', 'workload'],
  ['people', 'Timesheets', '#/people?tab=timesheets', 'hours'],
  ['people', 'Salary', '#/people?tab=salary', 'pay tally'],
  ['people', 'Expense claims', '#/people?tab=expenses', ''],
  ['people', 'Performance', '#/people?tab=performance', 'points badges goals recognition'],
  ['people', 'Incentives', '#/people?tab=incentives', 'bonus year end'],
  ['people', 'Reviews', '#/people?tab=reviews', 'score'],
  ['people', 'Contacts', '#/people?tab=contacts', 'phone'],
  ['people', 'Folders', '#/people?tab=folders', 'nas'],
  ['people', 'Audit trail', '#/people?tab=audit', 'changes log'],
  ['schedule', 'Calendar', '#/schedule?tab=rooms', 'book room meeting'],
  ['schedule', 'Approvals', '#/schedule?tab=approvals', 'confirm decline'],
  ['schedule', 'Approval records', '#/schedule?tab=records', ''],
  ['schedule', 'Who is where', '#/schedule?tab=people', 'attendance'],
  ['schedule', 'Resource plan', '#/schedule?tab=resource', 'load'],
  ['schedule', 'Holidays', '#/schedule?tab=holidays', ''],
  ['schedule', 'Reminders', '#/schedule?tab=reminders', ''],
  ['enquiries', 'Web form preview', '#/enquiries?tab=web', 'public form'],
  ['settings', 'Agency settings', '#/settings?tab=agency', 'name accent colour background hours'],
  ['settings', 'People and roles', '#/settings?tab=people', ''],
  ['settings', 'Service types and routing', '#/settings?tab=services', ''],
  ['settings', 'Rooms', '#/settings?tab=resources', ''],
  ['settings', 'Booking', '#/settings?tab=booking', ''],
  ['settings', 'Holidays and trades', '#/settings?tab=holidays', ''],
  ['settings', 'GST and invoices', '#/settings?tab=gst', 'tax'],
  ['settings', 'Approvals checklist', '#/settings?tab=approvals', ''],
  ['settings', 'Connections', '#/settings?tab=connections', 'google whatsapp canva autocad nas'],
  ['settings', 'Portfolio', '#/settings?tab=portfolio', 'public projects'],
  ['settings', 'Preferences', '#/settings?tab=prefs', 'theme motion quiet reset'],
];
function pageResults(q) {
  const n = q.trim().toLowerCase();
  if (!n) return [];
  const allowed = navFor();
  const label = (k) => allowed.find(([id]) => id === k)?.[1];
  const mods = allowed.filter(([, l]) => l.toLowerCase().includes(n)).map(([k, l]) => ({ kind: 'page', id: `m-${k}`, title: l, sub: 'Page', ref: `#/${k}` }));
  if (n.length >= 2 && ['toolkit', 'calculator', 'architect'].some((k) => k.startsWith(n))) {
    mods.unshift({ kind: 'page', id: 'm-toolkit', title: "Architect's Calculator", sub: 'Toolkit', ref: '#/toolkit' });
  }
  const subs = SECTIONS.filter(([k, t, , kw]) => label(k) && `${t} ${kw}`.toLowerCase().includes(n))
    .map(([k, t, ref]) => ({ kind: 'page', id: ref, title: t, sub: `${label(k)} section`, ref }));
  return [...mods, ...subs].filter((r, i, a) => a.findIndex((x) => x.ref === r.ref) === i).slice(0, 8);
}
const target = (r) => (r.threadId ? `#/chats?thread=${r.threadId}` : r.ref);

function Mark({ text, q }) {
  const t = String(text || '');
  const n = q.trim();
  const i = n ? t.toLowerCase().indexOf(n.toLowerCase()) : -1;
  if (i < 0) return t;
  return <>{t.slice(0, i)}<mark className="rounded-[2px] bg-accent-soft p-0 text-accent-text">{t.slice(i, i + n.length)}</mark>{t.slice(i + n.length)}</>;
}

export default function NavSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef(null);
  const input = useRef(null);

  const rows = useMemo(() => {
    const r = q.trim() ? [...pageResults(q), ...svc.search(q)] : [];
    return ORDER.flatMap((k) => r.filter((x) => x.kind === k));
  }, [q]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setMobileOpen(true); setOpen(true); input.current?.focus(); }
    };
    const onDown = (e) => {
      if (box.current && !box.current.contains(e.target)) { setOpen(false); setMobileOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, []);

  const go = (r) => {
    if (!r) return;
    setOpen(false);
    setQ('');
    input.current?.blur();
    navigate(href(target(r)));
  };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); setMobileOpen(false); input.current?.blur(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(rows.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(rows[active]); }
  };

  useEffect(() => {
    if (mobileOpen) input.current?.focus();
  }, [mobileOpen]);

  return (
    <div ref={box} role="search" className={`${mobileOpen ? 'static' : 'relative flex-none'} flex min-w-0 items-center md:relative md:flex-1`}>
      <button
        type="button"
        className="grid h-9 w-8 flex-none place-items-center rounded-r1 border border-line-2 bg-surface text-ink-2 hover:border-accent hover:text-accent-text min-[400px]:w-9 md:hidden"
        aria-label="Search"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(true)}
      >
        <Icon name="search" small />
      </button>
      <div className={`${mobileOpen ? 'absolute inset-0 z-30 flex items-center gap-1.5 bg-surface px-2' : 'hidden'} md:relative md:inset-auto md:z-auto md:flex md:min-w-0 md:max-w-[560px] md:flex-1 md:bg-transparent md:px-0`}>
        <div className="relative min-w-0 flex-1">
          <Icon name="search" small className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            ref={input}
            type="search"
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search projects, people, messages, voice notes, photos"
            aria-label="Search projects, people, drawings and messages"
            aria-controls="nav-search-results"
            className={`min-h-[38px] w-full min-w-0 rounded-r2 border border-transparent bg-surface-2 py-1.5 pl-9 text-ink placeholder:text-ink-3 focus:border-line-2 focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-accent-soft [&::-webkit-search-cancel-button]:hidden ${mobileOpen ? 'pr-9 md:pr-3.5' : 'pr-3.5'}`}
          />
          {mobileOpen && (
            <button type="button" className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-r1 text-ink-2 md:hidden" aria-label="Close search" onClick={() => { setMobileOpen(false); setOpen(false); setQ(''); }}>
              <Icon name="x" small />
            </button>
          )}
          {!q && <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-r1 border border-line-2 bg-surface px-1.5 text-[11px] font-semibold text-ink-3 md:block">{navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'} K</kbd>}
          {open && q.trim() && (
            <div id="nav-search-results" role="listbox" className="absolute left-0 top-full z-40 mt-1.5 max-h-[min(70vh,460px)] w-[min(560px,calc(100vw-2rem))] overflow-auto rounded-r3 border border-line bg-surface p-1.5 shadow-s2">
              {rows.length === 0 ? (
                <p className="m-0 px-3 py-6 text-center text-ink-3">No results for "{q.trim()}".</p>
              ) : rows.map((r, i) => (
                <div key={`${r.kind}${r.id}`}>
                  {(i === 0 || rows[i - 1].kind !== r.kind) && (
                    <p className="m-0 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-accent-text">{KIND[r.kind]}</p>
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r)}
                    className={`block w-full rounded-r1 border-0 px-3 py-2 text-left ${i === active ? 'bg-accent-soft' : 'bg-transparent'}`}
                  >
                    <b className="block truncate font-medium text-ink"><Mark text={r.title} q={q} /></b>
                    <small className="block truncate text-ink-3">{r.sub}</small>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
