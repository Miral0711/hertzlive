import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Icon from '../ui/Icon';
import { Screen, TopBar } from '../ui/frame';
import { Avatar } from '../ui/faces';
import { DayRow, Small, Strong, Sub } from '../ui/DayRows';
import { Link } from '../platform/router';
import { useStyles } from '../platform/theme';
import { updates, fmtD, me, projectName, useStore, t } from '../store';

const KIND: Record<string, string> = {
  decision: 'Decision',
  issue: 'Issue',
  answer: 'Office answer',
  approval: 'Approval',
  drawing: 'Drawing',
  delivery: 'Delivery',
  site: 'Site',
  client: 'Client',
  enquiry: 'Enquiry',
  people: 'People',
};

export default function Updates() {
  useStore();
  const list: any[] = updates();
  const person = me();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const q = query.trim().toLowerCase();
  const kinds = ['delivery', 'drawing', 'approval', 'decision', 'issue', 'answer', 'site', 'client', 'enquiry', 'people'].filter((item) => list.some((row) => row.kind === item));
  const shown = list.filter((item) => {
    if (kind !== 'all' && item.kind !== kind) return false;
    if (!q) return true;
    return [item.title, item.detail, item.projectId ? projectName(item.projectId) : '', KIND[item.kind] || item.kind]
      .join(' ').toLowerCase().includes(q);
  });
  const groups: { key: string; title: string; items: any[] }[] = [];
  const seen = new Map<string, number>();
  shown.forEach((item) => {
    const key = item.projectId || 'studio';
    if (!seen.has(key)) {
      seen.set(key, groups.length);
      groups.push({ key, title: item.projectId ? projectName(item.projectId) : 'Studio', items: [] });
    }
    groups[seen.get(key)!].items.push(item);
  });

  const s = useStyles((c, th) => ({
    h1: { fontSize: 22, fontWeight: '600', color: c.ink, lineHeight: 24 },
    h1sub: { fontSize: 13, fontWeight: '500', color: c.ink3 },
    body: { flex: 1, backgroundColor: c.surface },
    content: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 28 },
    note: { marginTop: 8, fontSize: 13, color: c.ink3, fontWeight: '500' },
    search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, minHeight: 46, paddingHorizontal: 12, borderRadius: th.radius.r2, backgroundColor: c.surface2 },
    input: { flex: 1, minWidth: 0, color: c.ink, fontSize: 16, paddingVertical: 8 },
    kinds: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 2, marginTop: 4 },
    kind: { paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    kindOn: { borderBottomColor: c.ink },
    kindT: { fontSize: 13, fontWeight: '600', color: c.ink3 },
    kindTOn: { color: c.ink },
    h2: { marginTop: 18, marginBottom: 2, fontSize: 13, fontWeight: '600', color: c.ink3 },
    empty: { padding: 32, alignItems: 'center' },
    emptyH: { fontSize: 15, fontWeight: '600', color: c.ink, marginBottom: 4 },
    emptyP: { color: c.ink3, textAlign: 'center' },
  }));

  return (
    <Screen>
      <TopBar>
        <Text style={[s.h1, { flex: 1 }]} numberOfLines={2}>
          {t('updates')}
          {'\n'}
          <Text style={s.h1sub}>What changed in your projects</Text>
        </Text>
        <Link to="/mobile/profile?from=%2Fmobile%2Fupdates" accessibilityLabel="Profile"><Avatar person={person} size="sm" /></Link>
      </TopBar>
      <ScrollView style={s.body} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.note}>The record of what already changed. Work that needs you stays on Today.</Text>
        {list.length > 6 && (
          <View style={s.search}>
            <Icon name="search" size={18} />
            <TextInput style={s.input} value={query} onChangeText={setQuery} autoCapitalize="none" placeholder="Search updates" accessibilityLabel="Search updates" />
          </View>
        )}
        {kinds.length > 1 && (
          <View style={s.kinds} accessibilityRole="tablist" accessibilityLabel="Update type">
            {['all', ...kinds].map((item) => (
              <Pressable key={item} style={[s.kind, kind === item && s.kindOn]} onPress={() => setKind(item)} accessibilityRole="tab" accessibilityState={{ selected: kind === item }}>
                <Text style={[s.kindT, kind === item && s.kindTOn]}>{item === 'all' ? 'All' : KIND[item] || item}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {groups.map((group) => (
          <View key={group.key}>
            <Text style={s.h2}>{group.title}</Text>
            {group.items.map((item, i) => (
              <DayRow
                key={item.id} first={i === 0} to={item.to || undefined}
                left={<>
                  <Small>{KIND[item.kind] || item.kind} · {fmtD(item.at)}</Small>
                  <Strong>{item.title}</Strong>
                  {item.detail ? <Sub>{item.detail}</Sub> : null}
                </>}
              />
            ))}
          </View>
        ))}
        {list.length > 0 && !shown.length && <View style={s.empty}><Text style={s.emptyH}>No update matches</Text></View>}
        {!list.length && (
          <View style={s.empty}>
            <Text style={s.emptyH}>Nothing has changed yet</Text>
            <Text style={s.emptyP}>Office answers, drawing issues and decisions will land here.</Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
