import React from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { MESSAGES, THREADS } from '../data';
import { colors } from '../theme';

export default function ChatsScreen() {
  const { user } = useAuth();
  const nav = useNavigation<any>();
  const threads = THREADS.filter((t) => t.memberIds.includes(user?.id || ''));
  return (
    <FlatList
      style={{ backgroundColor: colors.ground }}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      data={threads}
      keyExtractor={(t) => t.id}
      ListEmptyComponent={<Text style={{ color: colors.ink3 }}>No conversations.</Text>}
      renderItem={({ item: t }) => {
        const last = [...MESSAGES].reverse().find((m) => m.threadId === t.id);
        return (
          <Pressable style={s.card} onPress={() => nav.navigate('Thread', { id: t.id })}>
            <Text style={s.title}>{t.name}</Text>
            <Text style={s.meta} numberOfLines={1}>{last?.text ?? 'No messages yet'}</Text>
          </Pressable>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.line },
  title: { color: colors.ink, fontWeight: '600' },
  meta: { color: colors.ink2, marginTop: 4 },
});
