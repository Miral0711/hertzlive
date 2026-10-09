import React, { useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Icon from './Icon';
import { Link } from '../platform/router';
import { useStyles, useTheme } from '../platform/theme';
import { photoSource } from './Photo';

// Small RN equivalents of the prototype's shared utility classes (.row, .filters, .primary, .ghost,
// .empty, .sect, .search, .view-card, .kv, .day-row ...) used by the Library and People screens.

export function Sect({ children }: { children: React.ReactNode }) {
  const s = useStyles((c) => ({ t: { marginTop: 6, marginHorizontal: 16, marginBottom: 4, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: c.ink3 } }));
  return <Text style={s.t}>{children}</Text>;
}

// h2 inside .canvas
export function CanvasH2({ children }: { children: React.ReactNode }) {
  const s = useStyles((c) => ({ t: { marginTop: 16, marginHorizontal: 2, marginBottom: 8, fontSize: 15, letterSpacing: 0.6, textTransform: 'uppercase', color: c.ink3, fontWeight: '600' } }));
  return <Text style={s.t}>{children}</Text>;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  const s = useStyles((c) => ({
    box: { paddingVertical: 32, paddingHorizontal: 20, alignItems: 'center' },
    h: { fontSize: 18, fontWeight: '600', color: c.ink, marginBottom: 6, textAlign: 'center' },
    p: { color: c.ink2, textAlign: 'center', fontSize: 16 },
  }));
  return (
    <View style={s.box}>
      <Text style={s.h}>{title}</Text>
      {children ? <Text style={s.p}>{children}</Text> : null}
    </View>
  );
}

export function Row({ children, to, onPress, picked, label, style }: {
  children: React.ReactNode; to?: string; onPress?: () => void; picked?: boolean; label?: string; style?: any;
}) {
  const s = useStyles((c) => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: picked ? c.accentSoft : undefined },
  }));
  if (to) return <Link to={to} style={[s.row, style]} accessibilityLabel={label}>{children}</Link>;
  if (onPress) return <Pressable style={[s.row, style]} onPress={onPress} accessibilityLabel={label}>{children}</Pressable>;
  return <View style={[s.row, style]}>{children}</View>;
}

export function RowCopy({ title, sub }: { title: React.ReactNode; sub?: React.ReactNode }) {
  const s = useStyles((c) => ({
    copy: { flex: 1, minWidth: 0 },
    b: { fontWeight: '600', fontSize: 16, color: c.ink },
    sub: { color: c.ink2, fontWeight: '500', fontSize: 14 },
  }));
  return (
    <View style={s.copy}>
      <Text style={s.b} numberOfLines={1}>{title}</Text>
      {sub != null ? <Text style={s.sub} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}

export function IconBtn({ name, to, onPress, label }: { name: string; to?: string; onPress?: () => void; label: string }) {
  const { c } = useTheme();
  const st = { minHeight: 44, minWidth: 36, alignItems: 'center' as const, justifyContent: 'center' as const };
  if (to) return <Link to={to} style={st} accessibilityLabel={label}><Icon name={name} color={c.accent} /></Link>;
  return <Pressable style={st} onPress={onPress} accessibilityLabel={label}><Icon name={name} color={c.accent} /></Pressable>;
}

export function Filters({ options, value, onChange }: { options: [string, string][]; value: any; onChange: (v: any) => void }) {
  const s = useStyles((c) => ({
    wrap: { flexGrow: 0 },
    inner: { gap: 8, paddingTop: 4, paddingBottom: 12 },
    chip: { minHeight: 36, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: c.surface, justifyContent: 'center' },
    on: { backgroundColor: c.accent },
    t: { fontWeight: '700', color: c.ink, fontSize: 16 },
    tOn: { color: c.accentInk },
  }));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.wrap} contentContainerStyle={s.inner} keyboardShouldPersistTaps="handled">
      {options.map(([id, label]) => (
        <Pressable key={id} style={[s.chip, value === id && s.on]} onPress={() => onChange(id)} accessibilityState={{ selected: value === id }}>
          <Text style={[s.t, value === id && s.tOn]}>{label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function Primary({ children, onPress, to, disabled }: { children: React.ReactNode; onPress?: () => void; to?: string; disabled?: boolean }) {
  const s = useStyles((c, t) => ({
    btn: { minHeight: 52, marginVertical: 8, borderRadius: t.radius.r2, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : 1 },
    t: { color: c.accentInk, fontWeight: '700', fontSize: 16 },
  }));
  const inner = <Text style={s.t}>{children}</Text>;
  if (to) return <Link to={to} style={s.btn}>{inner}</Link>;
  return <Pressable style={s.btn} onPress={onPress} disabled={disabled} accessibilityRole="button">{inner}</Pressable>;
}

export function Ghost({ children, to, onPress }: { children: React.ReactNode; to?: string; onPress?: () => void }) {
  const s = useStyles((c, t) => ({
    btn: { minHeight: 48, marginVertical: 8, borderRadius: t.radius.r2, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' },
    t: { color: c.ink, fontWeight: '700', fontSize: 16 },
  }));
  const inner = <Text style={s.t}>{children}</Text>;
  if (to) return <Link to={to} style={s.btn}>{inner}</Link>;
  return <Pressable style={s.btn} onPress={onPress} accessibilityRole="button">{inner}</Pressable>;
}

export function TextBtn({ children, onPress, accent }: { children: React.ReactNode; onPress: () => void; accent?: boolean }) {
  const s = useStyles((c) => ({
    btn: { width: '100%', minHeight: 44, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
    t: { fontWeight: '600', fontSize: 16, color: accent ? c.accentText : c.ink2 },
  }));
  return <Pressable style={s.btn} onPress={onPress} accessibilityRole="button"><Text style={s.t}>{children}</Text></Pressable>;
}

export function Lab({ children }: { children: React.ReactNode }) {
  const s = useStyles((c) => ({ t: { marginTop: 8, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: c.ink3 } }));
  return <Text style={s.t}>{children}</Text>;
}

export function WarnText({ children }: { children: React.ReactNode }) {
  const s = useStyles((c) => ({ t: { color: c.crit, fontWeight: '600', fontSize: 16 } }));
  return <Text style={s.t}>{children}</Text>;
}

export function NoteText({ children }: { children: React.ReactNode }) {
  const s = useStyles((c) => ({ t: { color: c.ink2, fontWeight: '500', fontSize: 16 } }));
  return <Text style={s.t}>{children}</Text>;
}

export function ViewCard({ children }: { children: React.ReactNode }) {
  const s = useStyles((c, t) => ({ card: { gap: 4, marginBottom: 10, padding: 14, borderRadius: t.radius.r2, backgroundColor: c.surface } }));
  return <View style={s.card}>{children}</View>;
}

export function CardText({ children, strong, dim }: { children: React.ReactNode; strong?: boolean; dim?: boolean }) {
  const s = useStyles((c) => ({ t: { fontSize: 16, color: dim ? c.ink2 : c.ink, fontWeight: strong ? '600' : '400' } }));
  return <Text style={s.t}>{children}</Text>;
}

export function Kv({ rows }: { rows: [string, string][] }) {
  const s = useStyles((c) => ({
    wrap: { marginVertical: 8, gap: 6 },
    row: { flexDirection: 'row', gap: 10 },
    dt: { width: 88, color: c.ink3, fontSize: 16 },
    dd: { flex: 1, fontWeight: '600', color: c.ink, fontSize: 16 },
  }));
  return (
    <View style={s.wrap}>
      {rows.map(([k, v]) => (
        <View key={k} style={s.row}><Text style={s.dt}>{k}</Text><Text style={s.dd}>{v}</Text></View>
      ))}
    </View>
  );
}

// Labelled single/multi-line input (.stack label + input)
export function Field({ label, value, onChangeText, multiline, placeholder }: {
  label: string; value: string; onChangeText: (v: string) => void; multiline?: boolean; placeholder?: string;
}) {
  const s = useStyles((c, t) => ({
    wrap: { gap: 4 },
    lab: { fontWeight: '600', fontSize: 16, color: c.ink },
    input: { minHeight: multiline ? 44 + 3 * 18 : 44, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: c.line, borderRadius: t.radius.r2, backgroundColor: c.surface, color: c.ink, fontSize: 16, textAlignVertical: multiline ? 'top' : 'center' },
  }));
  return (
    <View style={s.wrap}>
      <Text style={s.lab}>{label}</Text>
      <TextInput
        style={s.input} value={value} onChangeText={onChangeText} multiline={multiline} placeholder={placeholder}
        accessibilityLabel={label}
      />
    </View>
  );
}

// Replacement for <select>: a field that expands into an inline list of options.
export function Select({ label, value, options, onChange }: {
  label: string; value: string; options: [string, string][]; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const s = useStyles((c, t) => ({
    wrap: { gap: 4 },
    lab: { fontWeight: '600', fontSize: 16, color: c.ink },
    box: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: c.line, borderRadius: t.radius.r2, backgroundColor: c.surface },
    val: { color: c.ink, fontSize: 16 },
    list: { borderWidth: 1, borderColor: c.line, borderRadius: t.radius.r2, backgroundColor: c.surface, overflow: 'hidden' },
    opt: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
    optOn: { backgroundColor: c.accentSoft },
  }));
  const cur = options.find(([id]) => id === value);
  return (
    <View style={s.wrap}>
      <Text style={s.lab}>{label}</Text>
      <Pressable style={s.box} onPress={() => setOpen(!open)} accessibilityLabel={label} accessibilityRole="button">
        <Text style={s.val}>{cur ? cur[1] : ''}</Text>
        <Text style={s.val}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open && (
        <View style={s.list}>
          {options.map(([id, text]) => (
            <Pressable key={id} style={[s.opt, id === value && s.optOn]} onPress={() => { onChange(id); setOpen(false); }}>
              <Text style={s.val}>{text}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export function SearchBox({ value, onChangeText, placeholder, label }: { value: string; onChangeText: (v: string) => void; placeholder: string; label?: string }) {
  const s = useStyles((c, t) => ({
    box: { marginVertical: 12, marginHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingHorizontal: 12, borderRadius: t.radius.r2, backgroundColor: c.surface2 },
    input: { flex: 1, minWidth: 0, color: c.ink, fontSize: 16, paddingVertical: 8 },
  }));
  const { c } = useTheme();
  return (
    <View style={s.box}>
      <Icon name="search" color={c.ink3} />
      <TextInput style={s.input} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={c.ink3} accessibilityLabel={label || placeholder} autoCapitalize="none" />
    </View>
  );
}

// .swatch: a photo-pool picture at a fixed height with rounded corners
export function Swatch({ hue, seed, height = 120, radius = 12 }: { hue: any; seed: any; height?: number; radius?: number }) {
  return <Image source={photoSource(hue ?? 28, seed ?? 1)} style={{ width: '100%', height, borderRadius: radius }} resizeMode="cover" />;
}

// .day-row: bordered block with small/bold/span lines
export function DayBlock({ small, title, lines = [], children, onPress, pressed, label }: {
  small?: string; title: string; lines?: string[]; children?: React.ReactNode; onPress?: () => void; pressed?: boolean; label?: string;
}) {
  const s = useStyles((c) => ({
    row: { paddingVertical: 13, borderTopWidth: 1, borderTopColor: c.line },
    small: { color: c.ink3, fontSize: 12, fontWeight: '600' },
    b: { fontSize: 15, fontWeight: '600', color: c.ink, lineHeight: 20 },
    span: { marginTop: 1, color: c.ink2, fontSize: 13, lineHeight: 18 },
  }));
  const body = (
    <>
      {small ? <Text style={s.small}>{small}</Text> : null}
      <Text style={s.b}>{title}</Text>
      {lines.map((l, i) => <Text key={i} style={s.span}>{l}</Text>)}
      {children}
    </>
  );
  if (onPress) return <Pressable style={s.row} onPress={onPress} accessibilityState={{ selected: !!pressed }} accessibilityLabel={label}>{body}</Pressable>;
  return <View style={s.row}>{body}</View>;
}

export function LinkText({ to, children, onPress }: { to?: string; children: React.ReactNode; onPress?: () => void }) {
  const s = useStyles((c) => ({ btn: { minHeight: 32, justifyContent: 'center' }, t: { color: c.accentText, fontSize: 13, fontWeight: '700' } }));
  const inner = <Text style={s.t}>{children}</Text>;
  if (to) return <Link to={to} style={s.btn}>{inner}</Link>;
  return <Pressable style={s.btn} onPress={onPress} accessibilityRole="button">{inner}</Pressable>;
}
