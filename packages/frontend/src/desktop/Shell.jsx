import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { state, me, parseRoute, applyAgencyTheme, tenantBrand } from '../shared/core.js';
import { useStore } from '../shared/store';
import Icon from '../ui/Icon';
import { Divider, Dropdown, DropdownItem, Empty } from '../ui/ui';
import { DLink, DESKTOP_BASE, href } from './nav';
import { NAV, NAV_GROUPS, navFor } from './helpers';
import { PAGES } from './registry';
import ChatPane from './chat/ChatPane';
import DialogHost from './DialogHost';
import {
  cycleTheme, logout, resetSampleData, switchPersona, toggleChatPane,
} from './session';
import { PERSONAS } from './data';

const themeLabel = { system: 'System', light: 'Light', dark: 'Dark' };

const ICON = Object.fromEntries(NAV.map(([k, , i]) => [k, i]));
const groupLabel = 'm-0 px-3 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-nav-ink opacity-60';

function SideNav({ page }) {
  const allowed = navFor();
  return NAV_GROUPS.map(([label, keys]) => {
    const rows = keys.filter((k) => k !== 'settings').map((k) => allowed.find(([id]) => id === k)).filter(Boolean);
    if (!rows.length) return null;
    const links = rows.map(([k, l]) => (
      <SideLink key={k} to={`#/${k}`} icon={ICON[k]} current={page === k}>{l}</SideLink>
    ));
    return label === 'Resources' ? (
      <details key={label} className="group" open={keys.includes(page)}>
        <summary className={`${groupLabel} flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden`}>
          More
          <Icon name="chev" small className="transition group-open:rotate-90" />
        </summary>
        <div className="flex flex-col gap-0.5">{links}</div>
      </details>
    ) : (
      <div key={label} className="flex flex-col gap-0.5">
        <p className={groupLabel}>{label}</p>
        {links}
      </div>
    );
  });
}
function SideLink({ to, icon, current, children }) {
  return (
    <DLink
      to={to}
      aria-current={current ? 'page' : undefined}
      className={`flex min-h-9 items-center gap-3 rounded-r1 px-3 text-[13.5px] font-medium no-underline transition ${current ? 'bg-nav-active font-semibold text-nav-active-ink' : 'text-nav-ink opacity-90 hover:bg-nav-hover hover:opacity-100'}`}
    >
      {icon && <Icon name={icon} small />}
      <span className="truncate">{children}</span>
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
      <header className="flex items-center gap-4 bg-surface pr-5">
        <DLink to="#/today" className="flex h-full w-[188px] flex-none flex-col justify-center gap-0.5 border-b border-nav-line bg-nav px-5 text-nav-ink no-underline">
          <b className="font-serif text-lg font-semibold uppercase leading-none tracking-[0.14em]">{brand?.short || state.db.AGENCY.short}</b>
          <span className="text-[10.5px] uppercase leading-none tracking-[0.1em] opacity-70">Studio</span>
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
          <div className="relative max-w-[560px] flex-1">
            <Icon name="search" small className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              ref={searchRef}
              type="search"
              name="q"
              key={page === 'search' ? q.q : 'search'}
              defaultValue={page === 'search' ? q.q || '' : ''}
              placeholder="Search your workspace"
              aria-label="Search projects, people, drawings and messages"
              className="min-h-[38px] w-full rounded-r2 border border-transparent bg-surface-2 py-1.5 pl-9 pr-3.5 text-ink placeholder:text-ink-3 focus:border-line-2 focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-accent-soft"
            />
          </div>
        </form>
        {!(workspace || focusedWork) && (
          <button
            type="button"
            onClick={toggleChatPane}
            aria-expanded={!state.desk.chatHidden}
            aria-controls="conversation"
            className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-r1 border border-line-2 bg-surface px-3.5 font-medium text-ink-2 hover:bg-surface-2 hover:text-accent-text"
          >
            <Icon name="chat" small /> Chats
          </button>
        )}
        <Dropdown trigger={<><Icon name="me" small /> Preview options</>} panelClassName="!flex w-72 flex-col gap-2.5 !p-3.5">
          <label className="mb-1 flex items-center gap-2 text-[13px] text-ink-2">
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
          <Divider className="mb-1" />
          <DropdownItem icon="moon" onClick={cycleTheme}>Theme: {themeLabel[state.theme]}</DropdownItem>
          <DropdownItem icon="reset" onClick={resetSampleData}>Reset sample data</DropdownItem>
          <DropdownItem icon="logout" onClick={() => { logout(); navigate('/login', { replace: true }); }}>Log out</DropdownItem>
          <Divider className="my-1" />
          <small className="px-2.5 text-ink-3">Interactive preview · sample records</small>
        </Dropdown>
      </header>

      <div className={`grid min-h-0 ${noChat ? 'grid-cols-[188px_minmax(0,1fr)]' : 'grid-cols-[188px_minmax(0,1fr)_360px] max-[1250px]:grid-cols-[188px_minmax(0,1fr)]'}`}>
        <nav aria-label="Modules" className="flex flex-col gap-0.5 overflow-auto bg-nav px-2.5 pb-3 pt-1 text-nav-ink">
          <SideNav page={focusedWork ? 'projects' : page} />
          <div className="mt-auto flex flex-col gap-2 border-t border-nav-line pt-3">
            <DLink to="#/settings" className="flex min-h-9 items-center gap-3 rounded-r1 px-3 text-[13.5px] font-medium text-nav-ink no-underline opacity-90 transition hover:bg-nav-hover hover:opacity-100">
              <Icon name="settings" small /> Settings
            </DLink>
            <div className="flex items-center gap-2.5 px-3">
            <span className="inline-grid h-9 w-9 flex-none place-items-center rounded-full bg-nav-active text-xs font-semibold text-nav-active-ink">
              {u.ini || u.name.slice(0, 1)}
            </span>
            <div className="min-w-0 leading-tight">
              <b className="block truncate text-[13px]">{u.name}</b>
              <small className="block truncate text-[11.5px] opacity-70">{u.title || u.role}</small>
            </div>
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
