import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { state, me, parseRoute, applyAgencyTheme, tenantBrand } from '../shared/core.js';
import { useStore } from '../shared/store';
import Icon from '../ui/Icon';
import { Empty } from '../ui/ui';
import { DLink, DESKTOP_BASE, href } from './nav';
import NavSearch from './NavSearch';
import NavActions from './NavActions';
import { NAV, NAV_GROUPS, navFor } from './helpers';
import { PAGES } from './registry';
import ChatPane from './chat/ChatPane';
import DialogHost from './DialogHost';
import { toggleChatPane } from './session';

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
  const [navOpen, setNavOpen] = useState(false);

  // Keep the legacy route string in step with the URL for code that calls parseRoute().
  state.route = '#' + (location.pathname.slice(DESKTOP_BASE.length) || '/today') + location.search;
  const { parts, q } = parseRoute();
  const page = parts[0] || 'today';

  useEffect(() => {
    window.__navigate = (route) => navigate(href(route));
    return () => { delete window.__navigate; };
  }, [navigate]);
  useEffect(() => {
    setNavOpen(false);
    state.desk.dialog = null;
    mainRef.current?.scrollTo?.(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    const root = document.documentElement;
    if (state.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = state.theme;
    applyAgencyTheme();
  });

  const allowed = navFor().some(([k]) => k === page) || ['search', 'sign', 'review', 's', 'portfolio'].includes(page);
  const workspace = page === 'chats' && allowed;
  const focusedWork = page === 'review';
  const noChat = workspace || focusedWork || state.desk.chatHidden;
  const u = me();
  const Page = PAGES[page] || PAGES.today;
  const brand = tenantBrand();

  return (
    <div className="grid h-dvh grid-rows-shell">
      <a
        href="#workspace"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-r1 focus:bg-surface focus:px-3 focus:py-2"
        onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }}
      >
        Skip to workspace
      </a>
      <header className="flex items-center gap-2 border-b border-line bg-surface pr-3 sm:gap-4 sm:pr-5">
        <button type="button" aria-label="Open menu" aria-expanded={navOpen} onClick={() => setNavOpen((o) => !o)} className="ml-2 hidden h-10 w-10 flex-none place-items-center rounded-r1 border border-line-2 text-ink-2 max-lg:grid">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <DLink to="#/today" className="flex h-full w-nav flex-none flex-col justify-center gap-0.5 border-b border-nav-line bg-nav px-5 text-nav-ink no-underline max-lg:w-auto max-lg:min-w-[104px] max-sm:px-3">
          <b className="font-serif text-lg font-semibold uppercase leading-none tracking-[0.14em]">{brand?.short || state.db.AGENCY.short}</b>
          <span className="text-[10.5px] uppercase leading-none tracking-[0.1em] opacity-70">Studio</span>
        </DLink>
        <NavSearch />
        {!(workspace || focusedWork) && (
          <button
            type="button"
            onClick={toggleChatPane}
            aria-expanded={!state.desk.chatHidden}
            aria-controls="conversation"
            className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-r1 border border-line-2 bg-surface px-3 sm:px-3.5 font-medium text-ink-2 hover:bg-surface-2 hover:text-accent-text"
          >
            <Icon name="chat" small /> <span className="max-sm:hidden">Chats</span>
          </button>
        )}
        <NavActions />
      </header>

      <div className={`relative grid min-h-0 max-lg:grid-cols-1 ${noChat ? 'grid-cols-shell' : 'grid-cols-shell-chat max-[1250px]:grid-cols-shell'}`}>
        {navOpen && <button type="button" aria-label="Close menu" onClick={() => setNavOpen(false)} className="absolute inset-0 z-30 hidden bg-black/40 max-lg:block" />}
        <nav aria-label="Modules" className={`flex flex-col gap-0.5 overflow-auto bg-nav px-2.5 pb-3 pt-1 text-nav-ink max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:w-[min(280px,85vw)] max-lg:shadow-s2 max-lg:transition-transform ${navOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'}`}>
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
          className="min-w-0 overflow-auto px-page-x pb-16 pt-page-y focus:outline-none"
        >
          {(state.storageError || state.desk.draftStorageError) && (
            <div role="alert" className="mb-3.5 rounded-r1 bg-warn-soft px-3.5 py-2.5 font-medium text-warn">
              {state.storageError || state.desk.draftStorageError}
            </div>
          )}
          {allowed ? <Page parts={parts.slice(1)} q={q} /> : <Empty>Not available for your role.</Empty>}
        </main>
        {!noChat && <div className="contents max-[1250px]:hidden"><ChatPane /></div>}
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
