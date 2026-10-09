import React, { createContext, useContext, useMemo } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { applyAgencyTheme } from '../../../frontend/src/shared/core';
import { useStore } from '../../../frontend/src/shared/store';
import { state } from '../../../frontend/src/mobile/model';
import { themeOverrides } from './polyfill';

// Token values mirror packages/frontend/src/index.css (CSS var --foo-bar -> c.fooBar).
const LIGHT = {
  ground: '#f2f3f5', surface: '#ffffff', 'surface-2': '#eceef1', 'surface-3': '#e1e4e8',
  ink: '#16384d', 'ink-2': '#4f6e82', 'ink-3': '#6f8797', line: '#e3e6ea', 'line-2': '#c8ced6',
  accent: '#16587b', 'accent-ink': '#ffffff', 'accent-soft': '#dce8ee', 'accent-text': '#16587b',
  client: '#16587b', 'client-soft': '#dce8ee', secondary: '#84b3ce', 'secondary-soft': '#e3eef4',
  warn: '#8f6a24', 'warn-soft': '#f6ecd3', crit: '#a84f42', 'crit-soft': '#f6e2dd',
  ok: '#46775f', 'ok-soft': '#e1ede6', mine: '#dce8ee', chat: '#f2f3f5',
  sel: '#16587b', 'sel-ink': '#ffffff', 'on-accent': '#ffffff',
};
const DARK = {
  ground: '#0c1e29', surface: '#132e3d', 'surface-2': '#19394a', 'surface-3': '#21475a',
  ink: '#f5eedd', 'ink-2': '#cfd8da', 'ink-3': '#9fb3bf', line: '#21475a', 'line-2': '#365f75',
  accent: '#84b3ce', 'accent-ink': '#0f2431', 'accent-soft': '#1d4157', 'accent-text': '#a5c9dd',
  client: '#a5c9dd', 'client-soft': '#1d4157', secondary: '#84b3ce', 'secondary-soft': '#1d4157',
  warn: '#e3bd73', 'warn-soft': '#3a2f16', crit: '#e39a8d', 'crit-soft': '#3d2420',
  ok: '#9cc8b0', 'ok-soft': '#1f3a2d', mine: '#1c4257', chat: '#0c1e29',
  sel: '#a5c9dd', 'sel-ink': '#0f2431', 'on-accent': '#0f2431',
};

const camel = (k: string) => k.replace(/-(\w)/g, (_, ch) => ch.toUpperCase());

export type Colors = Record<
  | 'ground' | 'surface' | 'surface2' | 'surface3' | 'ink' | 'ink2' | 'ink3' | 'line' | 'line2'
  | 'accent' | 'accentInk' | 'accentSoft' | 'accentText' | 'client' | 'clientSoft'
  | 'secondary' | 'secondarySoft' | 'warn' | 'warnSoft' | 'crit' | 'critSoft' | 'ok' | 'okSoft'
  | 'mine' | 'chat' | 'sel' | 'selInk' | 'onAccent',
  string
>;

export const radius = { r1: 6, r2: 8, r3: 14 };
export const headerH = 56;

type Theme = { c: Colors; dark: boolean; radius: typeof radius; headerH: number };
const ThemeContext = createContext<Theme>(null as unknown as Theme);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const version = useStore(); // re-theme whenever the store re-renders (Appearance / agency accent)
  const system = useColorScheme();
  const mode = state.theme === 'system' || !state.theme ? system : state.theme;
  const dark = mode === 'dark';
  const value = useMemo<Theme>(() => {
    applyAgencyTheme(); // writes agency accent/ground into themeOverrides
    const merged = { ...(dark ? DARK : LIGHT), ...themeOverrides } as Record<string, string>;
    const c = Object.fromEntries(Object.entries(merged).map(([k, v]) => [camel(k), v])) as Colors;
    return { c, dark, radius, headerH };
  }, [dark, version]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

// const s = useStyles((c, t) => ({ row: { backgroundColor: c.surface } }));
// Loosely typed on purpose: style objects are authored inline and RN validates them at runtime.
export function useStyles(factory: (c: Colors, t: Theme) => Record<string, any>): Record<string, any> {
  const t = useTheme();
  return useMemo(() => StyleSheet.create(factory(t.c, t)), [t]); // eslint-disable-line react-hooks/exhaustive-deps
}
