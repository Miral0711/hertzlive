import { formatArch, parseLengthToMm } from './units';
import {
  areaCalc, barKgPerM, concreteCalc, farCalc, scaleCalc, stairCalc, tileCalc, unitsCalc,
} from './calc';

describe('architectural lengths', () => {
  test('reads feet and inches', () => {
    expect(parseLengthToMm('12\'-6"')).toBeCloseTo(3810, 3);
    expect(parseLengthToMm('15\'-4"')).toBeCloseTo((15 * 12 + 4) * 25.4, 3);
    expect(parseLengthToMm('4\'-6 1/2"')).toBeCloseTo((4 * 12 + 6.5) * 25.4, 3);
    expect(parseLengthToMm('1200 mm')).toBe(1200);
    expect(parseLengthToMm('1.2 m')).toBeCloseTo(1200, 3);
    expect(parseLengthToMm('12 ft 6 in')).toBeCloseTo(3810, 3);
  });

  test('formats architectural inches', () => {
    expect(formatArch(3810)).toBe('12\'-6"');
    expect(formatArch((4 * 12 + 6.5) * 25.4)).toBe('4\'-6 1/2"');
  });
});

describe('calculators', () => {
  test('converts a length into metric and feet-inches', () => {
    const result = unitsCalc({ value: 3810 }, 'length');
    expect(result.ok).toBe(true);
    expect(result.lines[0].value).toBe('12\'-6"');
    expect(result.lines.find((l) => l.label === 'Metres').value).toBe('3.81 m');
  });

  test('rectangle area is length times width', () => {
    const result = areaCalc({ length: 4000, width: 3000 }, 'rectangle');
    expect(result.lines[0].value).toContain('12 m²');
  });

  test('staircase divides the floor height by the preferred riser', () => {
    const result = stairCalc({ height: 3000, riser: 150, tread: 250, length: null, width: null });
    expect(result.lines.find((l) => l.label === 'Risers').value).toBe('20');
    expect(result.lines.find((l) => l.label === 'Treads').value).toBe('19');
    expect(result.sketch.riser).toBeCloseTo(150, 3);
    expect(result.sketch.tread).toBeCloseTo(250, 3);
  });

  test('fits stair treads into the available length', () => {
    const result = stairCalc({ height: 3000, riser: 150, tread: 250, length: 4750, width: null });
    expect(result.sketch.tread).toBeCloseTo(250, 3);
  });

  test('scale 1:100 turns a drawing measure into the actual size', () => {
    const result = scaleCalc({ scale: '100', length: 50, direction: 'toActual' });
    expect(result.ok).toBe(true);
    expect(result.lines.find((l) => l.label === 'Actual size').value).toContain('5 m');
  });

  test('nominal concrete mix reports cement bags', () => {
    const result = concreteCalc({ input: 'volume', volume: 1, mix: '1:2:4', wastage: 0 });
    expect(result.ok).toBe(true);
    const bags = result.lines.find((l) => l.label === 'Cement').value;
    expect(bags).toContain('order 7');
  });

  test('tile count adds wastage and rounds boxes up', () => {
    const result = tileCalc({
      input: 'area', area: 10, tileW: 600, tileH: 600, wastage: 10, perBox: 4,
    });
    expect(result.lines.find((l) => l.label === 'Tiles to order').value).toContain('31');
    expect(result.lines.find((l) => l.label === 'Boxes').value).toContain('8');
  });

  test('FSI is plot area times the factor', () => {
    const result = farCalc({ plot: 100, fsi: 1.5, coverage: 50, built: null, carpet: 80, super: 100 });
    expect(result.lines.find((l) => l.label === 'Maximum built-up from FSI').value).toContain('150 m²');
    expect(result.lines.find((l) => l.label === 'Efficiency').value).toBe('80%');
  });

  test('bar weight follows d²/162', () => {
    expect(barKgPerM(12)).toBeCloseTo(144 / 162, 5);
  });
});
