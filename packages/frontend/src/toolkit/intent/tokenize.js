// Splits a phrase into measurements, words, and arithmetic marks. No calculator names.

import { parseAreaToM2, parseLengthToMm, parseVolumeToM3 } from '../units';
import { readNamedUnit } from './language';

const LENGTH_WORDS = [
  ['millimetres', 'mm'], ['millimeters', 'mm'], ['mm', 'mm'],
  ['centimetres', 'cm'], ['centimeters', 'cm'], ['cm', 'cm'],
  ['inches', 'in'], ['inch', 'in'], ['in', 'in'],
  ['kilometres', 'km'], ['kilometers', 'km'], ['kilometre', 'km'], ['kilometer', 'km'], ['km', 'km'],
  ['feet', 'ft'], ['foot', 'ft'], ['ft', 'ft'],
  ['metres', 'm'], ['meters', 'm'], ['m', 'm'],
].sort((a, b) => b[0].length - a[0].length);

function lengthToken(raw, text, unit) {
  const mm = unit === 'km' ? parseLengthToMm(text, 'm') * 1000 : parseLengthToMm(text, unit);
  return {
    type: 'length',
    raw,
    text,
    unit,
    mm: Number.isFinite(mm) ? mm : null,
  };
}

function takeArch(slice) {
  const quoted = slice.match(/^(\d+(?:\.\d+)?)\s*'\s*(?:-\s*)?(\d+(?:\.\d+)?)?(?:\s+(\d+\s*\/\s*\d+))?\s*"/);
  if (quoted && (quoted[2] != null || quoted[3] != null)) return lengthToken(quoted[0], quoted[0], 'ft');
  // 12'-6 is the same length as 12'-6" when the inch mark is left off.
  const bare = slice.match(/^(\d+(?:\.\d+)?)\s*'\s*-\s*(\d+(?:\.\d+)?)(?:\s+(\d+\s*\/\s*\d+))?/);
  if (!bare || /[0-9]/.test(slice[bare[0].length] || '')) return null;
  return lengthToken(bare[0], bare[0], 'ft');
}

function takeQuotedFeet(slice) {
  const m = slice.match(/^(\d+(?:\.\d+)?)\s*'/);
  if (!m) return null;
  return lengthToken(m[0], m[0], 'ft');
}

function takeQuotedInches(slice) {
  const m = slice.match(/^(\d+(?:\.\d+)?)\s*"/);
  if (!m) return null;
  return lengthToken(m[0], m[1], 'in');
}

function takeLengthWord(slice) {
  const m = slice.match(/^(\d+(?:\.\d+)?)(\s*)([a-zμ².]+)/i);
  if (!m) return null;
  const word = m[3].toLowerCase();
  const hit = LENGTH_WORDS.find(([name]) => name === word);
  if (!hit) return null;
  return lengthToken(m[0], m[1], hit[1]);
}

function takeArea(slice) {
  const m = slice.match(/^(\d+(?:\.\d+)?)\s*(square\s+feet|square\s+foot|square\s+metres|square\s+meters|square\s+metre|square\s+meter|sq\.?\s*ft\.?|sqft|sq\.?\s*m\.?|sqm|m²|m2|ft²|ft2)/i);
  if (!m) return null;
  const unit = /ft/i.test(m[2]) ? 'sqft' : 'm2';
  const m2 = parseAreaToM2(m[1], unit);
  return { type: 'area', raw: m[0], text: m[1], unit, m2: Number.isFinite(m2) ? m2 : null };
}

function takeVolume(slice) {
  const m = slice.match(/^(\d+(?:\.\d+)?)\s*(cubic\s+feet|cubic\s+foot|cubic\s+metres|cubic\s+meters|cubic\s+metre|cubic\s+meter|cu\.?\s*ft\.?|cuft|cu\.?\s*m\.?|m³|m3|ft³|ft3|litres|liters|litre|liter)/i);
  if (!m) return null;
  const word = m[2].toLowerCase();
  let unit = 'm3';
  if (/ft/.test(word)) unit = 'cuft';
  else if (/lit/.test(word)) unit = 'litre';
  const m3 = parseVolumeToM3(m[1], unit);
  return { type: 'volume', raw: m[0], text: m[1], unit, m3: Number.isFinite(m3) ? m3 : null };
}

function takeSize(slice) {
  const m = slice.match(/^(\d+(?:\.\d+)?)[xX](\d+(?:\.\d+)?)/);
  if (!m) return null;
  return { type: 'size', raw: m[0], width: Number(m[1]), height: Number(m[2]), unit: 'mm' };
}

function takeParen(slice) {
  if (slice[0] !== '(' && slice[0] !== ')') return null;
  return { type: 'paren', raw: slice[0], side: slice[0] };
}

function takeRatio(slice) {
  const m = slice.match(/^(\d+(?:\.\d+)?)(?::(\d+(?:\.\d+)?))(?::(\d+(?:\.\d+)?))?/);
  if (!m) return null;
  const parts = [m[1], m[2], m[3]].filter((p) => p != null).map(Number);
  return { type: 'ratio', raw: m[0], parts, first: parts[0], second: parts[1] };
}

function takePercent(slice) {
  const m = slice.match(/^(\d+(?:\.\d+)?)\s*%/);
  if (!m) return null;
  return { type: 'percent', raw: m[0], value: Number(m[1]) };
}

function takeLink(slice) {
  if (slice[0] !== '=') return null;
  return { type: 'link', raw: '=' };
}

function takeOp(slice) {
  const ch = slice[0];
  const next = slice[1] || '';
  if ((ch === 'x' || ch === 'X') && !/[a-z]/i.test(next)) return { type: 'op', raw: ch, op: 'times' };
  if (ch === '×' || ch === '*') return { type: 'op', raw: ch, op: 'mul' };
  if (ch === '/') return { type: 'op', raw: ch, op: 'div' };
  if (ch === '+' || ch === '-') return { type: 'op', raw: ch, op: ch };
  return null;
}

function takeNumber(slice) {
  const m = slice.match(/^\d+(?:\.\d+)?/);
  if (!m) return null;
  return { type: 'number', raw: m[0], value: Number(m[0]) };
}

function takeWord(slice) {
  const m = slice.match(/^[a-z][a-z-]*/i);
  if (!m) return null;
  return { type: 'word', raw: m[0] };
}

const TAKERS = [takeArch, takeArea, takeVolume, takeQuotedInches, takeQuotedFeet, takeLengthWord, takeSize, takeRatio, takePercent, takeParen, takeOp, takeLink, takeNumber, readNamedUnit, takeWord];

/** @returns {Array<object>} tokens in source order. Each keeps `raw` plus a normalized reading. */
export function tokenize(input) {
  const src = String(input ?? '')
    .replace(/[′’]/g, "'")
    .replace(/[″”]/g, '"')
    .replace(/[–—−]/g, '-');
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/[\s,;]/.test(ch)) {
      i += 1;
      continue;
    }
    const slice = src.slice(i);
    const token = TAKERS.map((take) => take(slice)).find(Boolean);
    if (!token) {
      i += 1;
      continue;
    }
    tokens.push(token);
    i += token.raw.length;
  }
  return tokens;
}
