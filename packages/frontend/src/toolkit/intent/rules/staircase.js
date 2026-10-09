import { lengthFields } from '../bind';

const HINT = new Set(['floor', 'height', 'riser', 'stair', 'staircase', 'with', 'a', 'preferred']);
const TRIGGER = new Set(['riser', 'stair', 'staircase', 'floor']);

const stairRule = {
  id: 'stair',
  mode: null,
  keywords: ['stair', 'staircase', 'riser', 'tread', 'going', 'step'],
  required: ['height', 'riser'],
  optional: ['length', 'width', 'tread'],
  answer: 'Risers',
  immediate: true,
  partial: ['length'],
  priority: 40,
  seed(tokens) {
    const length = tokens.find((token) => token.type === 'length');
    return length ? lengthFields('height', length) : null;
  },
  pattern(tokens) {
    const words = tokens.filter((token) => token.type === 'word').map((token) => token.raw.toLowerCase());
    if (!words.some((word) => TRIGGER.has(word))) return null;
    if (words.some((word) => !HINT.has(word))) return null;
    const lengths = tokens.filter((token) => token.type === 'length' || token.type === 'number');
    if (lengths.length !== 2) return null;
    if (tokens.some((token) => token.type === 'area' || token.type === 'size' || token.type === 'percent' || token.type === 'ratio')) return null;
    return {
      values: { ...lengthFields('height', lengths[0]), ...lengthFields('riser', lengths[1]) },
      used: tokens.map((_, index) => index),
    };
  },
};

export default stairRule;
