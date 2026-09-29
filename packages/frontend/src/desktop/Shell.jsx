import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { state, me, parseRoute, applyAgencyTheme, tenantBrand } from '../shared/core.js';
import { useStore } from '../shared/store';
import Icon from '../ui/Icon';
import { Empty } from '../ui/ui';
import { DLink, DESKTOP_BASE, href } from './nav';
import { NAV_GROUPS, navFor } from './helpers';
import { PAGES } from './registry';
import ChatPane from './chat/ChatPane';
import DialogHost from './DialogHost';
import {
  cycleTheme, logout, resetSampleData, switchPersona, toggleChatPane,
} from './session';
import { PERSONAS } from './data';

const themeLabel = { system: 'System', light: 'Light', dark: 'Dark' };

function SideNav({ page }) {
  const allowed = navFor();
  return NAV_GROUPS.map(([label, keys]) => {
    const rows = keys.map((k) => allowed.find(([id]) => id === k)).filter(Boolean);
    if (!rows.length) return null;
    const links = rows.map(([k, l, i]) => (
      <SideLink key={k} to={`#/${k}`} current={page === k} icon={i}>{l}</SideLink>
    ));
    return label === 'Resources' ? (
      <details key={label} className="mt-1" open={keys.includes(page)}>
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
          {label} &amp; settings
        </summary>
        <div className="flex flex-col gap-0.5">{links}</div>
      </details>
    ) : (
      <div key={label} className="flex flex-col gap-0.5">
        <p className="m-0 px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</p>
        {links}
      </div>
    );
  });
}
function SideLink({ to, current, icon, children }) {
  return (
    <DLink
      to={to}
      aria-current={current ? 'page' : undefined}
      style={{ color: current ? 'var(--accent-text)' : 'var(--ink-2)' }}
      className={`flex min-h-10 items-center gap-3 rounded-r1 px-3 font-medium no-underline transition hover:bg-surface-2 ${current ? 'bg-accent-soft font-semibold' : ''}`}
    >
      <Icon name={icon} className={current ? '' : 'text-ink-3'} />
      <span>{children}</span>
    </DLink>
  );
}

export default function Shell() {
  useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef(null);
  const searchRef = useRef(null);

  // Keep the legacy route string in step with the URL for code that calls parseRoute().
  state.route = '#' + (location.pathname.slice(DESKTOP_BASE.length) || '/today') + location.search;
  const { parts, q } = parseRoute();
  const page = parts[0] || 'today';

  useEffect(() => {
    window.__navigate = (route) => navigate(href(route));
    return () => { delete window.__navigate; };
  }, [navigate]);
  useEffect(() => {
    state.desk.dialog = null;
    mainRef.current?.scrollTo?.(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    const root = document.documentElement;
    if (state.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = state.theme;
    applyAgencyTheme();
  });
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const allowed = navFor().some(([k]) => k === page) || ['search', 'sign', 'review', 's', 'portfolio'].includes(page);
  const workspace = page === 'chats' && allowed;
  const focusedWork = page === 'review';
  const noChat = workspace || focusedWork || state.desk.chatHidden;
  const u = me();
  const Page = PAGES[page] || PAGES.today;
  const brand = tenantBrand();

  return (
    <div className="grid h-dvh grid-rows-[60px_minmax(0,1fr)]">
      <a
        href="#workspace"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-r1 focus:bg-surface focus:px-3 focus:py-2"
        onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }}
      >
        Skip to workspace
      </a>
      <header className="flex items-center gap-4 border-b border-line bg-surface px-4">
        <DLink to="#/today" className="flex min-w-[184px] items-baseline gap-1.5 text-lg no-underline" style={{ color: 'var(--ink)' }}>
          <b className="font-bold tracking-tight">{brand?.short || state.db.AGENCY.short}</b>
          <span className="text-sm text-ink-3">Studio</span>
        </DLink>
        <form
          role="search"
          className="flex flex-1 items-center"
          onSubmit={(e) => {
            e.preventDefault();
            const v = new FormData(e.currentTarget).get('q');
            navigate(href(`#/search?q=${encodeURIComponent(v)}`));
          }}
        >
          <input
            ref={searchRef}
            type="search"
            name="q"
            key={page === 'search' ? q.q : 'search'}
            defaultValue={page === 'search' ? q.q || '' : ''}
            placeholder="Search your workspace"
            aria-label="Search projects, people, drawings and messages"
            className="min-h-[38px] max-w-[560px] flex-1 rounded-lg border border-transparent bg-surface-2 px-3.5 text-ink placeholder:text-ink-3 focus:border-line-2 focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-accent-soft"
          />
        </form>
        {!(workspace || focusedWork) && (
          <button
            type="button"
            onClick={toggleChatPane}
            aria-expanded={!state.desk.chatHidden}
            aria-controls="conversation"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-r1 border border-line-2 bg-surface px-3.5 font-semibold hover:bg-surface-2"
          >
            <Icon name="chat" small /> Chats
          </button>
        )}
        <details className="relative">
          <summary className="cursor-pointer rounded-r1 px-2 py-1.5 text-[13px] text-ink-2 hover:bg-surface-2">Preview options</summary>
          <div className="absolute right-0 top-full z-20 mt-1 flex w-72 flex-col gap-2.5 rounded-r3 border border-line bg-surface p-3.5 shadow-s2">
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              Viewing as
              <select
                aria-label="Switch persona"
                value={state.userId}
                onChange={(e) => switchPersona(e.target.value)}
                className="min-h-9 flex-1 rounded-r1 border border-line-2 bg-surface px-2.5 text-ink"
              >
                {PERSONAS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
              </select>
            </label>
            <button type="button" onClick={cycleTheme} className="inline-flex min-h-9 items-center gap-1.5 rounded-r1 border border-line-2 px-3.5 font-semibold hover:bg-surface-2">
              <Icon name="moon" small /> Theme: {themeLabel[state.theme]}
            </button>
            <button type="button" onClick={resetSampleData} className="inline-flex min-h-9 items-center gap-1.5 rounded-r1 border border-line-2 px-3.5 font-semibold hover:bg-surface-2">
              <Icon name="reset" small /> Reset sample data
            </button>
            <button
              type="button"
              onClick={() => { logout(); navigate('/login', { replace: true }); }}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-r1 border border-line-2 px-3.5 font-semibold hover:bg-surface-2"
            >
              <Icon name="logout" small /> Log out
            </button>
            <small className="text-ink-3">Interactive preview · sample records</small>
          </div>
        </details>
      </header>

      <div className={`grid min-h-0 ${noChat ? 'grid-cols-[188px_minmax(0,1fr)]' : 'grid-cols-[188px_minmax(0,1fr)_360px] max-[1250px]:grid-cols-[188px_minmax(0,1fr)]'}`}>
        <nav aria-label="Modules" className="flex flex-col gap-0.5 overflow-auto border-r border-line bg-surface px-2.5 py-3">
          <SideNav page={focusedWork ? 'projects' : page} />
          <div className="mt-auto flex items-center gap-2.5 pt-4">
            <span className="inline-grid h-10 w-10 flex-none place-items-center rounded-full bg-surface-3 text-[13px] font-semibold">
              {u.ini || u.name.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <b className="block truncate">{u.name}</b>
              <small className="text-ink-3">{u.title || u.role}</small>
            </div>
          </div>
        </nav>
        <main
          ref={mainRef}
          id="workspace"
          tabIndex={-1}
          data-page={page}
          className="min-w-0 overflow-auto px-9 pb-16 pt-8 focus:outline-none"
        >
          {(state.storageError || state.desk.draftStorageError) && (
            <div role="alert" className="mb-3.5 rounded-r1 bg-warn-soft px-3.5 py-2.5 font-medium text-warn">
              {state.storageError || state.desk.draftStorageError}
            </div>
          )}
          {allowed ? <Page parts={parts.slice(1)} q={q} /> : <Empty>Not available for your role.</Empty>}
        </main>
        {!noChat && <ChatPane />}
      </div>

      {state.toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-r2 bg-ink px-4 py-2.5 font-medium text-surface shadow-s2">
          {state.toast}
        </div>
      )}
      <DialogHost />
    </div>
  );
}
