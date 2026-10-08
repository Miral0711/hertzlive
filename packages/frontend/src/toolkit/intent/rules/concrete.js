const MIXES = new Set(['1:1.5:3', '1:2:4', '1:3:6', '1:4:8']);

const concreteRule = {
  id: 'concrete',
  mode: null,
  keywords: ['concrete', 'cement', 'mix'],
  required: ['mix'],
  optional: ['volume', 'length', 'width', 'depth'],
  immediate: false,
  partial: [],
  priority: 25,
  pattern(tokens) {
    if (tokens.length !== 1 || tokens[0].type !== 'ratio' || tokens[0].parts.length !== 3) return null;
    const mix = tokens[0].parts.map((part) => String(part)).join(':');
    if (!MIXES.has(mix)) return null;
    return { values: { input: 'size', mix }, used: [0] };
  },
};

export default concreteRule;
