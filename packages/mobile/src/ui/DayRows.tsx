import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from '../platform/router';
import { useStyles, useTheme } from '../platform/theme';

// RN equivalents of the prototype's .day-row / .day-acts / .today-fold / .note building blocks.

export const Small = ({ children }: { children: React.ReactNode }) => {
  const s = useStyles((c) => ({ t: { color: c.ink3, fontSize: 12, fontWeight: '600' } }));
  return <Text style={s.t}>{children}</Text>;
};
export const Strong = ({ children, past, accent, size = 15 }: { children: React.ReactNode; past?: boolean; accent?: boolean; size?: number }) => {
  const s = useStyles((c) => ({ t: { color: c.ink, fontSize: 15, fontWeight: '600', lineHeight: 20 } }));
  const { c } = useTheme();
  return <Text style={[s.t, { fontSize: size }, past && { color: c.ink3 }, accent && { color: c.accentText }]}>{children}</Text>;
};
export const Sub = ({ children, past }: { children: React.ReactNode; past?: boolean }) => {
  const s = useStyles((c) => ({ t: { color: past ? c.ink3 : c.ink2, fontSize: 13, lineHeight: 18, marginTop: 1 } }));
  return <Text style={s.t}>{children}</Text>;
};

export function ActBtn({ label, onPress, to, quiet }: { label: string; onPress?: () => void; to?: string; quiet?: boolean }) {
  const s = useStyles((c) => ({
    btn: { minHeight: 28, justifyContent: 'center', alignItems: 'flex-end' },
    t: { fontSize: 13, fontWeight: '700', color: c.accentText },
    q: { color: c.ink3, fontWeight: '600' },
  }));
  const inner = <Text style={[s.t, quiet && s.q]}>{label}</Text>;
  if (to) return <Link to={to} style={s.btn} accessibilityLabel={label}>{inner}</Link>;
  return <Pressable style={s.btn} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>{inner}</Pressable>;
}

// Column of actions at the right edge of a row.
export const Acts = ({ children }: { children: React.ReactNode }) => (
  <View style={{ alignItems: 'flex-end', gap: 2, alignSelf: 'center' }}>{children}</View>
);

export function DayRow({ left, acts, to, onPress, past, first, label }: {
  left: React.ReactNode; acts?: React.ReactNode; to?: string; onPress?: () => void; past?: boolean; first?: boolean; label?: string;
}) {
  const s = useStyles((c) => ({
    row: { flexDirection: 'row', alignItems: 'center', columnGap: 12, paddingVertical: 13, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: c.line },
    left: { flex: 1, minWidth: 0 },
  }));
  const body = (<><View style={s.left}>{left}</View>{acts}</>);
  if (to) return <Link to={to} style={s.row} accessibilityLabel={label}>{body}</Link>;
  if (onPress) return <Pressable style={s.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>{body}</Pressable>;
  return <View style={s.row}>{body}</View>;
}

// Wraps a list of rows: the first row has its top line removed when `flush`.
export function Fold({ title, count, open: initial = false, children }: { title: string; count?: number; open?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(initial);
  const s = useStyles((c) => ({
    wrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
    sum: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { flex: 1, color: c.ink, fontSize: 15, fontWeight: '600' },
    count: { color: c.ink3, fontSize: 13, fontWeight: '600' },
    chev: { width: 7, height: 7, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderColor: c.ink3, transform: [{ rotate: open ? '45deg' : '-45deg' }] },
  }));
  return (
    <View style={s.wrap}>
      <Pressable style={s.sum} onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={title}>
        <Text style={s.title}>{title}</Text>
        {count != null && <Text style={s.count}>{count}</Text>}
        <View style={s.chev} />
      </Pressable>
      {open && children}
    </View>
  );
}
