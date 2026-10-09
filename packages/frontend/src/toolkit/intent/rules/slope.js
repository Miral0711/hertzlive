import { lengthFields } from '../bind';

const WORDS = new Set(['rise', 'over', 'run']);

const slopeRule = {
  id: 'slope',
  mode: 'rise-run',
  keywords: ['slope', 'gradient', 'rise', 'run'],
  required: ['rise', 'run'],
  optional: [],
  answer: ['Slope', 'Gradient (slope ratio)'],
  immediate: true,
  partial: [],
  priority: 10,
  pattern(tokens) {
    const words = tokens.filter((token) => token.type === 'word').map((token) => token.raw.toLowerCase());
    if (!words.includes('rise') || !words.includes('over')) return null;
    if (words.some((word) => !WORDS.has(word))) return null;
    const lengths = tokens.filter((token) => token.type === 'length' || token.type === 'number');
    if (lengths.length !== 2) return null;
    if (tokens.some((token) => token.type === 'area' || token.type === 'size' || token.type === 'percent' || token.type === 'ratio')) return null;
    return {
      values: { ...lengthFields('rise', lengths[0]), ...lengthFields('run', lengths[1]) },
      used: tokens.map((_, index) => index),
    };
  },
};

export default slopeRule;
