import { lengthFields } from './intent/bind';
import { interpret } from './intent/interpret';
import { RULES } from './intent/rules/index';

function ids(out) {
  if (out.kind === 'result') return [out.result.id];
  return out.choices.map((choice) => choice.id);
}

test('rectangle area from architectural feet and inches', () => {
  const out = interpret('12\'-6" × 15\'-4"');
  expect(out.kind).toBe('result');
  expect(out.result.id).toBe('area');
  expect(out.result.mode).toBe('rectangle');
  expect(out.result.outcome.summary).toMatch(/m²/);
  expect(out.result.outcome.summary).toMatch(/sq\.ft/);
  expect(out.result.headline.map((line) => line.label)).toEqual(['Area']);
  expect(out.result.assumption).toBe('');
});

test('bare multiply is area in feet, and says so', () => {
  const out = interpret('12 x 15');
  expect(out.kind).toBe('result');
  expect(out.result.id).toBe('area');
  expect(out.result.assumption).toBe('Assuming dimensions are in feet.');
  expect(out.result.outcome.summary).toMatch(/180/);
  expect(out.result.outcome.summary).toMatch(/sq\.ft/);
});

test('tile phrase calculates tile quantity', () => {
  const out = interpret('850 sq.ft 600x600 tiles 7% wastage');
  expect(out.kind).toBe('result');
  expect(out.result.id).toBe('tile');
  expect(out.result.inputs.wastage).toBe('7');
  expect(out.result.inputs.area).toBe('850');
  expect(out.result.inputs.tileW).toBe('600');
  expect(out.result.title).toBe('Tile Quantity');
  expect(out.result.headline.map((line) => line.label)).toEqual(['Tiles to order']);
  expect(out.result.headline[0].value).toMatch(/nos/);
  expect(out.result.details.map((line) => line.label).slice(0, 3)).toEqual(['Area', 'Tile', 'Wastage']);
  expect(out.result.details[0].value).toMatch(/850/);
  expect(out.result.details[1].value).toMatch(/600 × 600/);
  expect(out.result.details[2].value).toBe('7%');
});

test('drawing scale from millimetres and a ratio', () => {
  const out = interpret('45mm at 1:100');
  expect(out.kind).toBe('result');
  expect(out.result.id).toBe('scale');
  expect(out.result.headline.map((line) => line.label)).toEqual(['Actual size']);
  expect(out.result.headline[0].value).toMatch(/4\.5 m/);
});

test('staircase from floor height and riser', () => {
  const out = interpret('10\'-0" floor height, 7.5" riser');
  expect(out.kind).toBe('result');
  expect(out.result.id).toBe('stair');
  expect(out.result.outcome.lines[0].label).toBe('Risers');
});

test('slope from rise over run', () => {
  const out = interpret('300mm rise over 6m');
  expect(out.kind).toBe('result');
  expect(out.result.id).toBe('slope');
  expect(out.result.mode).toBe('rise-run');
  expect(out.result.outcome.ok).toBe(true);
  expect(out.result.headline.map((line) => line.value).join(' ')).toMatch(/5%/);
  expect(out.result.headline.map((line) => line.value).join(' ')).toMatch(/1 : 20/);
});

test('slab phrase is slab volume', () => {
  const out = interpret('20\' × 30\' slab × 5"');
  expect(out.kind).toBe('result');
  expect(out.result.id).toBe('volume');
  expect(out.result.mode).toBe('slab');
  expect(out.result.outcome.summary).toMatch(/m³/);
});

test('length sum uses the unit converter', () => {
  const out = interpret('10\' 6" + 2\' 4"');
  expect(out.kind).toBe('result');
  expect(out.result.id).toBe('units');
  expect(out.result.mode).toBe('length');
  expect(out.result.outcome.lines[0].value).toMatch(/12'/);
});

test('tile keyword lists the tile tool and does not calculate', () => {
  const out = interpret('tile');
  expect(out.kind).toBe('choices');
  expect(out.result).toBeNull();
  expect(out.choices.map((choice) => choice.title).sort()).toEqual(['Flooring', 'Tile Quantity']);
  expect(out.choices.find((choice) => choice.id === 'tile').blurb).toMatch(/wastage/i);
});

test('stair keyword lists the staircase and the ramp', () => {
  const out = interpret('stair');
  expect(out.kind).toBe('choices');
  expect(out.result).toBeNull();
  expect(out.choices.map((choice) => choice.title).sort()).toEqual(['Ramp', 'Staircase']);
});

test('scale keyword lists drawing scale', () => {
  const out = interpret('scale');
  expect(out.kind).toBe('choices');
  expect(out.result).toBeNull();
  expect(ids(out)).toContain('scale');
});

test('paint keyword does not calculate', () => {
  const out = interpret('paint');
  expect(out.kind).toBe('choices');
  expect(out.result).toBeNull();
  expect(ids(out)).toContain('paint');
});

test('a lone length offers choices and does not calculate', () => {
  const out = interpret('10 ft');
  expect(out.kind).toBe('choices');
  expect(out.result).toBeNull();
  expect(out.choices.map((choice) => choice.title)).toEqual(['Length', 'Area', 'Volume', 'Staircase']);
  expect(out.choices.every((choice) => choice.blurb === '')).toBe(true);
  expect(out.prompt).toBe('What would you like to do with 10 ft?');
});

test('a registered brick rule owns the wall phrase and area still owns the rectangle', () => {
  const brick = {
    id: 'brick',
    mode: null,
    keywords: ['wall', 'brick', 'bricks'],
    required: ['length', 'height', 'thickness'],
    optional: [],
    immediate: true,
    partial: [],
    priority: 1,
    pattern(tokens) {
      const words = tokens.filter((token) => token.type === 'word').map((token) => token.raw.toLowerCase());
      if (!words.includes('wall') && !words.includes('brick') && !words.includes('bricks')) return null;
      const lengths = tokens.filter((token) => token.type === 'length');
      if (lengths.length !== 3) return null;
      return {
        values: {
          ...lengthFields('length', lengths[0]),
          ...lengthFields('height', lengths[1]),
          ...lengthFields('thickness', lengths[2]),
        },
        used: tokens.map((_, index) => index),
      };
    },
  };
  const wall = interpret('10ft x 8ft wall 9 inch', [...RULES, brick]);
  expect(wall.kind).toBe('result');
  expect(wall.result.id).toBe('brick');
  const area = interpret('12\'-6" × 15\'-4"', [...RULES, brick]);
  expect(area.kind).toBe('result');
  expect(area.result.id).toBe('area');
});

test('two complete matches are returned and nothing is calculated', () => {
  const accept = (id) => ({
    id,
    mode: null,
    keywords: [],
    required: ['length'],
    optional: [],
    immediate: true,
    partial: [],
    priority: 1,
    pattern(tokens) {
      if (!tokens.length) return null;
      return { values: { length: '10', lengthUnit: 'ft' }, used: tokens.map((_, index) => index) };
    },
  });
  const out = interpret('10ft × 10ft', [accept('one'), accept('two')]);
  expect(out.kind).toBe('choices');
  expect(out.result).toBeNull();
  expect(ids(out).sort()).toEqual(['one', 'two']);
});

test('a wall phrase is not claimed by area or by a keyword that ignores the measurements', () => {
  const out = interpret('10ft x 8ft wall 9 inch');
  expect(out.kind).toBe('empty');
  expect(out.result).toBeNull();
  expect(out.choices).toEqual([]);
});

test('plain arithmetic calculates without a calculator', () => {
  const value = (text) => {
    const out = interpret(text);
    expect(out.kind).toBe('result');
    expect(out.result.id).toBe('arithmetic');
    return out.result.headline[0].value;
  };
  expect(value('7+8')).toBe('15');
  expect(value('20-5')).toBe('15');
  expect(value('12*4')).toBe('48');
  expect(value('12×4')).toBe('48');
  expect(value('100/4')).toBe('25');
  expect(value('2+3×4')).toBe('14');
  expect(value('(10+5)*2')).toBe('30');
  expect(value('25+10-5')).toBe('30');
  expect(value('20 × 4')).toBe('80');
  expect(value('20 × 5')).toBe('100');
});

test('natural language conversions calculate immediately', () => {
  const value = (text) => {
    const out = interpret(text);
    expect(out.kind).toBe('result');
    expect(out.result.id).toBe('units');
    return out.result.headline[0].value;
  };
  expect(value('600 ft to m')).toBe('182.88 m');
  expect(value('600 feet to meters')).toBe('182.88 m');
  expect(value('600 ft in meters')).toBe('182.88 m');
  expect(value('convert 600 feet to meters')).toBe('182.88 m');
  expect(value('how many meters is 600 feet')).toBe('182.88 m');
  expect(value('7 inch to feet')).toBe('0.5833 ft');
  expect(value('7 inches to feet')).toBe('0.5833 ft');
  expect(value('7" to ft')).toBe('0.5833 ft');
  expect(value('7 in to ft')).toBe('0.5833 ft');
  expect(value('1200 mm to m')).toBe('1.2 m');
  expect(value('2.5 m to ft')).toBe('8.202 ft');
  expect(value('450 mm to inches')).toBe('17.717 in');
  expect(value('12 inches to mm')).toBe('304.8 mm');
  expect(value('850 sq.ft to sqm')).toBe('78.97 m²');
  expect(value('100 sqm to sqft')).toBe('1076.39 sq.ft');
  expect(interpret('600 ft to m').result.title).toBe('Length conversion');
  expect(interpret('600 ft to m').result.lead).toBe('600 ft');
  expect(interpret('850 sq.ft to sqm').result.title).toBe('Area conversion');
});

test('an unfinished conversion is not an error', () => {
  expect(interpret('600 ft to').kind).toBe('incomplete');
  expect(interpret('600 ft to').hint).toBe('Choose a unit…');
  expect(interpret('600 ft to me').kind).toBe('incomplete');
  expect(interpret('600 f').kind).toBe('incomplete');
  expect(interpret('600 ft to').result).toBeNull();
  expect(interpret('hello xyz').kind).toBe('empty');
});

test('spoken dimensions calculate area, slope, slab, and stairs', () => {
  const area = (text) => interpret(text);
  ['12 ft by 15 ft', '12 feet by 15 feet', 'what is 12 feet by 15 feet', 'room is 12 by 15', '10 ft by 12 ft'].forEach((text) => {
    const out = area(text);
    expect(out.kind).toBe('result');
    expect(out.result.id).toBe('area');
  });
  expect(interpret('12 ft by 15 ft').result.outcome.summary).toMatch(/180/);
  expect(interpret('10 ft by 12 ft').result.outcome.summary).toMatch(/120/);
  expect(interpret('20 ft x 30 ft slab 5 inch').result.id).toBe('volume');
  expect(interpret('20 ft x 30 ft slab 5 inch').result.mode).toBe('slab');
  expect(interpret('10 foot floor height with 7.5 inch riser').result.id).toBe('stair');
  const tiles = interpret('calculate tiles for 850 sq ft using 600x600 tiles with 7% wastage');
  expect(tiles.kind).toBe('result');
  expect(tiles.result.id).toBe('tile');
  const unicode = interpret('850 sq.ft 600×600 tiles 7% wastage');
  expect(unicode.result.id).toBe('tile');
  expect(unicode.result.headline[0].value).toMatch(/235/);
});

test('a half typed sum is incomplete, not an error', () => {
  ['7+', '20*', '100/', '7'].forEach((text) => {
    const out = interpret(text);
    expect(out.kind).toBe('incomplete');
    expect(out.result).toBeNull();
  });
  expect(interpret('7').quiet).toBe(true);
  expect(interpret('7+').quiet).toBeFalsy();
});

test('same-unit length sums stay in that unit', () => {
  expect(interpret('12 ft + 6 ft').result.headline[0].value).toBe('18 ft');
  expect(interpret('1200 mm + 300 mm').result.headline[0].value).toBe('1500 mm');
  expect(interpret('12\'-6" + 2\'-4"').result.headline[0].value).toMatch(/14'/);
});

test('a rule that leaves a measurement unused is rejected', () => {
  const greedy = {
    id: 'area',
    mode: 'rectangle',
    keywords: [],
    required: ['length', 'width'],
    optional: [],
    immediate: true,
    partial: [],
    pattern(tokens) {
      const lengths = [];
      tokens.forEach((token, index) => {
        if (token.type === 'length') lengths.push(index);
      });
      if (lengths.length < 2) return null;
      return {
        values: { length: '10', lengthUnit: 'ft', width: '8', widthUnit: 'ft' },
        used: [lengths[0], lengths[1]],
      };
    },
  };
  const out = interpret('10ft x 8ft wall 9 inch', [greedy]);
  expect(out.kind).toBe('empty');
  expect(out.result).toBeNull();
});
