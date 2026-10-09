// A tiny path-based router so the phone prototype's screens (written against react-router paths
// like /mobile/chats/:threadId) port 1:1. It keeps a history stack and renders only the top screen.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BackHandler, Linking, Platform, Pressable, StyleProp, ViewStyle } from 'react-native';

export type Location = { pathname: string; search: string; hash: string; state?: any };
export type Route = { path: string; component: React.ComponentType };

const parse = (to: string, state?: any): Location => {
  const [rest, hash = ''] = to.split('#');
  const [pathname, search = ''] = rest.split('?');
  return { pathname, search: search ? `?${search}` : '', hash: hash ? `#${hash}` : '', state };
};

function match(pattern: string, pathname: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean);
  const b = pathname.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

type NavOpts = { replace?: boolean; state?: any };
type Entry = { key: number; loc: Location };
type Ctx = { stack: Entry[]; navigate: (to: string | number, o?: NavOpts) => void; routes: Route[] };

const RouterContext = createContext<Ctx>(null as unknown as Ctx);
const ScreenContext = createContext<{ loc: Location; params: Record<string, string>; key: number }>(
  null as unknown as { loc: Location; params: Record<string, string>; key: number },
);
let keySeq = 1;

export function Router({ routes, initial, notFound, gate, layout }: {
  routes: Route[];
  initial: string;
  notFound?: React.ComponentType;
  // Return a path to redirect to (e.g. login), or null to allow the screen.
  gate?: (pathname: string) => string | null;
  // Wraps the active screen (e.g. to add the tab bar on some paths).
  layout?: (loc: Location, screen: React.ReactNode) => React.ReactNode;
}) {
  const [stack, setStack] = useState<Entry[]>([{ key: keySeq++, loc: parse(initial) }]);

  const navigate = useCallback((to: string | number, o: NavOpts = {}) => {
    setStack((s) => {
      if (typeof to === 'number') return to < 0 && s.length > 1 ? s.slice(0, Math.max(1, s.length + to)) : s;
      const entry = { key: keySeq++, loc: parse(to, o.state) };
      return o.replace ? [...s.slice(0, -1), entry] : [...s, entry];
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) { navigate(-1); return true; }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, navigate]);

  const top = stack[stack.length - 1];
  const redirect = gate?.(top.loc.pathname) ?? null;
  useEffect(() => { if (redirect) navigate(redirect, { replace: true }); }, [redirect, navigate]);

  const ctx = useMemo(() => ({ stack, navigate, routes }), [stack, navigate, routes]);
  let params: Record<string, string> | null = null;
  let Screen: React.ComponentType | undefined;
  if (!redirect) {
    for (const r of routes) {
      params = match(r.path, top.loc.pathname);
      if (params) { Screen = r.component; break; }
    }
    if (!Screen) { Screen = notFound; params = {}; }
  }
  return (
    <RouterContext.Provider value={ctx}>
      {Screen && params ? (
        <ScreenContext.Provider key={top.key} value={{ loc: top.loc, params, key: top.key }}>
          {layout ? layout(top.loc, <Screen />) : <Screen />}
        </ScreenContext.Provider>
      ) : null}
    </RouterContext.Provider>
  );
}

export const useNavigate = () => useContext(RouterContext).navigate;
export const useLocation = () => useContext(ScreenContext).loc;
export const useParams = () => useContext(ScreenContext).params;
export const useCanGoBack = () => useContext(RouterContext).stack.length > 1;

export class SearchParams {
  private m = new Map<string, string>();
  constructor(search: string) {
    search.replace(/^\?/, '').split('&').filter(Boolean).forEach((kv) => {
      const [k, v = ''] = kv.split('=');
      this.m.set(decodeURIComponent(k), decodeURIComponent(v.replace(/\+/g, ' ')));
    });
  }
  get = (k: string) => this.m.get(k) ?? null;
  has = (k: string) => this.m.has(k);
  toString = () => [...this.m].map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

export function useSearchParams(): [SearchParams, (next: Record<string, string> | string) => void] {
  const { search, pathname, hash } = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new SearchParams(search), [search]);
  const set = (next: Record<string, string> | string) => {
    const qs = typeof next === 'string' ? next : new URLSearchParamsLike(next).toString();
    navigate(`${pathname}${qs ? `?${qs}` : ''}${hash}`, { replace: true });
  };
  return [params, set];
}
class URLSearchParamsLike {
  constructor(private o: Record<string, string>) {}
  toString() { return Object.entries(this.o).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&'); }
}

export function Navigate({ to, replace = false, state }: { to: string; replace?: boolean; state?: any }) {
  const navigate = useNavigate();
  useEffect(() => { navigate(to, { replace, state }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function Link({ to, replace, state, style, children, onPress, ...rest }: {
  to: string; replace?: boolean; state?: any; style?: StyleProp<ViewStyle>;
  children?: React.ReactNode; onPress?: () => void; accessibilityLabel?: string; testID?: string;
  disabled?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <Pressable
      accessibilityRole="link"
      style={style}
      onPress={() => { onPress?.(); navigate(to, { replace, state }); }}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

// Replacement for <a href="tel:..."> / mailto: / https: links.
export const openExternal = (url: string) => Linking.openURL(url).catch(() => {});
