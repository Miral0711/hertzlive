/**
 * @jest-environment node
 */
// Guards the language feature: every phrase the screens pass to t() needs a Hindi and a
// Gujarati translation, and a translation must keep the same {0} {1} slots as the English.
const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const { ROWS } = require('./i18n/translations');

const FRONTEND_SRC = path.resolve(__dirname, '..');
const MOBILE_SRC = path.resolve(__dirname, '../../../mobile/src');

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return walk(full);
  return /\.(jsx?|tsx?)$/.test(entry.name) && !/\.test\.[jt]sx?$/.test(entry.name) ? [full] : [];
});

// The string literals a t() argument can resolve to, including both sides of a ternary or ||.
const literals = (node) => {
  if (!node) return [];
  if (node.type === 'StringLiteral') return [node.value];
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return [node.quasis[0].value.cooked];
  if (node.type === 'ConditionalExpression') return [...literals(node.consequent), ...literals(node.alternate)];
  if (node.type === 'LogicalExpression') return [...literals(node.left), ...literals(node.right)];
  if (node.type === 'ParenthesizedExpression') return literals(node.expression);
  return [];
};

const visit = (node, found) => {
  if (!node || typeof node.type !== 'string') return;
  if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 't') {
    literals(node.arguments[0]).forEach((key) => found.add(key));
  }
  Object.keys(node).forEach((name) => {
    if (name === 'loc' || name === 'start' || name === 'end') return;
    const child = node[name];
    if (Array.isArray(child)) child.forEach((c) => visit(c, found));
    else if (child && typeof child.type === 'string') visit(child, found);
  });
};

const usedKeys = () => {
  const found = new Set();
  [...walk(FRONTEND_SRC), ...walk(MOBILE_SRC)].forEach((file) => {
    const code = fs.readFileSync(file, 'utf8');
    if (!/\bt\(/.test(code)) return;
    const ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'], errorRecovery: true });
    visit(ast.program, found);
  });
  return found;
};

const slots = (text) => (text.match(/\{\d+\}/g) || []).sort().join(',');

describe('translation table', () => {
  test('no phrase is listed twice and every row has a Hindi and a Gujarati text', () => {
    const seen = new Set();
    ROWS.forEach((row) => {
      expect(row).toHaveLength(3);
      expect(row.every((text) => typeof text === 'string' && text.trim() !== '')).toBe(true);
      expect(seen.has(row[0])).toBe(false);
      seen.add(row[0]);
    });
  });

  test('translations keep the slots of the English phrase', () => {
    const broken = ROWS.filter((row) => slots(row[1]) !== slots(row[0]) || slots(row[2]) !== slots(row[0])).map((row) => row[0]);
    expect(broken).toEqual([]);
  });

  test('every t() phrase in the website and the app has a translation', () => {
    const known = new Set(ROWS.map((row) => row[0]));
    const { KEYS } = require('./i18n');
    const missing = [...usedKeys()].filter((key) => key !== '' && !known.has(key) && !(key in KEYS));
    expect(missing).toEqual([]);
  });

  // Screens show these through t(e.message), so each one needs a row even though no t('...') names it.
  test('every error message thrown by core.js has a translation', () => {
    const known = new Set(ROWS.map((row) => row[0]));
    const found = new Set();
    const walkNode = (node) => {
      if (!node || typeof node.type !== 'string') return;
      if (node.type === 'NewExpression' && node.callee.name === 'Error' && node.arguments[0]?.type === 'StringLiteral') {
        found.add(node.arguments[0].value);
      }
      Object.keys(node).forEach((name) => {
        if (name === 'loc') return;
        const child = node[name];
        if (Array.isArray(child)) child.forEach(walkNode);
        else if (child && typeof child.type === 'string') walkNode(child);
      });
    };
    walkNode(parse(fs.readFileSync(path.join(__dirname, 'core.js'), 'utf8'), { sourceType: 'module' }).program);
    expect(found.size).toBeGreaterThan(0);
    expect([...found].filter((message) => !known.has(message))).toEqual([]);
  });

  // The side menu passes these through t(label), so t('literal') scanning cannot see them.
  test('every side menu label has a translation', () => {
    const known = new Set(ROWS.map((row) => row[0]));
    const { NAV, NAV_GROUPS } = require('../desktop/helpers');
    const labels = [...NAV.map(([, label]) => label), ...NAV_GROUPS.map(([label]) => label)];
    expect(labels.filter((label) => label !== 'Resources' && !known.has(label))).toEqual([]);
  });

  test('the short legacy keys point at translated phrases', () => {
    const known = new Set(ROWS.map((row) => row[0]));
    const { KEYS } = require('./i18n');
    const missing = Object.values(KEYS).filter((phrase) => !known.has(phrase));
    expect(missing).toEqual([]);
  });
});

describe('t()', () => {
  const store = {};
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    globalThis.localStorage = {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    };
    delete globalThis.sessionStorage;
  });
  afterAll(() => { delete globalThis.localStorage; });

  const { t, setLang, getLang } = require('./i18n');

  test('English is the default and returns the phrase as written', () => {
    expect(getLang()).toBe('English');
    expect(t('Send')).toBe('Send');
    expect(t('Back to {0}', 'Chats')).toBe('Back to Chats');
  });

  test('Hindi and Gujarati use the table, fill slots and persist the choice', () => {
    setLang('हिन्दी');
    expect(store['field-lang']).toBe('हिन्दी');
    expect(t('Send')).toBe('भेजें');
    expect(t('Back to {0}', 'चैट')).toBe('चैट पर वापस');
    expect(t('{0}% of {1}%', 30, 50)).toBe('50% में से 30%');
    setLang('ગુજરાતી');
    expect(t('Send')).toBe('મોકલો');
  });

  test('short legacy keys resolve to the phrase', () => {
    setLang('हिन्दी');
    expect(t('chats')).toBe('चैट');
  });

  test('unknown phrases fall back to English, and non-strings and inherited names are left alone', () => {
    setLang('हिन्दी');
    expect(t('A phrase nobody translated {0}', 'x')).toBe('A phrase nobody translated x');
    expect(t(42)).toBe(42);
    expect(t('constructor')).toBe('constructor');
    expect(t('toString')).toBe('toString');
  });

  test('an unknown language is ignored', () => {
    setLang('Klingon');
    expect(getLang()).toBe('English');
  });
});
