import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { boot } from '../desktop/session';
import { applyAgencyTheme } from '../shared/core';
import { useStore } from '../shared/store';
import { FieldProvider } from './FieldContext';
import { state, todayCount } from './model';
import Icon from './Icon';
import './mobile.css';

boot();

const TABS = [
  ['chats', 'Chats', 'chat'],
  ['today', 'Today', 'today'],
  ['projects', 'Projects', 'projects'],
  ['updates', 'Updates', 'bell'],
];

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
  const due = todayCount();
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
          {showTabs && (
            <nav className="tabbar" aria-label="Main">
              {TABS.map(([id, label, icon]) => (
                <NavLink key={id} to={`/mobile/${id}`} end={id !== 'projects' && id !== 'photos'} className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>
                  <Icon name={icon} />
                  <span>{label}</span>
                  {id === 'today' && due > 0 && <span className="badge">{due}</span>}
                </NavLink>
              ))}
            </nav>
          )}
        </div>
      </div>
    </FieldProvider>
  );
}
