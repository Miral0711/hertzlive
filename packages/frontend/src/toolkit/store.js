// Toolkit history, favourites, and recent calculators. Kept out of the app database on purpose.

const KEY = 'herts.toolkit.v1';

let memory = null;
const listeners = new Set();

function blank() {
  return { saved: [], recent: [], recentCalcs: [], favorites: [], counts: {} };
}

function read() {
  if (memory) return memory;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null') || blank();
    memory = {
      saved: Array.isArray(parsed.saved) ? parsed.saved : [],
      recent: Array.isArray(parsed.recent) ? parsed.recent : [],
      recentCalcs: Array.isArray(parsed.recentCalcs) ? parsed.recentCalcs : [],
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      counts: parsed.counts && typeof parsed.counts === 'object' ? parsed.counts : {},
    };
  } catch {
    memory = blank();
  }
  return memory;
}

function commit(next) {
  memory = next;
  let ok = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    ok = false;
  }
  listeners.forEach((l) => l());
  return ok;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot() {
  return read();
}

function uid() {
  return `tk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function rememberCalculation(entry) {
  const cur = read();
  const now = new Date().toISOString();
  const row = {
    id: entry.id || uid(),
    phrase: entry.phrase || '',
    calculatorId: entry.calculatorId,
    mode: entry.mode || null,
    inputs: entry.inputs || {},
    result: {
      lines: entry.result?.lines || [],
      summary: entry.result?.summary || '',
      note: entry.result?.note || '',
    },
    assumption: entry.assumption || '',
    at: now,
  };
  const recentCalcs = [row, ...cur.recentCalcs.filter((item) => item.phrase !== row.phrase)].slice(0, 8);
  return commit({ ...cur, recentCalcs }) ? row : null;
}

export function touchRecent(id) {
  const cur = read();
  return commit({
    ...cur,
    recent: [id, ...cur.recent.filter((x) => x !== id)].slice(0, 8),
    counts: { ...cur.counts, [id]: (cur.counts[id] || 0) + 1 },
  });
}

export function toggleFavorite(id) {
  const cur = read();
  const favorites = cur.favorites.includes(id)
    ? cur.favorites.filter((x) => x !== id)
    : [...cur.favorites, id];
  return commit({ ...cur, favorites });
}

export function saveCalculation(entry) {
  const cur = read();
  const now = new Date().toISOString();
  const existing = entry.id ? cur.saved.find((s) => s.id === entry.id) : null;
  const row = {
    id: existing?.id || entry.id || uid(),
    calculatorId: entry.calculatorId,
    mode: entry.mode || null,
    name: entry.name || '',
    phrase: entry.phrase || existing?.phrase || '',
    inputs: entry.inputs,
    result: {
      lines: entry.result?.lines || [],
      summary: entry.result?.summary || '',
      note: entry.result?.note || '',
    },
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  const saved = existing
    ? cur.saved.map((s) => (s.id === row.id ? row : s))
    : [row, ...cur.saved];
  return commit({ ...cur, saved }) ? row : null;
}

export function renameCalculation(id, name) {
  const cur = read();
  return commit({
    ...cur,
    saved: cur.saved.map((s) => (s.id === id ? { ...s, name, updatedAt: new Date().toISOString() } : s)),
  });
}

export function deleteCalculation(id) {
  const cur = read();
  return commit({ ...cur, saved: cur.saved.filter((s) => s.id !== id) });
}

export function duplicateCalculation(id) {
  const cur = read();
  const src = cur.saved.find((s) => s.id === id);
  if (!src) return null;
  const copy = {
    ...JSON.parse(JSON.stringify(src)),
    id: uid(),
    name: src.name ? `Copy of ${src.name}` : 'Copy',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return commit({ ...cur, saved: [copy, ...cur.saved] }) ? copy : null;
}
