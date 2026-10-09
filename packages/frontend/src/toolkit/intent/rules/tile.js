const WORDS = new Set(['tile', 'tiles', 'wastage', 'waste', 'with', 'for', 'of']);

function tileSize(tokens) {
  const glued = tokens.findIndex((token) => token.type === 'size');
  if (glued >= 0) {
    const token = tokens[glued];
    return { width: token.width, height: token.height, indexes: [glued] };
  }
  for (let index = 0; index < tokens.length - 2; index += 1) {
    const [left, op, right] = [tokens[index], tokens[index + 1], tokens[index + 2]];
    if (left.type === 'number' && op.type === 'op' && (op.op === 'times' || op.op === 'mul') && right.type === 'number') {
      return { width: left.value, height: right.value, indexes: [index, index + 1, index + 2] };
    }
  }
  return null;
}

function areaLabel(area) {
  if (area.unit === 'sqft') return `${area.text} sq.ft`;
  if (area.unit === 'sqyd') return `${area.text} sq.yd`;
  return `${area.text} m²`;
}

const tileRule = {
  id: 'tile',
  mode: null,
  title: 'Tile Quantity',
  blurb: 'Calculate tile count and wastage',
  keywords: ['tile', 'tiles'],
  required: ['area', 'tileW', 'tileH'],
  optional: ['wastage'],
  answer: 'Tiles to order',
  immediate: true,
  partial: [],
  priority: 10,
  pattern(tokens) {
    const words = tokens.filter((token) => token.type === 'word').map((token) => token.raw.toLowerCase());
    if (!words.some((word) => word === 'tile' || word === 'tiles')) return null;
    if (words.some((word) => !WORDS.has(word))) return null;
    const area = tokens.find((token) => token.type === 'area');
    const size = tileSize(tokens);
    if (!area || !size) return null;
    const held = new Set(size.indexes);
    if (tokens.some((token, index) => !held.has(index) && (token.type === 'number' || token.type === 'length' || token.type === 'ratio' || token.type === 'volume' || token.type === 'size'))) return null;
    const percent = tokens.find((token) => token.type === 'percent');
    const wastage = percent ? String(percent.value) : '0';
    return {
      values: {
        input: 'area',
        area: area.text,
        areaUnit: area.unit,
        tileW: String(size.width),
        tileWUnit: 'mm',
        tileH: String(size.height),
        tileHUnit: 'mm',
        wastage,
      },
      facts: [
        ['Area', areaLabel(area)],
        ['Tile', `${size.width} × ${size.height} mm`],
        ['Wastage', `${wastage}%`],
      ],
      used: tokens.map((_, index) => index),
    };
  },
};

export default tileRule;
