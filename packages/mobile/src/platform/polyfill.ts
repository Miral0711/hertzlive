// The web prototype's store (packages/frontend/src/shared/core.js) assumes a browser: synchronous
// localStorage/sessionStorage, a `document` whose root style carries the theme tokens, matchMedia.
// This shim provides just enough of that for React Native. Import it before anything from the
// shared store, and await hydrate() before requiring the store (it reads localStorage on import).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

const PREFIX = 'ls:';

function makeStorage(persistent: boolean) {
  const mem = new Map<string, string>();
  return {
    mem,
    getItem: (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
    setItem: (k: string, v: unknown) => {
      mem.set(k, String(v));
      if (persistent) AsyncStorage.setItem(PREFIX + k, String(v)).catch(() => {});
    },
    removeItem: (k: string) => {
      mem.delete(k);
      if (persistent) AsyncStorage.removeItem(PREFIX + k).catch(() => {});
    },
    clear: () => {
      const keys = [...mem.keys()];
      mem.clear();
      if (persistent) AsyncStorage.multiRemove(keys.map((k) => PREFIX + k)).catch(() => {});
    },
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size;
    },
  };
}

const local = makeStorage(true);
const session = makeStorage(false);

// Theme token overrides written by applyAgencyTheme() via document.documentElement.style.
export const themeOverrides: Record<string, string> = {};

const g = globalThis as any;
// On native these globals don't exist, so provide them. In the Expo web preview the browser's own
// exist; there we only record the theme tokens the store writes so the RN theme can read them.
if (typeof g.localStorage === 'undefined') g.localStorage = local;
if (typeof g.sessionStorage === 'undefined') g.sessionStorage = session;
if (typeof g.window === "undefined") g.window = g;
if (typeof g.document === 'undefined') {
  g.document = {
    documentElement: {
      dataset: {} as Record<string, string>,
      style: {
        setProperty: (k: string, v: string) => { themeOverrides[k.replace(/^--/, '')] = v; },
        removeProperty: (k: string) => { delete themeOverrides[k.replace(/^--/, '')]; },
      },
    },
  };
  g.getComputedStyle = () => ({ getPropertyValue: () => '' });
} else {
  const style = g.document.documentElement.style;
  const set = style.setProperty.bind(style);
  const remove = style.removeProperty.bind(style);
  style.setProperty = (k: string, v: string, ...r: any[]) => { themeOverrides[k.replace(/^--/, '')] = v; return set(k, v, ...r); };
  style.removeProperty = (k: string) => { delete themeOverrides[k.replace(/^--/, '')]; return remove(k); };
}
if (typeof g.matchMedia === 'undefined') {
  g.matchMedia = (q: string) => ({
    matches: /dark/.test(q) && Appearance.getColorScheme() === 'dark',
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  });
}

export async function hydrate() {
  if (g.localStorage !== local) return;
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
    const pairs = await AsyncStorage.multiGet(keys);
    for (const [k, v] of pairs) if (v != null) local.mem.set(k.slice(PREFIX.length), v);
  } catch {
    // Start from seed data if storage is unavailable.
  }
}
