import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { login } from '../../../frontend/src/auth/authClient';
import { DEMO_ACCOUNTS } from '../../../frontend/src/auth/demoAccounts';
import { hydrateSessionIntoState } from '../../../frontend/src/desktop/session';
import { useNavigate, useLocation } from '../platform/router';
import { useStyles } from '../platform/theme';

export default function Login() {
  const navigate = useNavigate();
  const { state: nav } = useLocation();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState<string>(DEMO_ACCOUNTS[0].email);
  const [picking, setPicking] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const s = useStyles((c, t) => ({
    stage: { flex: 1, backgroundColor: c.accent },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: 20, paddingTop: 32 + insets.top },
    brand: { color: c.accentInk, fontSize: 22, fontWeight: '600', letterSpacing: 3.5, textTransform: 'uppercase' },
    studio: { color: c.accentInk, opacity: 0.7, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginTop: 6 },
    tag: { color: c.accentInk, fontSize: 26, fontWeight: '500', lineHeight: 30, marginTop: 20, marginBottom: 24, maxWidth: 240 },
    card: { backgroundColor: c.surface, borderRadius: t.radius.r3, padding: 20, paddingTop: 24 },
    h2: { color: c.ink, fontSize: 26, fontWeight: '600', marginBottom: 4 },
    sub: { color: c.ink3, fontSize: 14, marginBottom: 20 },
    alert: { backgroundColor: c.warnSoft, borderRadius: t.radius.r1, padding: 12, marginBottom: 16 },
    alertText: { color: c.warn, fontWeight: '500' },
    label: { color: c.ink2, fontSize: 13, fontWeight: '600', marginBottom: 6 },
    field: { minHeight: 44, borderWidth: 1, borderColor: c.line2, borderRadius: t.radius.r2, backgroundColor: c.surface, paddingHorizontal: 12, justifyContent: 'center', marginBottom: 16 },
    fieldText: { color: c.ink, fontSize: 16 },
    option: { paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: c.line },
    btn: { minHeight: 48, borderRadius: t.radius.r2, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    btnText: { color: c.accentInk, fontWeight: '600', fontSize: 16 },
    foot: { color: c.ink3, fontSize: 12, textAlign: 'center', marginTop: 16 },
  }));

  async function submit() {
    setError('');
    setPending(true);
    try {
      const session = await login(email, password);
      hydrateSessionIntoState(session);
      navigate(nav?.from || '/mobile/chats', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Unable to sign in.');
    } finally {
      setPending(false);
    }
  }

  const label = DEMO_ACCOUNTS.find((a: any) => a.email === email)?.label;
  return (
    <KeyboardAvoidingView style={s.stage} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.brand}>Hertz</Text>
        <Text style={s.studio}>Studio</Text>
        <Text style={s.tag}>Design, site and studio in one place.</Text>
        <View style={s.card}>
          <Text style={s.h2}>Welcome back</Text>
          <Text style={s.sub}>Sign in to continue to Hertz Studio.</Text>
          {error ? <View style={s.alert} accessibilityRole="alert"><Text style={s.alertText}>{error}</Text></View> : null}

          <Text style={s.label}>Account</Text>
          <Pressable style={s.field} onPress={() => setPicking((v) => !v)}>
            <Text style={s.fieldText}>{label}</Text>
          </Pressable>
          {picking && (
            <View style={{ marginTop: -8, marginBottom: 16, borderWidth: 1, borderColor: '#0002', borderRadius: 8, overflow: 'hidden' }}>
              {DEMO_ACCOUNTS.map((a: any) => (
                <Pressable key={a.personaId} style={s.option} onPress={() => { setEmail(a.email); setPicking(false); }}>
                  <Text style={s.fieldText}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={s.label}>Password</Text>
          <TextInput
            style={[s.field, s.fieldText]} secureTextEntry value={password} onChangeText={setPassword}
            autoCapitalize="none" autoComplete="current-password" onSubmitEditing={submit}
          />
          <Pressable style={[s.btn, pending && { opacity: 0.6 }]} onPress={submit} disabled={pending}>
            {pending ? <ActivityIndicator /> : <Text style={s.btnText}>Sign in</Text>}
          </Pressable>
          <Text style={s.foot}>Prototype login · demo accounts, password "password"</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
