import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { PHASES, PROJECTS } from '../data';
import { colors } from '../theme';

export default function ProjectsScreen() {
  const { user } = useAuth();
  const nav = useNavigation<any>();
  // Clients and the team only see projects they belong to; partners see all.
  const list = PROJECTS.filter(
    (p) => user?.role === 'partner' || p.clientId === user?.id || p.teamIds.includes(user?.id || ''),
  );
  return (
    <FlatList
      style={{ backgroundColor: colors.ground }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={list}
      keyExtractor={(p) => p.id}
      ListEmptyComponent={<Text style={{ color: colors.ink3 }}>No projects yet.</Text>}
      renderItem={({ item: p }) => (
        <Pressable style={s.card} onPress={() => nav.navigate('Project', { id: p.id })}>
          <Text style={s.code}>{p.code}</Text>
          <Text style={s.name}>{p.name}</Text>
          <Text style={s.meta}>{p.kind} · {p.city}</Text>
          <View style={s.pill}><Text style={s.pillText}>{PHASES[p.phase] ?? 'Planning'}</Text></View>
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.line },
  code: { color: colors.ink3, fontSize: 12 },
  name: { color: colors.ink, fontSize: 18, fontWeight: '600', marginTop: 2 },
  meta: { color: colors.ink2, marginTop: 4 },
  pill: { alignSelf: 'flex-start', backgroundColor: colors.accentSoft, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, marginTop: 10 },
  pillText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
});
