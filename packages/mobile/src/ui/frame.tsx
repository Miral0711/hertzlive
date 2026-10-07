import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { useNavigate } from '../platform/router';
import { useStyles } from '../platform/theme';

export function backName(url?: string) {
  const path = (url || '').split('?')[0];
  if (path === '/mobile/updates') return 'Updates';
  if (path === '/mobile/today') return 'Today';
  if (path.startsWith('/mobile/issues/')) return 'Issue';
  if (path.includes('/changes')) return 'Changes';
  if (/\/drawings\/[^/]+/.test(path)) return 'Drawing';
  if (path.includes('/drawings')) return 'Drawings';
  if (path.includes('/people')) return 'People';
  if (path.includes('/refs')) return 'References';
  if (path.includes('/materials')) return 'Materials';
  if (path.startsWith('/mobile/photos')) return 'Photos';
  if (path.startsWith('/mobile/chats/')) return 'Chat';
  if (path.startsWith('/mobile/projects/')) return 'Project';
  if (path === '/mobile/profile') return 'Profile';
  if (path.startsWith('/mobile/chats')) return 'Chats';
  return 'Back';
}

// A full-height screen with the safe-area top inset. Use <Screen> for tab screens and custom
// headers; <Page> below is the standard "back + title" detail screen.
export function Screen({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const s = useStyles((c) => ({ screen: { flex: 1, backgroundColor: c.surface } }));
  return <View style={[s.screen, { paddingTop: insets.top }]}>{children}</View>;
}

// Generic top bar: left/right slots are arbitrary nodes; the title block flexes in the middle.
export function TopBar({ children, style }: { children: React.ReactNode; style?: any }) {
  const s = useStyles((c, t) => ({
    top: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: t.headerH, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: c.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
  }));
  return <View style={[s.top, style]}>{children}</View>;
}

export function BackButton({ to, label = 'Back', showLabel = true }: { to?: string; label?: string; showLabel?: boolean }) {
  const navigate = useNavigate();
  const s = useStyles((c) => ({
    btn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingRight: 6 },
    text: { color: c.accent, fontWeight: '600', fontSize: 16 },
  }));
  return (
    <Pressable style={s.btn} onPress={() => navigate(to ?? -1)} accessibilityLabel={label === 'Back' ? 'Back' : `Back to ${label}`}>
      <Icon name="back" color={undefined} />
      {showLabel ? <Text style={s.text}>{label}</Text> : null}
    </Pressable>
  );
}

// Detail page: back button + title (+ subtitle), scrollable canvas body, optional pinned footer.
export function Page({ back, backLabel = 'Back', title, sub, children, bare = false, sheet = false, footer = null }: {
  back?: string; backLabel?: string; title: string; sub?: string; children?: React.ReactNode;
  bare?: boolean; sheet?: boolean; stackTitle?: boolean; footer?: React.ReactNode;
}) {
  const s = useStyles((c) => ({
    heading: { flex: 1, minWidth: 0 },
    h1: { fontSize: sheet ? 17 : 16, fontWeight: '600', color: c.ink },
    sub: { fontSize: 13, color: c.ink3, marginTop: 2 },
    body: { flex: 1, backgroundColor: sheet || bare ? c.surface : c.ground },
    content: sheet ? { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 28 } : { padding: bare ? 0 : 14, paddingTop: bare ? 0 : 8, paddingBottom: 24 },
  }));
  return (
    <Screen>
      <TopBar>
        <BackButton to={back} label={backLabel} showLabel={!sheet} />
        <View style={s.heading}>
          <Text style={s.h1} numberOfLines={1}>{title}</Text>
          {sub ? <Text style={s.sub} numberOfLines={1}>{sub}</Text> : null}
        </View>
      </TopBar>
      <ScrollView style={s.body} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      {footer}
    </Screen>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  const s = useStyles((c) => ({ note: { color: c.ink3, fontSize: 13, marginVertical: 8 } }));
  return <Text style={s.note}>{children}</Text>;
}
