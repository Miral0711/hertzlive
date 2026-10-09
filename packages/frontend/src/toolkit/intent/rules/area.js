import { bare, lengthFields } from '../bind';

const EXTRA = new Set(['room', 'rooms', 'area', 'square', 'rectangle']);

function shape(tokens) {
  return tokens.map((token) => {
    if (token.type === 'number' || token.type === 'length') return 'L';
    if (token.type === 'op' && (token.op === 'times' || token.op === 'mul')) return 'x';
    return token.type;
  }).join(',');
}

const areaRule = {
  id: 'area',
  mode: 'rectangle',
  keywords: ['area', 'rectangle', 'square', 'geometry'],
  required: ['length', 'width'],
  optional: [],
  answer: 'Area',
  immediate: true,
  partial: ['length'],
  priority: 20,
  seed(tokens) {
    const length = tokens.find((token) => token.type === 'length');
    return length ? lengthFields('length', length) : null;
  },
  pattern(tokens) {
    const core = [];
    const used = [];
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (token.type === 'word' && EXTRA.has(token.raw.toLowerCase())) {
        used.push(index);
        continue;
      }
      core.push(token);
      used.push(index);
    }
    if (shape(core) !== 'L,x,L') return null;
    const [a, op, b] = core;
    if (bare(a) !== bare(b)) return null;
    // A bare "12 × 4" or "12*4" is arithmetic. Letter x, and the word "by", keep the feet-area convention.
    if (bare(a) && bare(b) && op.op === 'mul') return null;
    return {
      values: { ...lengthFields('length', a), ...lengthFields('width', b) },
      used,
      assumption: bare(a) ? 'Assuming dimensions are in feet.' : '',
    };
  },
};

export default areaRule;
