import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Link, openExternal } from '../platform/router';
import { useStyles } from '../platform/theme';

// Small building blocks for the Projects / ProjectPages screens (mobile.css `.proj` rules).

export function H2({ children, style }: { children: React.ReactNode; style?: any }) {
  const s = useStyles((c) => ({ h2: { marginTop: 18, marginBottom: 2, fontSize: 13, fontWeight: '600', color: c.ink3 } }));
  return <Text style={[s.h2, style]} accessibilityRole="header">{children}</Text>;
}

export function Sect({ children }: { children: React.ReactNode }) {
  const s = useStyles((c) => ({ t: { marginTop: 16, marginBottom: 4, fontSize: 13, fontWeight: '700', color: c.ink3 } }));
  return <Text style={s.t}>{children}</Text>;
}

export function SectionHead({ title, to, label }: { title: string; to?: string; label?: string }) {
  const s = useStyles((c) => ({
    head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
    more: { fontSize: 13, fontWeight: '700', color: c.accentText },
  }));
  return (
    <View style={s.head}>
      <H2>{title}</H2>
      {to ? <Link to={to}><Text style={s.more}>{label}</Text></Link> : null}
    </View>
  );
}

export function Hint({ children }: { children: React.ReactNode }) {
  const s = useStyles((c) => ({ t: { marginTop: 8, fontSize: 13, color: c.ink3 } }));
  return <Text style={s.t}>{children}</Text>;
}

export function Empty({ title, text }: { title: string; text?: string }) {
  const s = useStyles((c) => ({
    box: { paddingVertical: 32, paddingHorizontal: 20, alignItems: 'center' },
    h: { fontSize: 17, fontWeight: '600', color: c.ink, textAlign: 'center' },
    p: { marginTop: 6, color: c.ink3, textAlign: 'center' },
  }));
  return <View style={s.box}><Text style={s.h}>{title}</Text>{text ? <Text style={s.p}>{text}</Text> : null}</View>;
}

// Text styles used inside rows: <B> title, <Sub> detail, <Small> kicker.
export function B({ children, style }: { children: React.ReactNode; style?: any }) {
  const s = useStyles((c) => ({ t: { fontSize: 15, fontWeight: '600', lineHeight: 20, color: c.ink } }));
  return <Text style={[s.t, style]}>{children}</Text>;
}
export function Sub({ children, style }: { children: React.ReactNode; style?: any }) {
  const s = useStyles((c) => ({ t: { marginTop: 1, fontSize: 13, lineHeight: 18, color: c.ink2 } }));
  return <Text style={[s.t, style]}>{children}</Text>;
}
export function Small({ children }: { children: React.ReactNode }) {
  const s = useStyles((c) => ({ t: { fontSize: 12, fontWeight: '600', color: c.ink3 } }));
  return <Text style={s.t}>{children}</Text>;
}

// `.day-row`: divider-topped text row. Optional link (in-app `to` or external `href`).
export function DayRow({ to, href, first, children, right }: {
  to?: string; href?: string; first?: boolean; children: React.ReactNode; right?: React.ReactNode;
}) {
  const s = useStyles((c) => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderTopWidth: first ? 0 : 1, borderTopColor: c.line },
    copy: { flex: 1, minWidth: 0 },
  }));
  const inner = <><View style={s.copy}>{children}</View>{right}</>;
  if (to) return <Link to={to} style={s.row}>{inner}</Link>;
  if (href) return <Pressable style={s.row} accessibilityRole="link" onPress={() => openExternal(href)}>{inner}</Pressable>;
  return <View style={s.row}>{inner}</View>;
}

// Small accent text button (`.day-acts button`, `.mat-acts button`, `.text-btn` inside rows).
export function ActBtn({ label, onPress, quiet, accessibilityLabel }: { label: string; onPress: () => void; quiet?: boolean; accessibilityLabel?: string }) {
  const s = useStyles((c) => ({
    btn: { minHeight: 32, justifyContent: 'center' },
    t: { fontSize: 13, fontWeight: quiet ? '600' : '700', color: quiet ? c.ink3 : c.accentText },
  }));
  return <Pressable style={s.btn} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel || label}><Text style={s.t}>{label}</Text></Pressable>;
}

// `.row` inside `.proj`: 64px min, bottom hairline, no horizontal padding.
export function Row({ to, children, left, right }: { to?: string; children: React.ReactNode; left?: React.ReactNode; right?: React.ReactNode }) {
  const s = useStyles((c) => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.line },
    copy: { flex: 1, minWidth: 0 },
  }));
  const inner = <>{left}<View style={s.copy}>{children}</View>{right}</>;
  return to ? <Link to={to} style={s.row}>{inner}</Link> : <View style={s.row}>{inner}</View>;
}
export function RowTitle({ children, done }: { children: React.ReactNode; done?: boolean }) {
  const s = useStyles((c) => ({ t: { fontSize: 16, fontWeight: '600', color: c.ink } }));
  return <Text style={[s.t, done ? { textDecorationLine: 'line-through' } : null]}>{children}</Text>;
}
export function RowSub({ children }: { children: React.ReactNode }) {
  const s = useStyles((c) => ({ t: { fontSize: 14, fontWeight: '500', color: c.ink2 } }));
  return <Text style={s.t} numberOfLines={1}>{children}</Text>;
}

// `.view-card` inside `.proj`: flat, top divider.
export function ViewCard({ children, first }: { children: React.ReactNode; first?: boolean }) {
  const s = useStyles((c) => ({ card: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.line, gap: 4 } }));
  return <View style={s.card}>{children}</View>;
}

export function StatusEm({ children, ok }: { children: React.ReactNode; ok?: boolean }) {
  const s = useStyles((c) => ({ t: { fontSize: 13, color: ok ? c.ok : c.ink2, fontWeight: ok ? '700' : '400' } }));
  return <Text style={s.t}>{children}</Text>;
}

export function Chip({ children }: { children: React.ReactNode }) {
  const s = useStyles((c) => ({ t: { fontSize: 13, fontWeight: '700', color: c.ink2 } }));
  return <Text style={s.t}>{children}</Text>;
}

export function ActRow({ children }: { children: React.ReactNode }) {
  const s = useStyles(() => ({ r: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 8 } }));
  return <View style={s.r}>{children}</View>;
}

export function WarnText({ children }: { children: React.ReactNode }) {
  const s = useStyles((c) => ({ t: { color: c.crit, fontWeight: '600', marginTop: 8 } }));
  return <Text style={s.t}>{children}</Text>;
}

export function LabeledInput({ label, value, onChangeText, placeholder, a11y }: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; a11y?: string;
}) {
  const s = useStyles((c, t) => ({
    wrap: { gap: 4 },
    label: { fontWeight: '600', color: c.ink },
    input: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: c.line, borderRadius: t.radius.r2, backgroundColor: c.surface, color: c.ink, fontSize: 16 },
  }));
  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>
      <TextInput style={s.input} value={value} onChangeText={onChangeText} placeholder={placeholder} autoCapitalize="none" accessibilityLabel={a11y || label} />
    </View>
  );
}

// `.proj .primary`: text-style link row with a top divider.
export function PrimaryRow({ to, onPress, children }: { to?: string; onPress?: () => void; children: React.ReactNode }) {
  const s = useStyles((c) => ({
    row: { marginVertical: 4, paddingVertical: 13, borderTopWidth: 1, borderTopColor: c.line },
    t: { color: c.accentText, fontWeight: '700', fontSize: 16 },
  }));
  if (to) return <Link to={to} style={s.row}><Text style={s.t}>{children}</Text></Link>;
  return <Pressable style={s.row} onPress={onPress} accessibilityRole="button"><Text style={s.t}>{children}</Text></Pressable>;
}

// Filled button (`.primary` outside `.proj`, used by submit buttons in forms).
export function SubmitBtn({ label, onPress }: { label: string; onPress: () => void }) {
  const s = useStyles((c, t) => ({
    btn: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: t.radius.r2, backgroundColor: c.accent },
    t: { color: c.accentInk, fontWeight: '700', fontSize: 16 },
  }));
  return <Pressable style={s.btn} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}><Text style={s.t}>{label}</Text></Pressable>;
}
