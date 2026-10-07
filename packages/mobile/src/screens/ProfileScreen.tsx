import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  return (
    <View style={s.wrap}>
      <Text style={s.name}>{user?.name}</Text>
      <Text style={s.meta}>{user?.title ?? user?.role}</Text>
      <Pressable style={s.btn} onPress={logout}><Text style={s.btnText}>Sign out</Text></Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 24, backgroundColor: colors.ground },
  name: { fontSize: 22, fontWeight: '700', color: colors.ink },
  meta: { color: colors.ink2, marginTop: 4, textTransform: 'capitalize' },
  btn: { marginTop: 24, borderColor: colors.line, borderWidth: 1, backgroundColor: colors.surface, borderRadius: 10, padding: 14, alignItems: 'center' },
  btnText: { color: colors.crit, fontWeight: '600' },
});
