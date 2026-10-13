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
export const Sub = ({ children, past, lines }: { children: React.ReactNode; past?: boolean; lines?: number }) => {
  const s = useStyles((c) => ({ t: { color: past ? c.ink3 : c.ink2, fontSize: 13, lineHeight: 18, marginTop: 1 } }));
  return <Text style={s.t} numberOfLines={lines}>{children}</Text>;
};

export function ActBtn({ label, onPress, to, quiet, tone }: { label: string; onPress?: () => void; to?: string; quiet?: boolean; tone?: 'solid' | 'link' }) {
  const s = useStyles((c) => ({
    btn: { minHeight: 28, justifyContent: 'center', alignItems: 'flex-end' },
    solid: { minHeight: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: c.accent, alignItems: 'center' },
    link: { minHeight: 32, alignItems: 'flex-start' },
    t: { fontSize: 13, fontWeight: '700', color: c.accentText },
    solidT: { color: c.accentInk },
    q: { color: c.ink3, fontWeight: '600' },
    linkT: { color: c.accentText, fontWeight: '650' },
  }));
  const inner = <Text style={[s.t, tone === 'solid' && s.solidT, quiet && s.q, tone === 'link' && s.linkT]}>{label}</Text>;
  const style = [s.btn, tone === 'solid' && s.solid, tone === 'link' && s.link];
  if (to) return <Link to={to} style={style} accessibilityLabel={label}>{inner}</Link>;
  return <Pressable style={style} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>{inner}</Pressable>;
}

// Column of actions at the right edge of a row.
export const Acts = ({ children }: { children: React.ReactNode }) => (
  <View style={{ alignItems: 'flex-end', gap: 2, alignSelf: 'center' }}>{children}</View>
);

function choiceActs(acts?: React.ReactNode) {
  const items = React.Children.toArray((acts as { props?: { children?: React.ReactNode } })?.props?.children).filter((child) => child != null && child !== false);
  const isQuiet = (child: React.ReactNode) => !!(child as { props?: { quiet?: boolean } })?.props?.quiet;
  const tone = (child: React.ReactNode, next: 'solid' | 'link') => (
    React.isValidElement(child) ? React.cloneElement(child as React.ReactElement<{ tone?: string }>, { tone: next }) : child
  );
  return {
    primary: items.filter((child) => !isQuiet(child)).map((child) => tone(child, 'solid')),
    more: items.filter(isQuiet).map((child) => tone(child, 'link')),
  };
}

export function DayRow({ left, acts, to, onPress, past, first, label, choice }: {
  left: React.ReactNode; acts?: React.ReactNode; to?: string; onPress?: () => void; past?: boolean; first?: boolean; label?: string; choice?: boolean;
}) {
  const parts = choice ? choiceActs(acts) : null;
  const s = useStyles((c) => ({
    row: { flexDirection: 'row', alignItems: 'center', columnGap: 12, paddingVertical: 13, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: c.line },
    left: { flex: 1, minWidth: 0 },
    choice: { flex: 1, minWidth: 0 },
    top: { flexDirection: 'row', alignItems: 'center', columnGap: 12 },
    more: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, marginTop: 2 },
  }));
  const body = parts ? (
    <View style={s.choice}>
      <View style={s.top}>
        <View style={s.left}>{left}</View>
        {parts.primary}
      </View>
      {parts.more.length > 0 && <View style={s.more}>{parts.more}</View>}
    </View>
  ) : (<><View style={s.left}>{left}</View>{acts}</>);
  if (to) return <Link to={to} style={s.row} accessibilityLabel={label}>{body}</Link>;
  if (onPress) return <Pressable style={s.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>{body}</Pressable>;
  return <View style={s.row}>{body}</View>;
}

// Wraps a list of rows: the first row has its top line removed when `flush`.
export function Fold({ title, count, open: initial = false, children }: { title: string; count?: number; open?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(initial);
  const s = useStyles((c) => ({
    wrap: { marginTop: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: c.line, borderRadius: 16, backgroundColor: c.surface },
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
