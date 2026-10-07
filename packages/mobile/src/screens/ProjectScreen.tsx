import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { PHASES, PROJECTS, TASKS, inr, userById } from '../data';
import { colors } from '../theme';

export default function ProjectScreen() {
  const { id } = useRoute<any>().params;
  const p = PROJECTS.find((x) => x.id === id);
  if (!p) return <Text style={{ padding: 16 }}>Project not found.</Text>;
  const tasks = TASKS.filter((t) => t.projectId === p.id && t.status !== 'done');
  const pct = Math.round((p.actual / p.budget) * 100);

  return (
    <ScrollView style={{ backgroundColor: colors.ground }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={s.card}>
        <Text style={s.h}>{p.name}</Text>
        <Text style={s.meta}>{p.kind} · {p.city}</Text>
        <Text style={s.meta}>Phase: {PHASES[p.phase]} · Handover {p.handover}</Text>
      </View>

      <View style={s.card}>
        <Text style={s.sec}>Budget</Text>
        <Text style={s.meta}>{inr(p.actual)} of {inr(p.budget)} ({pct}%)</Text>
        <View style={s.bar}><View style={[s.fill, { width: `${Math.min(pct, 100)}%` }]} /></View>
      </View>

      <View style={s.card}>
        <Text style={s.sec}>Milestones</Text>
        {p.milestones.map((m) => (
          <Text key={m.id} style={s.row}>{m.done ? '✓' : '○'}  {m.name} · {m.date}</Text>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.sec}>Open tasks ({tasks.length})</Text>
        {tasks.map((t) => (
          <Text key={t.id} style={s.row}>{t.title} · {userById(t.owner)?.name ?? t.owner}</Text>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.line, gap: 6 },
  h: { fontSize: 22, fontWeight: '700', color: colors.ink },
  sec: { fontWeight: '600', color: colors.ink, marginBottom: 4 },
  meta: { color: colors.ink2 },
  row: { color: colors.ink, paddingVertical: 4 },
  bar: { height: 8, backgroundColor: colors.surface2, borderRadius: 4, overflow: 'hidden', marginTop: 6 },
  fill: { height: 8, backgroundColor: colors.accent },
});
