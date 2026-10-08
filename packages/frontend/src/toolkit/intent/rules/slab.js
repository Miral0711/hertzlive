import { lengthFields } from '../bind';

const slabRule = {
  id: 'volume',
  mode: 'slab',
  keywords: ['slab'],
  required: ['length', 'width', 'thickness'],
  optional: [],
  answer: 'Volume',
  immediate: true,
  partial: [],
  priority: 15,
  pattern(tokens) {
    const words = tokens.filter((token) => token.type === 'word').map((token) => token.raw.toLowerCase());
    if (!words.includes('slab')) return null;
    if (words.some((word) => word !== 'slab')) return null;
    const lengths = tokens.filter((token) => token.type === 'length' || token.type === 'number');
    if (lengths.length !== 3) return null;
    if (tokens.some((token) => !['length', 'number', 'op', 'word'].includes(token.type))) return null;
    return {
      values: {
        ...lengthFields('length', lengths[0]),
        ...lengthFields('width', lengths[1]),
        ...lengthFields('thickness', lengths[2]),
      },
      used: tokens.map((_, index) => index),
    };
  },
};

export default slabRule;
