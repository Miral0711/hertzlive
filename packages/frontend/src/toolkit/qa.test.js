import { CALCULATORS, defaultMode, fieldsFor } from './catalog';
import { runCalculator } from './calc';
import { interpret } from './intent/interpret';
import { initialValues, isVisible, normalize } from './read';

function value(text) {
  const out = interpret(text);
  expect(out.kind).toBe('result');
  const blob = JSON.stringify(out.result);
  expect(blob).not.toMatch(/NaN|Infinity|undefined/);
  return out.result.headline.map((line) => line.value).join(' ');
}

function fill(fields, values) {
  const apply = (list, target) => {
    list.forEach((field) => {
      if (field.when && !isVisible(field, target)) return;
      if (field.type === 'repeat') {
        const rows = Array.isArray(target[field.key]) && target[field.key].length ? target[field.key] : [{}];
        target[field.key] = rows.map((row) => {
          const next = { ...row };
          apply(field.fields, next);
          return next;
        });
        return;
      }
      const current = target[field.key];
      if (current != null && String(current).trim() !== '') return;
      if (field.type === 'length') target[field.key] = '3';
      else if (field.type === 'area') target[field.key] = '12';
      else if (field.type === 'volume') target[field.key] = '1';
      else if (field.type === 'mass') target[field.key] = '10';
      else if (field.type === 'number') target[field.key] = '2';
      else if (field.type === 'text') target[field.key] = field.key === 'text' ? '1/2' : 'Item';
    });
  };
  apply(fields, values);
  return values;
}

test('arithmetic, precedence, decimals, and unfinished sums', () => {
  expect(value('7+8')).toBe('15');
  expect(value('20-5')).toBe('15');
  expect(value('12*4')).toBe('48');
  expect(value('12×4')).toBe('48');
  expect(value('100/4')).toBe('25');
  expect(value('25+10-5')).toBe('30');
  expect(value('2+3×4')).toBe('14');
  expect(value('(10+5)*2')).toBe('30');
  expect(value('10.5+2.5')).toBe('13');
  expect(value('100.25-50.25')).toBe('50');
  expect(value('0.5*20')).toBe('10');
  expect(value('10/3')).toBe('3.3333333333');
  expect(value('0+8')).toBe('8');
  expect(value('8×0')).toBe('0');
  expect(value('10-20')).toBe('-10');
  expect(value('-5+10')).toBe('5');
  expect(value('7.5+2.5')).toBe('10');
  expect(value('1000000+2000000')).toBe('3000000');
  ['7+', '20*', '100/', '(10+5', '7'].forEach((text) => {
    const out = interpret(text);
    expect(out.kind).toBe('incomplete');
    expect(out.result).toBeNull();
  });
  const divided = interpret('1/0');
  expect(divided.kind).not.toBe('result');
  expect(JSON.stringify(divided)).not.toMatch(/Infinity/);
});

test('length and area conversions, including spoken variants', () => {
  expect(value('600 ft to m')).toBe('182.88 m');
  expect(value('600 feet to meters')).toBe('182.88 m');
  expect(value('600 ft in meters')).toBe('182.88 m');
  expect(value('600 feet in m')).toBe('182.88 m');
  expect(value('7 inch to feet')).toBe('0.5833 ft');
  expect(value('7 inches to feet')).toBe('0.5833 ft');
  expect(value('7 in to ft')).toBe('0.5833 ft');
  expect(value('7" to ft')).toBe('0.5833 ft');
  expect(value('1200 mm to m')).toBe('1.2 m');
  expect(value('1200mm to m')).toBe('1.2 m');
  expect(value('2.5 m to ft')).toBe('8.202 ft');
  expect(value('450 mm to inches')).toBe('17.717 in');
  expect(value('12 inches to mm')).toBe('304.8 mm');
  expect(value('0 ft to m')).toBe('0 m');
  expect(value('1000000 mm to m')).toBe('1000 m');
  expect(value('12.75 ft to m')).toBe('3.886 m');
  expect(value('600.5 mm to m')).toBe('0.6005 m');
  expect(value('850 sq.ft to sqm')).toBe('78.97 m²');
  expect(value('850 sq ft to sqm')).toBe('78.97 m²');
  expect(value('850 sqft to sqm')).toBe('78.97 m²');
  expect(value('850.5 sq.ft to sqm')).toBe('79.01 m²');
  expect(value('100 sqm to sqft')).toBe('1076.39 sq.ft');
  expect(value('100 square meters to square feet')).toBe('1076.39 sq.ft');
  expect(value('100 m² to sqft')).toBe('1076.39 sq.ft');
  expect(value('100000 sq.ft to sqm')).toBe('9290.3 m²');
  expect(interpret('850 sq.ft to sqm').result.id).toBe('units');
  expect(interpret('850 sq.ft to sqm').result.mode).toBe('area');
});

test('area, tile, scale, stair, slope, slab, and length sums', () => {
  expect(value('12\'-6" × 15\'-4"')).toMatch(/191\.67 sq\.ft/);
  expect(value('12 x 15')).toMatch(/180 sq\.ft/);
  expect(value('12 X 15')).toMatch(/180 sq\.ft/);
  expect(value('12 ft × 15 ft')).toMatch(/180 sq\.ft/);
  expect(value('10 ft by 20 ft')).toMatch(/200 sq\.ft/);
  expect(value('12 feet by 15 feet')).toMatch(/180 sq\.ft/);
  expect(value('12 by 15 room')).toMatch(/180 sq\.ft/);
  expect(interpret('12×4').result.id).toBe('arithmetic');

  const tiles = (text, order) => {
    const out = interpret(text);
    expect(out.result.id).toBe('tile');
    expect(out.result.headline[0].value).toMatch(order);
    expect(out.result.headline[0].value).not.toMatch(/m²/);
  };
  tiles('850 sq.ft 600×600 tiles 7% wastage', /235/);
  tiles('450 sq.ft 500×600 tiles 7% wastage', /150/);
  tiles('50 sq.ft 500×600 tiles 7% wastage', /17/);
  tiles('850 sq.ft 500×600 tiles 7% wastage', /282/);
  tiles('850 sq ft 600x600 tiles 7% wastage', /235/);
  expect(value('850 sq.ft 600x600 tiles 0% wastage')).toMatch(/nos/);

  expect(value('45mm at 1:100')).toMatch(/4\.5 m/);
  expect(value('45 mm at 1:50')).toMatch(/2\.25 m/);
  expect(value('1m at 1:100')).toMatch(/100 m/);
  ['1:100', '1:50', '1:20', '1:200'].forEach((text) => {
    expect(interpret(text).kind).not.toBe('result');
  });

  expect(interpret('10\'-0" floor height, 7.5" riser').result.id).toBe('stair');
  expect(interpret('10 ft floor height 7.5 inch riser').result.id).toBe('stair');
  expect(interpret('10 feet height with 7.5 inch riser').result.id).toBe('stair');
  expect(value('10\'-0" floor height, 7.5" riser')).toMatch(/16/);

  expect(value('300mm rise over 6m')).toMatch(/5%/);
  expect(value('300mm rise over 6m')).toMatch(/1 : 20/);
  expect(value('100mm rise over 5m')).toMatch(/2%/);
  expect(value('500mm rise over 10m')).toMatch(/5%/);

  expect(interpret('20\' × 30\' slab × 5"').result.mode).toBe('slab');
  expect(interpret('20 ft x 30 ft slab 5 inch').result.mode).toBe('slab');
  expect(interpret('20 × 30 slab 5"').result.mode).toBe('slab');
  expect(interpret('20 ft x 30 ft slab 5 inch').result.id).not.toBe('area');

  expect(value('10\' 6" + 2\' 4"')).toMatch(/12'-10"/);
  expect(value('12\'-6 + 2\'-4')).toMatch(/14'-10"/);
  expect(value('5 ft + 2 ft')).toBe('7 ft');
  expect(value('1200mm + 300mm')).toBe('1500 mm');
  expect(value('2m + 500mm')).toBe('2.5 m');
});

test('tool search, ambiguity, and unknown text stay calm', () => {
  expect(interpret('tile').choices.map((choice) => choice.title)).toContain('Tile Quantity');
  expect(interpret('stair').choices.map((choice) => choice.title)).toContain('Staircase');
  expect(interpret('scale').choices.map((choice) => choice.title)).toContain('Drawing scale');
  expect(interpret('paint').choices.map((choice) => choice.id)).toContain('paint');
  expect(interpret('unit').choices.map((choice) => choice.id)).toContain('units');
  ['10 ft', '10 m'].forEach((text) => {
    const out = interpret(text);
    expect(out.kind).toBe('choices');
    expect(out.result).toBeNull();
    expect(out.choices.map((choice) => choice.title)).toEqual(['Length', 'Area', 'Volume', 'Staircase']);
  });
  expect(interpret('20').kind).toBe('incomplete');
  ['hello xyz', 'random text', 'asdfgh', 'tile banana xyz', '999 nonsense'].forEach((text) => {
    const out = interpret(text);
    expect(out.kind).toBe('empty');
    expect(JSON.stringify(out)).not.toMatch(/NaN|Infinity|undefined/);
  });
  expect(() => interpret('0 sq.ft')).not.toThrow();
  expect(interpret('-5 ft to m').kind).not.toBe('result');
});

test('every registered calculator returns a finite result for a filled form', () => {
  const bad = [];
  CALCULATORS.forEach((calc) => {
    const mode = defaultMode(calc);
    const fields = fieldsFor(calc, mode);
    const values = fill(fields, initialValues(fields));
    if (calc.id === 'solar') {
      values.window = '4';
      values.floor = '20';
      values.altitude = '45';
      values.overhang = '600';
    }
    const norm = normalize(fields, values);
    const outcome = norm.errors.length ? { ok: false, error: norm.errors.join(',') } : runCalculator(calc.id, mode, norm.values);
    const blob = JSON.stringify(outcome);
    if (!outcome?.ok || /NaN|Infinity/.test(blob)) bad.push(`${calc.id}:${mode || ''} ${blob.slice(0, 180)}`);
  });
  expect(bad).toEqual([]);
});

test('malformed toolkit storage does not crash', () => {
  localStorage.setItem('herts.toolkit.v1', '{');
  jest.isolateModules(() => {
    const store = require('./store');
    expect(store.getSnapshot().saved).toEqual([]);
    expect(store.getSnapshot().recentCalcs).toEqual([]);
    expect(store.getSnapshot().favorites).toEqual([]);
  });
});
