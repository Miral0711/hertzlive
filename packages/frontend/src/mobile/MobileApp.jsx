import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { boot } from '../desktop/session';
import { applyAgencyTheme } from '../shared/core';
import { useStore } from '../shared/store';
import { FieldProvider, useField } from './FieldContext';
import { state, todayCount, myThreads, unreadCount } from './model';
import { t } from './copy';
import Icon from './Icon';
import './mobile.css';

boot();

const TABS = [
  ['chats', 'chat'],
  ['today', 'today'],
  ['projects', 'projects'],
  ['updates', 'bell'],
];

function Tabs() {
  useStore();
  const { read } = useField();
  const due = todayCount();
  const unread = myThreads().reduce((n, { t: thread }) => n + unreadCount(thread.id, read[thread.id]), 0);
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map(([id, icon]) => (
        <NavLink key={id} to={`/mobile/${id}`} end={id !== 'projects'} className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>
          <Icon name={icon} />
          <span>{t(id)}</span>
          {id === 'today' && due > 0 && <span className="badge">{due}</span>}
          {id === 'chats' && unread > 0 && <span className="badge">{unread}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

const WITH_TABS = new Set([
  '/mobile/chats',
  '/mobile/today',
  '/mobile/projects',
  '/mobile/updates',
  '/mobile/profile',
  '/mobile/photos',
  '/mobile/people',
  '/mobile/holidays',
  '/mobile/portfolio',
]);

export default function MobileApp() {
  useStore();
  const { pathname } = useLocation();
  const showTabs = WITH_TABS.has(pathname);
  const theme = state.theme === 'system' ? undefined : state.theme;

  useEffect(() => {
    const root = document.documentElement;
    if (theme) root.dataset.theme = theme;
    else delete root.dataset.theme;
    applyAgencyTheme();
  });

  return (
    <FieldProvider>
      <div className="field-stage">
        <div className="field" data-theme={theme}>
          <div className="field-main">
            <Outlet />
          </div>
          {showTabs && <Tabs />}
        </div>
      </div>
    </FieldProvider>
  );
}
