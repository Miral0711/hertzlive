import { LENGTH_TO_MM, formatArch, num } from '../../units';

const UNIT_LABEL = { mm: 'mm', cm: 'cm', m: 'm', in: 'in', ft: 'ft' };

const METRIC = new Set(['mm', 'cm', 'm', 'km']);

function sumText(lengths, mm) {
  const quoted = lengths.some((token) => /['"]/.test(token.raw));
  const unit = lengths[0].unit;
  const same = lengths.every((token) => token.unit === unit);
  if (!quoted && same && UNIT_LABEL[unit]) return `${num(mm / LENGTH_TO_MM[unit], 3)} ${UNIT_LABEL[unit]}`;
  if (!quoted && lengths.every((token) => METRIC.has(token.unit))) return `${num(mm / LENGTH_TO_MM.m, 3)} m`;
  return formatArch(mm);
}

const lengthRule = {
  id: 'units',
  mode: 'length',
  title: 'Unit converter',
  partialLabel: 'Length',
  keywords: ['unit', 'units', 'convert', 'converter', 'length', 'feet', 'inches'],
  required: ['value'],
  optional: [],
  answer: 'Sum',
  immediate: true,
  partial: ['length'],
  priority: 10,
  seed(tokens) {
    const length = tokens.find((token) => token.type === 'length');
    if (!length) return null;
    return { value: length.text, valueUnit: length.unit };
  },
  pattern(tokens) {
    if (tokens.length < 3 || tokens.length % 2 === 0) return null;
    const lengths = [];
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (index % 2 === 0) {
        if (token.type !== 'length' || token.mm == null) return null;
        lengths.push(token);
      } else if (token.type !== 'op' || token.op !== '+') return null;
    }
    const mm = Math.round(lengths.reduce((sum, token) => sum + token.mm, 0) * 1000) / 1000;
    const text = sumText(lengths, mm);
    return {
      values: { value: String(mm), valueUnit: 'mm' },
      used: tokens.map((_, index) => index),
      outcome: {
        ok: true,
        summary: text,
        lines: [
          { label: 'Sum', value: text },
          { label: 'Millimetres', value: `${num(mm, 1)} mm` },
        ],
      },
    };
  },
};

export default lengthRule;
