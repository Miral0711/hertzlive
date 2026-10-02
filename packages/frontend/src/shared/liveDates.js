// Live dates. The sample data was written around one fixed day (SEED_TODAY). To make the app run on the real current
// date, every date in that sample data is moved forward by the same number of days, so "today's meetings", "overdue
// invoices" and "due next week" keep the same meaning relative to today. Real calendar facts (public holidays) are not moved.
export const SEED_TODAY = '2026-09-09';

const pad = (n) => String(n).padStart(2, '0');
const utc = (iso) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const localISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (iso, n) => {
  const d = new Date(utc(iso) + n * 864e5);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
export const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 864e5);

export const TODAY_LIVE = localISO();

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ISO_DAY = /^(\d{4}-\d{2}-\d{2})(T[\d:.]+Z?)?$/;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;
// "Thu 11 Sep", "12 Sep", "25 Aug" inside text
const TEXT_DATE = /(?:\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s)?\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(t?)\b/g;
const SKIP = new Set(['HOLIDAYS', 'ORG_HOLIDAYS']);
const seen = new WeakSet();

function shiftText(s, days) {
  return s.replace(TEXT_DATE, (all, wd, d, mon, t) => {
    const iso = `${SEED_TODAY.slice(0, 4)}-${pad(MON.indexOf(mon) + 1)}-${pad(+d)}`;
    const n = addDays(iso, days);
    const [, m, day] = n.split('-').map(Number);
    const dt = new Date(utc(n));
    const month = MON[m - 1] + (MON[m - 1] === 'Sep' && t ? 't' : '');
    return `${wd ? `${WEEK[dt.getUTCDay()]} ` : ''}${day} ${month}`;
  });
}
export function shiftValue(v, days, months) {
  if (typeof v !== 'string') return v;
  const iso = v.match(ISO_DAY);
  if (iso) return addDays(iso[1], days) + (iso[2] || '');
  const mo = v.match(ISO_MONTH);
  if (mo) { const t = Number(mo[1]) * 12 + Number(mo[2]) - 1 + months; return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`; }
  return TEXT_DATE.test(v) ? shiftText(v, days) : v;
}
// Moves every date inside obj (arrays and plain objects, in place) forward by `days`.
export function shiftDates(obj, days, months = 0, key = '') {
  if (!days || !obj || typeof obj !== 'object' || SKIP.has(key)) return obj;
  if (!Array.isArray(obj)) { if (seen.has(obj)) return obj; seen.add(obj); }
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === 'string') obj[k] = shiftValue(v, days, months);
    else if (v && typeof v === 'object') shiftDates(v, days, months, k);
  }
  // "Weekly · Tue" follows the weekday of the (moved) booking date.
  if (!Array.isArray(obj) && typeof obj.recurring === 'string' && /^Weekly · /.test(obj.recurring) && typeof obj.date === 'string') {
    obj.recurring = `Weekly · ${WEEK[new Date(utc(obj.date)).getUTCDay()]}`;
  }
  return obj;
}
export const monthDelta = (fromISO, toISO) => (Number(toISO.slice(0, 4)) * 12 + Number(toISO.slice(5, 7))) - (Number(fromISO.slice(0, 4)) * 12 + Number(fromISO.slice(5, 7)));
// Used when the seed data is first loaded: shift an object of named exports.
export function shiftSeedExports(mod) {
  const days = daysBetween(SEED_TODAY, TODAY_LIVE);
  const months = monthDelta(SEED_TODAY, TODAY_LIVE);
  for (const [name, val] of Object.entries(mod)) if (val && typeof val === 'object') shiftDates(val, days, months, name);
}
