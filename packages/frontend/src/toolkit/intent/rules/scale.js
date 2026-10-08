import { lengthFields } from '../bind';

const KNOWN = new Set(['10', '20', '25', '50', '75', '100', '200', '500']);
const WORDS = new Set(['at', 'scale', 'drawing', 'on']);

const scaleRule = {
  id: 'scale',
  mode: null,
  keywords: ['scale', 'drawing'],
  required: ['length', 'scale'],
  optional: ['custom'],
  answer: 'Actual size',
  immediate: true,
  partial: [],
  priority: 10,
  pattern(tokens) {
    const words = tokens.filter((token) => token.type === 'word').map((token) => token.raw.toLowerCase());
    if (words.some((word) => !WORDS.has(word))) return null;
    const lengths = tokens.filter((token) => token.type === 'length');
    const ratio = tokens.find((token) => token.type === 'ratio');
    if (lengths.length !== 1 || !ratio || ratio.parts.length !== 2) return null;
    if (tokens.some((token) => token.type === 'number' || token.type === 'area' || token.type === 'size' || token.type === 'percent')) return null;
    const factor = String(ratio.second);
    return {
      values: {
        scale: KNOWN.has(factor) ? factor : 'custom',
        custom: factor,
        direction: 'toActual',
        ...lengthFields('length', lengths[0]),
      },
      used: tokens.map((_, index) => index),
    };
  },
};

export default scaleRule;
