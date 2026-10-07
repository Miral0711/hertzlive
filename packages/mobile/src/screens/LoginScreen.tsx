import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, useAuth } from '../auth/AuthContext';
import { colors } from '../theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e = email, p = password) => {
    try {
      setError('');
      await login(e, p);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Hertz Workspace</Text>
      <Text style={s.sub}>Sign in to continue</Text>
      <TextInput style={s.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address"
        value={email} onChangeText={setEmail} />
      <TextInput style={s.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      {!!error && <Text style={s.error}>{error}</Text>}
      <Pressable style={s.btn} onPress={() => submit()}><Text style={s.btnText}>Sign in</Text></Pressable>

      <Text style={s.demo}>Demo accounts (tap to sign in)</Text>
      {DEMO_ACCOUNTS.map((a) => (
        <Pressable key={a.email} style={s.account} onPress={() => submit(a.email, DEMO_PASSWORD)}>
          <Text style={s.accountText}>{a.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 24, paddingTop: 80, backgroundColor: colors.ground, flexGrow: 1 },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink },
  sub: { color: colors.ink2, marginBottom: 24, marginTop: 4 },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 12, color: colors.ink },
  error: { color: colors.crit, marginBottom: 8 },
  btn: { backgroundColor: colors.accent, borderRadius: 10, padding: 14, alignItems: 'center' },
  btnText: { color: colors.accentInk, fontWeight: '600' },
  demo: { marginTop: 32, marginBottom: 8, color: colors.ink3, fontSize: 12, textTransform: 'uppercase' },
  account: { backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 8, borderColor: colors.line, borderWidth: 1 },
  accountText: { color: colors.ink },
});
