// Spoken architecture, turned into the tokens the rules already understand.

import { AREA_TO_M2, LENGTH_TO_MM, VOLUME_TO_M3, parseAreaToM2, parseLengthToMm, parseVolumeToM3 } from '../units';

// Longest name first. "in" stays a word: it is the preposition in "7 inch in feet".
const UNIT_NAMES = [
  ['square feet', 'area', 'sqft'],
  ['square foot', 'area', 'sqft'],
  ['square metres', 'area', 'm2'],
  ['square meters', 'area', 'm2'],
  ['square metre', 'area', 'm2'],
  ['square meter', 'area', 'm2'],
  ['cubic feet', 'volume', 'cuft'],
  ['cubic foot', 'volume', 'cuft'],
  ['cubic metres', 'volume', 'm3'],
  ['cubic meters', 'volume', 'm3'],
  ['cubic metre', 'volume', 'm3'],
  ['cubic meter', 'volume', 'm3'],
  ['millimetres', 'length', 'mm'],
  ['millimeters', 'length', 'mm'],
  ['millimetre', 'length', 'mm'],
  ['millimeter', 'length', 'mm'],
  ['centimetres', 'length', 'cm'],
  ['centimeters', 'length', 'cm'],
  ['centimetre', 'length', 'cm'],
  ['centimeter', 'length', 'cm'],
  ['kilometres', 'length', 'km'],
  ['kilometers', 'length', 'km'],
  ['kilometre', 'length', 'km'],
  ['kilometer', 'length', 'km'],
  ['inches', 'length', 'in'],
  ['inch', 'length', 'in'],
  ['metres', 'length', 'm'],
  ['meters', 'length', 'm'],
  ['metre', 'length', 'm'],
  ['meter', 'length', 'm'],
  ['feet', 'length', 'ft'],
  ['foot', 'length', 'ft'],
  ['sq. ft', 'area', 'sqft'],
  ['sq ft', 'area', 'sqft'],
  ['sq.ft', 'area', 'sqft'],
  ['sqft', 'area', 'sqft'],
  ['ft²', 'area', 'sqft'],
  ['ft2', 'area', 'sqft'],
  ['sq. m', 'area', 'm2'],
  ['sq m', 'area', 'm2'],
  ['sq.m', 'area', 'm2'],
  ['sqm', 'area', 'm2'],
  ['m²', 'area', 'm2'],
  ['m2', 'area', 'm2'],
  ['cm²', 'area', 'cm2'],
  ['cm2', 'area', 'cm2'],
  ['mm²', 'area', 'mm2'],
  ['mm2', 'area', 'mm2'],
  ['sq. in', 'area', 'sqin'],
  ['sq in', 'area', 'sqin'],
  ['sq.in', 'area', 'sqin'],
  ['sqin', 'area', 'sqin'],
  ['cu. ft', 'volume', 'cuft'],
  ['cu ft', 'volume', 'cuft'],
  ['cu.ft', 'volume', 'cuft'],
  ['cuft', 'volume', 'cuft'],
  ['ft³', 'volume', 'cuft'],
  ['ft3', 'volume', 'cuft'],
  ['cu. m', 'volume', 'm3'],
  ['cu m', 'volume', 'm3'],
  ['cu.m', 'volume', 'm3'],
  ['m³', 'volume', 'm3'],
  ['m3', 'volume', 'm3'],
  ['litres', 'volume', 'litre'],
  ['liters', 'volume', 'litre'],
  ['litre', 'volume', 'litre'],
  ['liter', 'volume', 'litre'],
  ['mm', 'length', 'mm'],
  ['cm', 'length', 'cm'],
  ['km', 'length', 'km'],
  ['ft', 'length', 'ft'],
  ['m', 'length', 'm'],
].sort((a, b) => b[0].length - a[0].length);

const LINKS = ['to', 'into', 'in', 'equals', 'equal'];
const FILLER = new Set([
  'convert', 'conversion', 'how', 'many', 'much', 'what', 'is', 'are',
  'a', 'an', 'the', 'please', 'calculate', 'calculation', 'using',
]);

function boundary(slice, name) {
  const next = slice[name.length] || '';
  return !/[a-z0-9]/i.test(next);
}

/** A unit name with no number in front of it: the "m" in "600 ft to m". */
export function readNamedUnit(slice) {
  const lower = slice.toLowerCase();
  const hit = UNIT_NAMES.find(([name]) => lower.startsWith(name) && boundary(slice, name));
  if (!hit) return null;
  return {
    type: 'unit',
    raw: slice.slice(0, hit[0].length),
    family: hit[1],
    unit: hit[2],
  };
}

export function looksUnfinished(word) {
  const text = String(word || '').toLowerCase();
  if (!text) return false;
  const names = UNIT_NAMES.map(([name]) => name).concat(LINKS);
  return names.some((name) => name.startsWith(text) && name !== text);
}

function quantity(number, unit) {
  const raw = `${number.raw} ${unit.raw}`;
  if (unit.family === 'length') {
    const mm = unit.unit === 'km'
      ? Number(number.raw) * LENGTH_TO_MM.m * 1000
      : parseLengthToMm(number.raw, unit.unit);
    return { type: 'length', raw, text: number.raw, unit: unit.unit, mm: Number.isFinite(mm) ? mm : null };
  }
  if (unit.family === 'area') {
    const m2 = Number.isFinite(AREA_TO_M2[unit.unit]) ? parseAreaToM2(number.raw, unit.unit) : NaN;
    return { type: 'area', raw, text: number.raw, unit: unit.unit, m2: Number.isFinite(m2) ? m2 : null };
  }
  const m3 = Number.isFinite(VOLUME_TO_M3[unit.unit]) ? parseVolumeToM3(number.raw, unit.unit) : NaN;
  return { type: 'volume', raw, text: number.raw, unit: unit.unit, m3: Number.isFinite(m3) ? m3 : null };
}

/** Drops chatter, and turns "by" / "to" / "feet" into the marks rules match on. */
export function normalizeTokens(tokens) {
  const mapped = [];
  tokens.forEach((token) => {
    if (token.type !== 'word') {
      mapped.push(token);
      return;
    }
    const word = token.raw.toLowerCase();
    if (FILLER.has(word)) return;
    if (word === 'by' || word === 'times') {
      mapped.push({ type: 'op', raw: token.raw, op: 'times' });
      return;
    }
    if (LINKS.includes(word)) {
      mapped.push({ type: 'link', raw: token.raw });
      return;
    }
    const named = readNamedUnit(token.raw);
    if (named && named.raw.length === token.raw.length) {
      mapped.push(named);
      return;
    }
    mapped.push(token);
  });
  const folded = [];
  for (let index = 0; index < mapped.length; index += 1) {
    const token = mapped[index];
    const next = mapped[index + 1];
    if (token.type === 'number' && next?.type === 'unit') {
      folded.push(quantity(token, next));
      index += 1;
    } else folded.push(token);
  }
  return folded;
}
