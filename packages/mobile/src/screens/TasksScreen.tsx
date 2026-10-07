import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { PROJECTS, TASKS } from '../data';
import { colors } from '../theme';

export default function TasksScreen() {
  const { user } = useAuth();
  const mine = TASKS.filter((t) => t.owner === user?.id && t.status !== 'done');
  return (
    <FlatList
      style={{ backgroundColor: colors.ground }}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      data={mine}
      keyExtractor={(t) => t.id}
      ListEmptyComponent={<Text style={{ color: colors.ink3 }}>Nothing assigned to you.</Text>}
      renderItem={({ item: t }) => (
        <View style={s.card}>
          <Text style={s.title}>{t.title}</Text>
          <Text style={s.meta}>{PROJECTS.find((p) => p.id === t.projectId)?.name} · due {t.due}</Text>
          {t.critical && <Text style={s.crit}>Critical</Text>}
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.line },
  title: { color: colors.ink, fontWeight: '600' },
  meta: { color: colors.ink2, marginTop: 4 },
  crit: { color: colors.crit, backgroundColor: colors.critSoft, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, marginTop: 8, fontSize: 12 },
});
