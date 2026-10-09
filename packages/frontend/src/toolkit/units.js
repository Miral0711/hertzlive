// Length, area, volume, and weight conversions. No DOM or storage — safe to reuse from mobile.

export const MM_PER_IN = 25.4;
export const LENGTH_TO_MM = { mm: 1, cm: 10, m: 1000, in: MM_PER_IN, ft: 304.8 };
export const AREA_TO_M2 = {
  m2: 1,
  cm2: 1e-4,
  mm2: 1e-6,
  sqft: 0.09290304,
  sqin: 0.00064516,
  sqyd: 0.83612736,
};
export const VOLUME_TO_M3 = {
  m3: 1,
  litre: 0.001,
  cuft: 0.028316846592,
  cuin: 1.6387064e-5,
};
export const MASS_TO_KG = { kg: 1, g: 0.001, lb: 0.45359237, tonne: 1000 };

export const LENGTH_UNIT_OPTIONS = [['mm', 'mm'], ['cm', 'cm'], ['m', 'm'], ['in', 'in'], ['ft', 'ft']];
export const AREA_UNIT_OPTIONS = [['m2', 'm²'], ['sqft', 'sq.ft'], ['cm2', 'cm²'], ['sqin', 'sq.in']];
export const VOLUME_UNIT_OPTIONS = [['m3', 'm³'], ['litre', 'litre'], ['cuft', 'cu.ft']];
export const MASS_UNIT_OPTIONS = [['kg', 'kg'], ['g', 'g'], ['lb', 'lb'], ['tonne', 'tonne']];

const LENGTH_SUFFIXES = [
  ['millimetres', 'mm'], ['millimeters', 'mm'], ['mm', 'mm'],
  ['centimetres', 'cm'], ['centimeters', 'cm'], ['cm', 'cm'],
  ['metres', 'm'], ['meters', 'm'], ['m', 'm'],
  ['inches', 'in'], ['inch', 'in'], ['in', 'in'],
  ['feet', 'ft'], ['foot', 'ft'], ['ft', 'ft'],
];
const AREA_SUFFIXES = [
  ['sq. ft', 'sqft'], ['sq ft', 'sqft'], ['sq.ft', 'sqft'], ['sqft', 'sqft'], ['ft²', 'sqft'], ['ft2', 'sqft'],
  ['sq. m', 'm2'], ['sq m', 'm2'], ['sq.m', 'm2'], ['sqm', 'm2'], ['m²', 'm2'], ['m2', 'm2'],
  ['sq. in', 'sqin'], ['sq in', 'sqin'], ['sq.in', 'sqin'], ['sqin', 'sqin'],
  ['cm²', 'cm2'], ['cm2', 'cm2'], ['mm²', 'mm2'], ['mm2', 'mm2'],
];
const VOLUME_SUFFIXES = [
  ['cu. ft', 'cuft'], ['cu ft', 'cuft'], ['cu.ft', 'cuft'], ['cuft', 'cuft'], ['ft³', 'cuft'], ['ft3', 'cuft'],
  ['cu. m', 'm3'], ['cu m', 'm3'], ['cu.m', 'm3'], ['cum', 'm3'], ['m³', 'm3'], ['m3', 'm3'],
  ['litres', 'litre'], ['liters', 'litre'], ['litre', 'litre'], ['liter', 'litre'], ['l', 'litre'],
];

export function num(n, digits = 3) {
  if (!Number.isFinite(n)) return '—';
  const f = 10 ** digits;
  const v = Math.round((n + Number.EPSILON) * f) / f;
  return String(v);
}

export function gcd(a, b) {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const t = y;
    y = x % t;
    x = t;
  }
  return x || 1;
}

export function decimalToFraction(value, maxDen = 16) {
  if (!Number.isFinite(value)) return null;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const whole = Math.floor(abs + 1e-9);
  const frac = abs - whole;
  if (frac < 1 / (maxDen * 2)) {
    return { whole: sign * whole, num: 0, den: 1, text: String(sign * whole) };
  }
  let best = { num: 0, den: 1, err: frac };
  for (let den = 1; den <= maxDen; den += 1) {
    const n = Math.round(frac * den);
    const err = Math.abs(frac - n / den);
    if (err < best.err - 1e-12) best = { num: n, den, err };
  }
  let { num: n, den } = best;
  if (n === den) {
    const w = sign * (whole + 1);
    return { whole: w, num: 0, den: 1, text: String(w) };
  }
  const g = gcd(n, den);
  n /= g;
  den /= g;
  if (n === 0) return { whole: sign * whole, num: 0, den: 1, text: String(sign * whole) };
  const head = whole ? `${whole} ${n}/${den}` : `${n}/${den}`;
  return { whole: sign * whole, num: n, den, text: sign < 0 ? `-${head}` : head };
}

function formatInches(inches) {
  const whole = Math.floor(inches + 1e-9);
  const sixteenths = Math.round((inches - whole) * 16);
  if (sixteenths <= 0) return whole ? String(whole) : '0';
  if (sixteenths >= 16) return String(whole + 1);
  const g = gcd(sixteenths, 16);
  const frac = `${sixteenths / g}/${16 / g}`;
  return whole ? `${whole} ${frac}` : frac;
}

/** Architectural feet and inches, snapped to the nearest 1/16" when that is within 1 mm. */
export function formatArch(mm) {
  if (!Number.isFinite(mm)) return '—';
  const sign = mm < 0 ? '-' : '';
  const totalIn = Math.abs(mm) / MM_PER_IN;
  let feet = Math.floor(totalIn / 12 + 1e-9);
  const inches = totalIn - feet * 12;
  const snapped = Math.round(inches * 16) / 16;
  const errMm = Math.abs((snapped - inches) * MM_PER_IN);
  let inchText;
  if (errMm <= 1) {
    let s = snapped;
    if (s >= 12 - 1e-9) {
      feet += 1;
      s = 0;
    }
    inchText = formatInches(s);
  } else {
    inchText = num(inches, 2);
  }
  if (!inchText || inchText === '0') return feet ? `${sign}${feet}'` : `${sign}0"`;
  if (!feet) return `${sign}${inchText}"`;
  return `${sign}${feet}'-${inchText}"`;
}

export function lenText(mm) {
  if (!Number.isFinite(mm)) return '—';
  const metric = Math.abs(mm) >= 1000 ? `${num(mm / 1000, 3)} m` : `${num(mm, 1)} mm`;
  return `${formatArch(mm)} · ${metric}`;
}

export function areaText(m2) {
  if (!Number.isFinite(m2)) return '—';
  return `${num(m2, 3)} m² · ${num(m2 / AREA_TO_M2.sqft, 2)} sq.ft`;
}

export function volText(m3) {
  if (!Number.isFinite(m3)) return '—';
  return `${num(m3, 3)} m³ · ${num(m3 / VOLUME_TO_M3.cuft, 2)} cu.ft`;
}

function parseArchitecturalInches(raw) {
  const t = String(raw).trim().toLowerCase()
    .replace(/[′’]/g, "'")
    .replace(/[″”]/g, '"')
    .replace(/[–—−]/g, '-');
  if (!/['"]/.test(t)) return null;
  let feet = 0;
  let rest = t;
  const fm = t.match(/^(-?\d+(?:\.\d+)?)\s*'/);
  if (fm) {
    feet = Number(fm[1]);
    rest = t.slice(fm[0].length);
  }
  rest = rest.replace(/^\s*-?\s*/, '').replace(/"+$/, '').trim();
  if (!rest) return feet * 12;
  const m = rest.match(/^(\d+(?:\.\d+)?)?(?:\s*-?\s*)?(\d+\s*\/\s*\d+)?$/);
  if (!m || (!m[1] && !m[2])) return null;
  let inches = m[1] ? Number(m[1]) : 0;
  if (m[2]) {
    const [a, b] = m[2].split('/').map((p) => Number(p.trim()));
    if (!b) return null;
    inches += a / b;
  }
  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null;
  return feet * 12 + inches;
}

function parseSuffixed(raw, table, factors) {
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
  const sorted = [...table].sort((a, b) => b[0].length - a[0].length);
  for (const [suffix, unit] of sorted) {
    if (!s.endsWith(suffix)) continue;
    const n = s.slice(0, -suffix.length).trim();
    if (!/^-?\d+(\.\d+)?$/.test(n)) continue;
    return Number(n) * factors[unit];
  }
  return null;
}

/** @returns {number|null|typeof NaN} millimetres, null when empty, NaN when the text cannot be read. */
export function parseLengthToMm(raw, unit = 'mm') {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const feetIn = s.match(/^(-?\d+(?:\.\d+)?)\s*(?:ft|feet)\s+(\d+(?:\.\d+)?)\s*(?:in|inch|inches)$/i);
  if (feetIn) return (Number(feetIn[1]) * 12 + Number(feetIn[2])) * MM_PER_IN;
  if (/['"′″’]/.test(s)) {
    const inches = parseArchitecturalInches(s);
    return inches == null ? NaN : inches * MM_PER_IN;
  }
  const suffixed = parseSuffixed(s, LENGTH_SUFFIXES, LENGTH_TO_MM);
  if (suffixed != null) return suffixed;
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  const factor = LENGTH_TO_MM[unit];
  if (!factor) return NaN;
  return Number(s) * factor;
}

export function parseAreaToM2(raw, unit = 'm2') {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const suffixed = parseSuffixed(s, AREA_SUFFIXES, AREA_TO_M2);
  if (suffixed != null) return suffixed;
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  const factor = AREA_TO_M2[unit];
  if (!factor) return NaN;
  return Number(s) * factor;
}

export function parseVolumeToM3(raw, unit = 'm3') {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const suffixed = parseSuffixed(s, VOLUME_SUFFIXES, VOLUME_TO_M3);
  if (suffixed != null) return suffixed;
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  const factor = VOLUME_TO_M3[unit];
  if (!factor) return NaN;
  return Number(s) * factor;
}

export function parseMassToKg(raw, unit = 'kg') {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const table = [['tonnes', 'tonne'], ['tonne', 'tonne'], ['kg', 'kg'], ['lb', 'lb'], ['g', 'g']];
  const suffixed = parseSuffixed(s, table, MASS_TO_KG);
  if (suffixed != null) return suffixed;
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  const factor = MASS_TO_KG[unit];
  if (!factor) return NaN;
  return Number(s) * factor;
}

export function parseFraction(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const mixed = s.match(/^(-?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const den = Number(mixed[4]);
    if (!den) return NaN;
    const v = Number(mixed[2]) + Number(mixed[3]) / den;
    return mixed[1] ? -v : v;
  }
  const frac = s.match(/^(-?)(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const den = Number(frac[3]);
    if (!den) return NaN;
    const v = Number(frac[2]) / den;
    return frac[1] ? -v : v;
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}
