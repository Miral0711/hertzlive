import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { MESSAGES, userById } from '../data';
import { colors } from '../theme';

// Read-only for now; sending needs the chat store from the web app ported over.
export default function ThreadScreen() {
  const { id } = useRoute<any>().params;
  const { user } = useAuth();
  const msgs = MESSAGES.filter((m) => m.threadId === id);
  return (
    <FlatList
      style={{ backgroundColor: colors.ground }}
      contentContainerStyle={{ padding: 16, gap: 8 }}
      data={msgs}
      keyExtractor={(m) => m.id}
      renderItem={({ item: m }) => {
        const mine = m.by === user?.id;
        return (
          <View style={[s.bubble, mine ? s.mine : s.theirs]}>
            {!mine && <Text style={s.who}>{userById(m.by)?.name ?? m.by}</Text>}
            <Text style={{ color: mine ? colors.accentInk : colors.ink }}>{m.text}</Text>
          </View>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  bubble: { maxWidth: '82%', padding: 10, borderRadius: 12 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.accent },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  who: { color: colors.ink3, fontSize: 11, marginBottom: 2 },
});
