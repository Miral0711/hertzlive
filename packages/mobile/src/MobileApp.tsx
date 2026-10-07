import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { isAuthenticated } from '../../frontend/src/auth/authClient';
import { boot } from '../../frontend/src/desktop/session';
import { Location, Router, useNavigate } from './platform/router';
import { ThemeProvider, useStyles, useTheme } from './platform/theme';
import { FieldProvider, useField } from './ui/FieldContext';
import Icon from './ui/Icon';
import { myThreads, t, todayCount, unreadCount, useStore } from './store';
import { routes } from './routes';

boot();

const TABS: [string, string][] = [['chats', 'chat'], ['today', 'today'], ['projects', 'projects'], ['updates', 'bell']];

// Tab bar only shows on top-level screens (same set as the web prototype).
const WITH_TABS = new Set([
  '/mobile/chats', '/mobile/today', '/mobile/projects', '/mobile/updates', '/mobile/profile',
  '/mobile/photos', '/mobile/people', '/mobile/holidays', '/mobile/portfolio',
]);

function Tabs({ pathname }: { pathname: string }) {
  useStore();
  const { read } = useField();
  const navigate = useNavigate();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const due = todayCount();
  const unread = myThreads().reduce((n: number, { t: thread }: any) => n + unreadCount(thread.id, read[thread.id]), 0);
  const s = useStyles((c) => ({
    bar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.surface, paddingBottom: insets.bottom },
    tab: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 2 },
    iconWrap: { paddingHorizontal: 14, paddingVertical: 3, borderRadius: 999 },
    label: { fontSize: 12, color: c.ink3 },
    badge: { position: 'absolute', top: 4, right: '50%', marginRight: -26, minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    badgeText: { color: c.accentInk, fontSize: 12, fontWeight: '700' },
  }));
  return (
    <View style={s.bar} accessibilityRole="tablist">
      {TABS.map(([id, icon]) => {
        const on = id === 'projects' ? pathname.startsWith('/mobile/projects') : pathname === `/mobile/${id}`;
        const count = id === 'today' ? due : id === 'chats' ? unread : 0;
        return (
          <Pressable key={id} style={s.tab} onPress={() => navigate(`/mobile/${id}`, { replace: true })} accessibilityRole="tab" accessibilityState={{ selected: on }}>
            <View style={[s.iconWrap, on && { backgroundColor: c.accentSoft }]}>
              <Icon name={icon} color={on ? c.accentText : c.ink3} />
            </View>
            <Text style={[s.label, on && { color: c.accentText, fontWeight: '600' }]}>{t(id)}</Text>
            {count > 0 && <View style={s.badge}><Text style={s.badgeText}>{count}</Text></View>}
          </Pressable>
        );
      })}
    </View>
  );
}

// Web preview only: http://localhost:8081/?go=/mobile/today opens that screen directly (dev aid).
const deepLink = (): string | null => {
  try { return new URLSearchParams(window.location.search).get('go'); } catch { return null; }
};

function Shell() {
  useStore();
  const { dark } = useTheme();
  const authed = isAuthenticated();
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Router
        routes={routes}
        initial={authed ? (deepLink() || '/mobile/chats') : '/mobile/login'}
        gate={(path) => (!authed && path !== '/mobile/login' ? '/mobile/login' : authed && path === '/mobile/login' ? '/mobile/chats' : null)}
        layout={(loc: Location, screen) => (
          <View style={{ flex: 1 }}>
            <View style={{ flex: 1 }}>{screen}</View>
            {WITH_TABS.has(loc.pathname) && <Tabs pathname={loc.pathname} />}
          </View>
        )}
      />
    </>
  );
}

export default function MobileApp() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <FieldProvider>
          <Shell />
        </FieldProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
