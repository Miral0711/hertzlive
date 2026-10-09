import { AREA_TO_M2, LENGTH_TO_MM, VOLUME_TO_M3, num } from '../../units';
import { looksUnfinished } from '../language';

const LABEL = {
  mm: 'mm', cm: 'cm', m: 'm', km: 'km', in: 'in', ft: 'ft',
  m2: 'm²', sqft: 'sq.ft', cm2: 'cm²', mm2: 'mm²', sqin: 'sq.in', sqyd: 'sq.yd',
  m3: 'm³', cuft: 'cu.ft', litre: 'L', cuin: 'cu.in',
};

const TITLE = { length: 'Length conversion', area: 'Area conversion', volume: 'Volume conversion' };

function lengthFactor(unit) {
  if (unit === 'km') return LENGTH_TO_MM.m * 1000;
  return LENGTH_TO_MM[unit];
}

function digits(family, value) {
  if (family === 'area') return 2;
  if (family === 'volume') return 3;
  return Math.abs(value) < 1 ? 4 : 3;
}

function amount(value, unit, family) {
  return `${num(value, digits(family, value))} ${LABEL[unit] || unit}`;
}

function converted(source, unit) {
  if (source.type === 'length') {
    const factor = lengthFactor(unit);
    if (!factor || source.mm == null) return null;
    return source.mm / factor;
  }
  if (source.type === 'area') {
    const factor = AREA_TO_M2[unit];
    if (!factor || source.m2 == null) return null;
    return source.m2 / factor;
  }
  const factor = VOLUME_TO_M3[unit];
  if (!factor || source.m3 == null) return null;
  return source.m3 / factor;
}

function rate(source, target) {
  if (source.type !== 'length' || source.unit === target) return '';
  const one = lengthFactor(source.unit) / lengthFactor(target);
  if (!Number.isFinite(one)) return '';
  return `1 ${LABEL[source.unit] || source.unit} = ${num(one, 4)} ${LABEL[target] || target}`;
}

function valuesFor(source) {
  if (source.unit === 'km') return { value: String(Number(source.text) * 1000), valueUnit: 'm' };
  return { value: source.text, valueUnit: source.unit };
}

const conversionRule = {
  id: 'units',
  mode: null,
  title: 'Length conversion',
  keywords: [],
  required: [],
  optional: [],
  immediate: true,
  partial: [],
  priority: 8,
  pattern(tokens) {
    if (!tokens.length) return null;
    if (tokens.some((token) => token.type === 'op' || token.type === 'percent' || token.type === 'ratio' || token.type === 'size' || token.type === 'paren')) return null;
    const measures = [];
    const targets = [];
    let links = 0;
    let numbers = 0;
    const rest = [];
    tokens.forEach((token, index) => {
      if (token.type === 'length' || token.type === 'area' || token.type === 'volume') measures.push({ token, index });
      else if (token.type === 'unit') targets.push(token);
      else if (token.type === 'link') links += 1;
      else if (token.type === 'number') numbers += 1;
      else rest.push(token);
    });
    const prefix = rest.length === 1 && rest[0].type === 'word' && looksUnfinished(rest[0].raw);
    if (rest.length && !prefix) return null;
    if (measures.length > 1 || targets.length > 1) return null;
    const used = tokens.map((_, index) => index);
    if (!targets.length) {
      if (measures.length === 1 && (links || prefix)) {
        return { incomplete: true, hint: links && !prefix ? 'Choose a unit…' : '', used };
      }
      if (!measures.length && prefix && numbers) {
        return { incomplete: true, used };
      }
      return null;
    }
    if (measures.length !== 1) return links || prefix ? { incomplete: true, used } : null;
    const source = measures[0].token;
    const target = targets[0];
    if (target.family !== source.type) return null;
    const value = converted(source, target.unit);
    if (value == null) return null;
    const family = source.type;
    const text = amount(value, target.unit, family);
    return {
      values: valuesFor(source),
      mode: family,
      title: TITLE[family],
      lead: String(source.raw).replace(/\s+/g, ' ').trim(),
      note: rate(source, target.unit),
      used,
      outcome: {
        ok: true,
        summary: text,
        lines: [{ label: TITLE[family], value: text }],
      },
    };
  },
};

export default conversionRule;
