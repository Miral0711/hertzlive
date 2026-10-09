// Turns form strings into numbers. Stays free of React so mobile can share it.

import { parseAreaToM2, parseLengthToMm, parseMassToKg, parseVolumeToM3 } from './units';

function matches(cond, values) {
  if (!cond) return true;
  if (cond.all) return cond.all.every((c) => matches(c, values));
  if (cond.any) return cond.any.some((c) => matches(c, values));
  const cur = values?.[cond.key];
  if (cond.in) return cond.in.includes(cur);
  return cur === cond.value;
}

export function isVisible(field, values) {
  return matches(field.when, values);
}

export function emptyItem(fields) {
  const item = {};
  fields.forEach((f) => {
    if (f.type === 'length' || f.type === 'area' || f.type === 'volume' || f.type === 'mass') {
      item[f.key] = f.default ?? '';
      item[`${f.key}Unit`] = f.unit || defaultUnit(f.type);
    } else if (f.type === 'select') item[f.key] = f.default ?? f.options[0][0];
    else item[f.key] = f.default ?? '';
  });
  return item;
}

export function initialValues(fields) {
  const values = {};
  fields.forEach((f) => {
    if (f.type === 'repeat') {
      const n = f.seed ?? 1;
      values[f.key] = Array.from({ length: n }, () => emptyItem(f.fields));
    } else if (f.type === 'length' || f.type === 'area' || f.type === 'volume' || f.type === 'mass') {
      values[f.key] = f.default ?? '';
      values[`${f.key}Unit`] = f.unit || defaultUnit(f.type);
    } else if (f.type === 'select') values[f.key] = f.default ?? f.options[0][0];
    else values[f.key] = f.default ?? '';
  });
  return values;
}

function readScalar(field, values) {
  const raw = values?.[field.key];
  if (field.type === 'length') return parseLengthToMm(raw, values?.[`${field.key}Unit`] || field.unit || 'mm');
  if (field.type === 'area') return parseAreaToM2(raw, values?.[`${field.key}Unit`] || field.unit || 'm2');
  if (field.type === 'volume') return parseVolumeToM3(raw, values?.[`${field.key}Unit`] || field.unit || 'm3');
  if (field.type === 'mass') return parseMassToKg(raw, values?.[`${field.key}Unit`] || field.unit || 'kg');
  if (field.type === 'number') {
    if (raw === '' || raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  }
  return raw ?? '';
}

/** @returns {{ values: object, errors: string[] }} */
export function normalize(fields, values) {
  const out = {};
  const errors = [];
  fields.filter((f) => isVisible(f, values)).forEach((f) => {
    if (f.type === 'repeat') {
      out[f.key] = (values?.[f.key] || []).map((item) => {
        const row = normalize(f.fields, item);
        row.errors.forEach((label) => errors.push(label));
        return row.values;
      });
      return;
    }
    const parsed = readScalar(f, values);
    out[f.key] = parsed;
    const typed = String(values?.[f.key] ?? '').trim();
    if (typed && (fieldMeasures(f) || f.type === 'number') && (parsed == null || !Number.isFinite(parsed))) {
      errors.push(f.label);
    }
  });
  return { values: out, errors };
}

function fieldMeasures(f) {
  return f.type === 'length' || f.type === 'area' || f.type === 'volume' || f.type === 'mass';
}

function defaultUnit(type) {
  if (type === 'area') return 'm2';
  if (type === 'volume') return 'm3';
  if (type === 'mass') return 'kg';
  return 'm';
}
