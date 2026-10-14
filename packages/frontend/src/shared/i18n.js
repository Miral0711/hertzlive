/* global globalThis */
// One translation engine for the web prototype, the website chat and the Expo app.
//
//   t('Send')                     -> 'भेजें' (Hindi), 'મોકલો' (Gujarati), 'Send' (English)
//   t('Sent to {0}', name)        -> slots are positional so a translation can reorder the words
//
// The English phrase is the key, so a phrase with no translation simply shows in English. Menus, tabs,
// buttons and messages only: people's messages, names and project names are never translated.
import { useEffect, useState } from 'react';
import { HI } from './i18n/hi';
import { GU } from './i18n/gu';

export const LANGS = ['English', 'हिन्दी', 'ગુજરાતી'];
const PACKS = { 'हिन्दी': HI, 'ગુજરાતી': GU };
const KEY = 'field-lang';

// Older call sites pass a short key (t('chats')). It maps to the English phrase, which is what the packs hold.
export const KEYS = {
  chats: 'Chats',
  today: 'Today',
  projects: 'Projects',
  updates: 'Updates',
  message: 'Message',
  send: 'Send',
  photo: 'Photo',
  camera: 'Camera',
  voice: 'Voice note',
  drawing: 'Drawing',
  delivery: 'Delivery',
  sample: 'Sample',
  more: 'More',
  yes: 'Yes',
  ok: 'OK',
  onMyWay: 'On my way',
  clientGroup: 'Client group',
  group: 'Group',
  office: 'Office',
  siteTeam: 'Site team',
  chat: 'Chat',
  sendSitePhoto: 'Send a site photo',
  todayWord: 'Today',
  yesterday: 'Yesterday',
  officeOnly: 'Office only. The client never sees this.',
  people: 'people',
};

const stored = (where) => {
  try { return globalThis[where]?.getItem(KEY) || null; } catch { return null; }
};

// The language lives in localStorage so the phone prototype, the website and the app all follow it.
// An older choice kept in sessionStorage is still honoured.
export function getLang() {
  const lang = stored('localStorage') || stored('sessionStorage');
  return LANGS.includes(lang) ? lang : 'English';
}

const listeners = new Set();
const announce = () => listeners.forEach((fn) => fn(getLang()));

export function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  try {
    globalThis.localStorage.setItem(KEY, lang);
    globalThis.sessionStorage?.removeItem(KEY);
  } catch { /* storage unavailable: the choice lasts until the next reload */ }
  announce();
}

// The website and the phone prototype can be open in two tabs. A change in one reaches the other.
if (typeof globalThis.addEventListener === 'function') {
  globalThis.addEventListener('storage', (e) => { if (e.key === KEY) announce(); });
}

// Re-renders the caller when the language changes. Use the result as a React key to rebuild a whole screen.
export function useLang() {
  const [lang, setLangState] = useState(getLang);
  useEffect(() => {
    listeners.add(setLangState);
    setLangState(getLang());
    return () => { listeners.delete(setLangState); };
  }, []);
  return lang;
}

const own = (map, key) => (map && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined);

export function t(key, ...args) {
  if (typeof key !== 'string') return key;
  const english = own(KEYS, key) || key;
  const text = own(PACKS[getLang()], english) || english;
  return args.length ? text.replace(/\{(\d+)\}/g, (_, i) => (args[i] == null ? '' : String(args[i]))) : text;
}
