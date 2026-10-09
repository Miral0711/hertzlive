// Architectural calculators. Inputs are plain numbers (mm, m², m³). No React, DOM, or storage.

import {
  AREA_TO_M2, LENGTH_TO_MM, MASS_TO_KG, VOLUME_TO_M3,
  areaText, decimalToFraction, formatArch, gcd, lenText, num, parseFraction, volText,
} from './units';

const pos = (n) => n != null && Number.isFinite(n) && n > 0;
const pending = () => ({ ok: false, pending: true });
const invalid = (error) => ({ ok: false, error });

function done(lines, extra = {}) {
  const mapped = lines.filter(Boolean).map(([label, value, hint]) => ({
    label,
    value: String(value),
    ...(hint ? { hint } : {}),
  }));
  return {
    ok: true,
    lines: mapped,
    summary: mapped[0] ? `${mapped[0].label}: ${mapped[0].value}` : '',
    ...extra,
  };
}

const m = (mm) => mm / 1000;
const countText = (n, unit) => {
  if (!Number.isFinite(n)) return '—';
  const order = Math.ceil(n - 1e-9);
  if (Math.abs(n - order) < 0.05) return `${order} ${unit}`;
  return `${num(n, 2)} ${unit} (order ${order})`;
};

function shoelaceM2(pts) {
  let sum = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const j = (i + 1) % pts.length;
    sum += m(pts[i].x) * m(pts[j].y) - m(pts[j].x) * m(pts[i].y);
  }
  return Math.abs(sum) / 2;
}

function slopeFromRiseRun(riseMm, runMm) {
  const rise = m(riseMm);
  const run = m(runMm);
  const length = Math.hypot(rise, run);
  const pct = (rise / run) * 100;
  const ratio = run / rise;
  const angle = (Math.atan2(rise, run) * 180) / Math.PI;
  return { rise, run, length, pct, ratio, angle };
}

function slopeLines(s) {
  return [
    ['Slope length', lenText(s.length * 1000)],
    ['Rise', lenText(s.rise * 1000)],
    ['Run', lenText(s.run * 1000)],
    ['Slope', `${num(s.pct, 2)}%`],
    ['Gradient (slope ratio)', `1 : ${num(s.ratio, 2)}`],
    ['Angle', `${num(s.angle, 2)}°`],
  ];
}

export function unitsCalc(v, mode) {
  if (mode === 'length') {
    if (!pos(v.value) && v.value !== 0) return pending();
    if (!Number.isFinite(v.value)) return pending();
    const mm = v.value;
    return done([
      ['Feet and inches', formatArch(mm)],
      ['Millimetres', `${num(mm, 1)} mm`],
      ['Centimetres', `${num(mm / 10, 2)} cm`],
      ['Metres', `${num(mm / 1000, 3)} m`],
      ['Inches', `${num(mm / LENGTH_TO_MM.in, 3)} in`],
      ['Feet', `${num(mm / LENGTH_TO_MM.ft, 3)} ft`],
    ]);
  }
  if (mode === 'area') {
    if (!Number.isFinite(v.value)) return pending();
    const m2 = v.value;
    return done([
      ['Square metres', `${num(m2, 3)} m²`],
      ['Square feet', `${num(m2 / AREA_TO_M2.sqft, 3)} sq.ft`],
      ['Square centimetres', `${num(m2 / AREA_TO_M2.cm2, 1)} cm²`],
      ['Square inches', `${num(m2 / AREA_TO_M2.sqin, 2)} sq.in`],
    ]);
  }
  if (mode === 'volume') {
    if (!Number.isFinite(v.value)) return pending();
    const m3 = v.value;
    return done([
      ['Cubic metres', `${num(m3, 3)} m³`],
      ['Litres', `${num(m3 / VOLUME_TO_M3.litre, 2)} L`],
      ['Cubic feet', `${num(m3 / VOLUME_TO_M3.cuft, 3)} cu.ft`],
    ]);
  }
  if (mode === 'weight') {
    if (!Number.isFinite(v.value)) return pending();
    const kg = v.value;
    return done([
      ['Kilograms', `${num(kg, 3)} kg`],
      ['Grams', `${num(kg / MASS_TO_KG.g, 1)} g`],
      ['Pounds', `${num(kg / MASS_TO_KG.lb, 3)} lb`],
      ['Tonnes', `${num(kg / MASS_TO_KG.tonne, 4)} t`],
    ]);
  }
  if (mode === 'percent') {
    if (v.kind === 'of') {
      if (!Number.isFinite(v.percent) || !Number.isFinite(v.whole)) return pending();
      return done([[`${num(v.percent, 2)}% of ${num(v.whole, 3)}`, num(v.whole * v.percent / 100, 3)]]);
    }
    if (v.kind === 'what') {
      if (!pos(v.whole) || !Number.isFinite(v.part)) return pending();
      return done([[`${num(v.part, 3)} is`, `${num((v.part / v.whole) * 100, 2)}% of ${num(v.whole, 3)}`]]);
    }
    if (!Number.isFinite(v.from) || !Number.isFinite(v.to) || v.from === 0) return pending();
    const change = ((v.to - v.from) / Math.abs(v.from)) * 100;
    return done([['Change', `${num(change, 2)}%`]]);
  }
  if (mode === 'ratio') {
    if (!Number.isFinite(v.a) || !Number.isFinite(v.b) || v.a === 0 || v.b === 0) return pending();
    const g = gcd(Math.round(v.a * 1000), Math.round(v.b * 1000));
    const ar = Math.round(v.a * 1000) / g;
    const br = Math.round(v.b * 1000) / g;
    return done([
      ['Ratio', `${num(ar, 3)} : ${num(br, 3)}`],
      ['Decimal', num(v.a / v.b, 4)],
      ['Share of the total', `${num((v.a / (v.a + v.b)) * 100, 2)}% : ${num((v.b / (v.a + v.b)) * 100, 2)}%`],
    ]);
  }
  const parsed = parseFraction(v.text);
  if (parsed == null) return pending();
  if (!Number.isFinite(parsed)) return invalid('Enter a decimal such as 0.5, or a fraction such as 1/2 or 4 1/2.');
  const frac = decimalToFraction(parsed, 64);
  return done([
    ['Decimal', num(parsed, 6)],
    ['Fraction', frac?.text || '—'],
  ]);
}

export function areaCalc(v, mode) {
  if (mode === 'rectangle' || mode === 'square') {
    const w = mode === 'square' ? v.side : v.width;
    const l = mode === 'square' ? v.side : v.length;
    if (!pos(l) || !pos(w)) return pending();
    return done([['Area', areaText(m(l) * m(w))]]);
  }
  if (mode === 'triangle') {
    if (v.method === 'sides') {
      const [a, b, c] = [v.a, v.b, v.c].map(m);
      if (!pos(v.a) || !pos(v.b) || !pos(v.c)) return pending();
      if (a + b <= c || a + c <= b || b + c <= a) return invalid('Those three sides do not form a triangle.');
      const s = (a + b + c) / 2;
      return done([['Area', areaText(Math.sqrt(s * (s - a) * (s - b) * (s - c)))]]);
    }
    if (!pos(v.base) || !pos(v.height)) return pending();
    return done([['Area', areaText(m(v.base) * m(v.height) * 0.5)]]);
  }
  if (mode === 'circle' || mode === 'semicircle') {
    const r = v.known === 'diameter' ? v.diameter / 2 : v.radius;
    if (!pos(r)) return pending();
    const area = Math.PI * m(r) * m(r) * (mode === 'semicircle' ? 0.5 : 1);
    return done([['Area', areaText(area)]]);
  }
  if (mode === 'trapezoid') {
    if (!pos(v.a) || !pos(v.b) || !pos(v.height)) return pending();
    return done([['Area', areaText(((m(v.a) + m(v.b)) / 2) * m(v.height))]]);
  }
  if (mode === 'polygon') {
    const pts = (v.points || []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (pts.length < 3) return pending();
    return done([['Area', areaText(shoelaceM2(pts))], ['Vertices', String(pts.length)]]);
  }
  const rooms = (v.rooms || []).map((r) => {
    if (!pos(r.length) || !pos(r.width)) return null;
    const area = m(r.length) * m(r.width);
    return { name: r.name || 'Space', area };
  }).filter(Boolean);
  if (!rooms.length) return pending();
  const total = rooms.reduce((s, r) => s + r.area, 0);
  return done([
    ['Combined area', areaText(total)],
    ...rooms.map((r) => [r.name, areaText(r.area)]),
  ]);
}

function boxVolume(l, w, h) {
  return m(l) * m(w) * m(h);
}

export function volumeCalc(v, mode) {
  const count = pos(v.count) ? v.count : 1;
  if (mode === 'room' || mode === 'concrete' || mode === 'excavation' || mode === 'slab') {
    const c = mode === 'slab' ? v.thickness : mode === 'room' ? v.height : v.depth;
    if (!pos(v.length) || !pos(v.width) || !pos(c)) return pending();
    const one = boxVolume(v.length, v.width, c);
    const lines = [[mode === 'room' ? 'Room volume' : 'Volume', volText(one * (mode === 'slab' ? 1 : 1))]];
    if (mode === 'excavation') {
      const bulk = Number.isFinite(v.bulking) ? v.bulking : 0;
      lines[0] = ['Bank volume', volText(one)];
      if (bulk) lines.push(['Loose volume', volText(one * (1 + bulk / 100))]);
    }
    if (mode === 'concrete' || mode === 'slab') lines[0] = ['Volume', volText(one)];
    return done(lines);
  }
  if (mode === 'tank') {
    if (v.shape === 'cylinder') {
      if (!pos(v.diameter) || !pos(v.height)) return pending();
      const vol = Math.PI * m(v.diameter / 2) ** 2 * m(v.height);
      return done([['Volume', volText(vol)], ['Capacity', `${num(vol * 1000, 1)} L`]]);
    }
    if (!pos(v.length) || !pos(v.width) || !pos(v.height)) return pending();
    const vol = boxVolume(v.length, v.width, v.height);
    return done([['Volume', volText(vol)], ['Capacity', `${num(vol * 1000, 1)} L`]]);
  }
  if (mode === 'column') {
    if (!pos(v.height)) return pending();
    let one;
    if (v.section === 'round') {
      if (!pos(v.diameter)) return pending();
      one = Math.PI * m(v.diameter / 2) ** 2 * m(v.height);
    } else {
      if (!pos(v.width) || !pos(v.depth)) return pending();
      one = boxVolume(v.width, v.depth, v.height);
    }
    return done([['Volume', volText(one * count)], ['Each column', volText(one)], ['Count', String(count)]]);
  }
  if (mode === 'beam') {
    if (!pos(v.width) || !pos(v.depth) || !pos(v.length)) return pending();
    const one = boxVolume(v.width, v.depth, v.length);
    return done([['Volume', volText(one * count)], ['Each beam', volText(one)], ['Count', String(count)]]);
  }
  if (!pos(v.length) || !pos(v.width) || !pos(v.depth)) return pending();
  const one = boxVolume(v.length, v.width, v.depth);
  return done([['Volume', volText(one * count)], ['Each footing', volText(one)], ['Count', String(count)]]);
}

function mixParts(mix, count = 3) {
  const parts = String(mix).split(':').map(Number);
  if (parts.length !== count || parts.some((n) => !pos(n))) return null;
  return parts;
}

function concreteFromVolume(wet, mix, wastage) {
  const parts = mixParts(mix);
  if (!parts || !pos(wet)) return null;
  const order = wet * (1 + (Number(wastage) || 0) / 100);
  const dry = order * 1.54;
  const sum = parts[0] + parts[1] + parts[2];
  const cement = (dry * parts[0]) / sum;
  return {
    order,
    dry,
    cement,
    sand: (dry * parts[1]) / sum,
    agg: (dry * parts[2]) / sum,
    bags: cement / 0.035,
  };
}

export function concreteCalc(v) {
  let wet = v.input === 'volume' ? v.volume : null;
  if (v.input !== 'volume') {
    if (!pos(v.length) || !pos(v.width) || !pos(v.depth)) return pending();
    wet = boxVolume(v.length, v.width, v.depth);
  }
  const q = concreteFromVolume(wet, v.mix, v.wastage);
  if (!q) return pending();
  return done([
    ['Wet volume', volText(q.order)],
    ['Cement', countText(q.bags, 'bags (50 kg)')],
    ['Sand', volText(q.sand)],
    ['Aggregate', volText(q.agg)],
    ['Mix', v.mix],
  ], { note: 'Dry volume is taken as 1.54 × wet volume. One bag is taken as 0.035 m³.' });
}

function masonry(v, fallback) {
  if (!pos(v.length) || !pos(v.height) || !pos(v.thickness)) return pending();
  const size = v.size === 'custom'
    ? [v.unitL, v.unitH, v.unitT]
    : fallback[v.size] || fallback.traditional || fallback.full;
  if (!size || size.some((n) => !pos(n))) return pending();
  const joint = Number.isFinite(v.joint) ? v.joint : 10;
  if (joint < 0) return invalid('Joint thickness cannot be negative.');
  const [bl, bh, bt] = size;
  const wall = boxVolume(v.length, v.height, v.thickness);
  const unitVol = m(bl + joint) * m(bh + joint) * m(bt + joint);
  const bricks = wall / unitVol;
  const mortar = Math.max(0, wall - bricks * m(bl) * m(bh) * m(bt));
  const parts = mixParts(v.mix, 2);
  const lines = [
    ['Units', countText(bricks, 'nos')],
    ['Wall volume', volText(wall)],
    ['Mortar', volText(mortar)],
  ];
  if (parts) {
    const dry = mortar * 1.33;
    const sum = parts[0] + parts[1];
    const cement = (dry * parts[0]) / sum;
    lines.push(['Cement in mortar', countText(cement / 0.035, 'bags (50 kg)')]);
    lines.push(['Sand in mortar', volText((dry * parts[1]) / sum)]);
  }
  return done(lines, { note: 'Count is wall volume divided by one unit plus the mortar joint.' });
}

export function brickCalc(v) {
  return masonry(v, {
    modular: [190, 90, 90],
    traditional: [230, 110, 70],
  });
}

export function blockCalc(v) {
  return masonry(v, {
    full: [400, 200, 200],
    half: [400, 200, 100],
  });
}

function wallAreas(rows) {
  return (rows || []).map((r) => (pos(r.length) && pos(r.height) ? m(r.length) * m(r.height) : null)).filter((n) => n != null);
}

export function plasterCalc(v) {
  let area = v.input === 'area' ? v.area : null;
  if (v.input !== 'area') {
    const areas = wallAreas(v.walls);
    if (!areas.length) return pending();
    area = areas.reduce((s, n) => s + n, 0);
  }
  if (!pos(area) || !pos(v.thickness)) return pending();
  const parts = mixParts(v.mix, 2);
  if (!parts) return pending();
  const wet = area * m(v.thickness);
  const dry = wet * 1.33;
  const sum = parts[0] + parts[1];
  const cement = (dry * parts[0]) / sum;
  return done([
    ['Plaster area', areaText(area)],
    ['Mortar', volText(wet)],
    ['Cement', countText(cement / 0.035, 'bags (50 kg)')],
    ['Sand', volText((dry * parts[1]) / sum)],
  ], { note: 'Mortar dry volume is taken as 1.33 × wet volume.' });
}

export function flooringCalc(v) {
  const area = v.input === 'area' ? v.area : (pos(v.length) && pos(v.width) ? m(v.length) * m(v.width) : null);
  if (!pos(area)) return pending();
  const waste = Number.isFinite(v.wastage) ? v.wastage : 0;
  if (waste < 0) return invalid('Wastage cannot be negative.');
  const order = area * (1 + waste / 100);
  return done([
    ['Area', areaText(area)],
    ['Wastage', `${num(waste, 2)}% · ${areaText(order - area)}`],
    ['Order quantity', areaText(order)],
  ]);
}

export function tileCalc(v) {
  const area = v.input === 'area' ? v.area : (pos(v.length) && pos(v.width) ? m(v.length) * m(v.width) : null);
  if (!pos(area) || !pos(v.tileW) || !pos(v.tileH)) return pending();
  const waste = Number.isFinite(v.wastage) ? v.wastage : 0;
  if (waste < 0) return invalid('Wastage cannot be negative.');
  const tile = m(v.tileW) * m(v.tileH);
  const net = area / tile;
  const final = net * (1 + waste / 100);
  const perBox = pos(v.perBox) ? v.perBox : 1;
  return done([
    ['Area', areaText(area)],
    ['Tiles, net', countText(net, 'nos')],
    ['Wastage', `${num(waste, 2)}% · ${countText(final - net, 'nos')}`],
    ['Tiles to order', countText(final, 'nos')],
    ['Boxes', countText(final / perBox, 'boxes')],
  ]);
}

export function paintCalc(v) {
  const walls = wallAreas(v.walls);
  if (!walls.length || !pos(v.coverage) || !pos(v.coats)) return pending();
  const gross = walls.reduce((s, n) => s + n, 0);
  const openings = (v.openings || []).reduce((s, o) => {
    const n = pos(o.count) ? o.count : 1;
    if (!pos(o.width) || !pos(o.height)) return s;
    return s + m(o.width) * m(o.height) * n;
  }, 0);
  const paintable = Math.max(0, gross - openings);
  const paint = (paintable * v.coats) / v.coverage;
  const lines = [
    ['Paintable area', areaText(paintable)],
    ['Openings deducted', areaText(openings)],
    ['Paint', `${num(paint, 2)} L`],
  ];
  if (pos(v.primerCoats) && pos(v.primerCoverage)) {
    lines.push(['Primer', `${num((paintable * v.primerCoats) / v.primerCoverage, 2)} L`]);
  }
  return done(lines);
}

export function waterproofCalc(v) {
  const area = v.input === 'area' ? v.area : (pos(v.length) && pos(v.width) ? m(v.length) * m(v.width) : null);
  if (!pos(area) || !pos(v.coverage) || !pos(v.coats)) return pending();
  return done([
    ['Area', areaText(area)],
    ['Quantity', `${num((area * v.coats) / v.coverage, 2)} L`],
  ]);
}

export function scaleCalc(v) {
  const factor = v.scale === 'custom' ? Number(v.custom) : Number(v.scale);
  if (!pos(factor) || !pos(v.length)) return pending();
  const drawing = v.direction === 'toDrawing' ? v.length / factor : v.length;
  const actual = v.direction === 'toDrawing' ? v.length : v.length * factor;
  return done([
    ['Scale', `1 : ${num(factor, 3)}`],
    ['On the drawing', lenText(drawing)],
    ['Actual size', lenText(actual)],
  ]);
}

export function stairCalc(v) {
  if (!pos(v.height) || !pos(v.riser)) return pending();
  const nRisers = Math.max(1, Math.round(v.height / v.riser));
  const riser = v.height / nRisers;
  const nTreads = nRisers - 1;
  if (nTreads <= 0) {
    return done([
      ['Risers', String(nRisers)],
      ['Riser height', lenText(riser)],
      ['Treads', '0'],
    ], { note: 'This height is a single riser, so there is no tread or going.' });
  }
  let tread;
  if (pos(v.length)) tread = v.length / nTreads;
  else if (pos(v.tread)) tread = v.tread;
  else return pending();
  const going = nTreads * tread;
  const angle = (Math.atan2(riser, tread) * 180) / Math.PI;
  const slope = nTreads * Math.hypot(riser, tread);
  const blondel = 2 * riser + tread;
  const notes = [];
  if (riser < 150 || riser > 180) notes.push(`Riser is ${num(riser, 0)} mm. A common comfort range is 150–180 mm.`);
  if (blondel < 550 || blondel > 700) notes.push(`2R + T is ${num(blondel, 0)} mm. A common comfort range is 550–700 mm.`);
  if (pos(v.tread) && pos(v.length) && Math.abs(tread - v.tread) > 5) {
    notes.push(`Tread is set by the available length (${num(tread, 0)} mm), not the preferred ${num(v.tread, 0)} mm.`);
  }
  const lines = [
    ['Risers', String(nRisers)],
    ['Riser height', lenText(riser)],
    ['Treads', String(nTreads)],
    ['Tread depth', lenText(tread)],
    ['Total going', lenText(going)],
    ['Stair angle', `${num(angle, 1)}°`],
    ['Approximate length along the slope', lenText(slope)],
  ];
  if (pos(v.width)) lines.push(['Stair width', lenText(v.width)], ['Plan area', areaText(m(going) * m(v.width))]);
  return done(lines, {
    note: notes.join(' '),
    sketch: { type: 'stair', risers: nRisers, tread, riser },
  });
}

export function rampCalc(v) {
  if (!pos(v.rise)) return pending();
  let run;
  if (v.known === 'run') {
    if (!pos(v.run)) return pending();
    run = v.run;
  } else if (v.known === 'percent') {
    if (!pos(v.percent)) return pending();
    run = v.rise / (v.percent / 100);
  } else {
    if (!pos(v.ratio)) return pending();
    run = v.rise * v.ratio;
  }
  return done(slopeLines(slopeFromRiseRun(v.rise, run)), { sketch: { type: 'slope', rise: v.rise, run } });
}

export function slopeCalc(v, mode) {
  if (mode === 'rise-run') {
    if (!pos(v.rise) || !pos(v.run)) return pending();
    return done(slopeLines(slopeFromRiseRun(v.rise, v.run)), { sketch: { type: 'slope', rise: v.rise, run: v.run } });
  }
  if (mode === 'slope-run') {
    if (!pos(v.run) || !Number.isFinite(v.slope) || v.slope <= 0) return pending();
    const rise = v.unit === 'deg'
      ? v.run * Math.tan((v.slope * Math.PI) / 180)
      : v.run * (v.slope / 100);
    if (!pos(rise)) return invalid('That slope does not give a usable rise.');
    return done(slopeLines(slopeFromRiseRun(rise, v.run)), { sketch: { type: 'slope', rise, run: v.run } });
  }
  if (mode === 'percent-ratio') {
    if (!pos(v.percent)) return pending();
    return done([
      ['Slope ratio', `1 : ${num(100 / v.percent, 2)}`],
      ['Angle', `${num((Math.atan(v.percent / 100) * 180) / Math.PI, 2)}°`],
    ]);
  }
  if (!pos(v.ratio)) return pending();
  const pct = 100 / v.ratio;
  return done([
    ['Slope', `${num(pct, 2)}%`],
    ['Angle', `${num((Math.atan(pct / 100) * 180) / Math.PI, 2)}°`],
  ]);
}

export function roofCalc(v) {
  if (!pos(v.length) || !pos(v.width)) return pending();
  const overhang = Number.isFinite(v.overhang) ? v.overhang : 0;
  if (overhang < 0) return invalid('Overhang cannot be negative.');
  let pitch;
  if (v.pitch === 'angle') {
    if (!pos(v.angle) || v.angle >= 90) return pending();
    pitch = Math.tan((v.angle * Math.PI) / 180);
  } else {
    if (!pos(v.rise) || !pos(v.run)) return pending();
    pitch = v.rise / v.run;
  }
  const run = v.width / 2 + overhang;
  const rise = run * pitch;
  const slope = Math.hypot(run, rise);
  const eaves = v.length + overhang * 2;
  const area = 2 * m(slope) * m(eaves);
  const angle = (Math.atan(pitch) * 180) / Math.PI;
  const lines = [
    ['Roof pitch', `1 : ${num(1 / pitch, 2)}`],
    ['Roof angle', `${num(angle, 2)}°`],
    ['Rise', lenText(rise)],
    ['Run (each side)', lenText(run)],
    ['Roof surface', areaText(area)],
  ];
  if (pos(v.coverage)) {
    const waste = Number.isFinite(v.wastage) ? v.wastage : 0;
    lines.push(['Roofing pieces', countText((area * (1 + waste / 100)) / v.coverage, 'nos')]);
  }
  return done(lines, { note: 'Gable roof: two slopes, with the run measured out to the eaves.' });
}

export function openingCalc(v) {
  if (!pos(v.width) || !pos(v.height)) return pending();
  const frame = Number.isFinite(v.frame) ? v.frame : 0;
  if (frame < 0) return invalid('Frame width cannot be negative.');
  const count = pos(v.count) ? v.count : 1;
  const opening = m(v.width) * m(v.height);
  const clearW = v.width - 2 * frame;
  const clearH = v.height - 2 * frame;
  const lines = [
    ['Opening area', areaText(opening)],
    ['Openings', String(count)],
    ['Total opening area', areaText(opening * count)],
  ];
  if (clearW > 0 && clearH > 0 && frame > 0) {
    const clear = m(clearW) * m(clearH);
    lines.push(['Glass / shutter area', areaText(clear)], ['Frame area', areaText(opening - clear)]);
  } else if (frame > 0) {
    return invalid('Frame width is larger than the opening.');
  }
  lines.push(['Opening size', `${lenText(v.width)} × ${lenText(v.height)}`]);
  return done(lines);
}

export function farCalc(v) {
  if (!pos(v.plot)) return pending();
  const lines = [['Plot area', areaText(v.plot)]];
  if (pos(v.fsi)) lines.push(['Maximum built-up from FSI', areaText(v.plot * v.fsi)]);
  if (Number.isFinite(v.coverage) && v.coverage > 0) lines.push(['Ground coverage area', areaText(v.plot * v.coverage / 100)]);
  if (pos(v.built)) lines.push(['Built-up area entered', areaText(v.built)]);
  if (pos(v.carpet)) lines.push(['Carpet area', areaText(v.carpet)]);
  if (pos(v.super)) lines.push(['Super built-up area', areaText(v.super)]);
  if (pos(v.carpet) && pos(v.super)) lines.push(['Efficiency', `${num((v.carpet / v.super) * 100, 1)}%`]);
  else if (pos(v.carpet) && pos(v.built)) lines.push(['Carpet / built-up', `${num((v.carpet / v.built) * 100, 1)}%`]);
  if (lines.length < 2) return pending();
  const over = pos(v.fsi) && pos(v.built) && v.built > v.plot * v.fsi + 1e-6;
  return done(lines, over ? { note: 'The built-up area entered is above plot × FSI.' } : {});
}

export function parkingCalc(v) {
  const cars = Number.isFinite(v.cars) ? v.cars : 0;
  const bikes = Number.isFinite(v.bikes) ? v.bikes : 0;
  if (cars < 0 || bikes < 0) return invalid('Space counts cannot be negative.');
  if (!pos(v.carL) || !pos(v.carW) || !pos(v.bikeL) || !pos(v.bikeW)) return pending();
  if (cars === 0 && bikes === 0) return pending();
  const carBay = m(v.carL) * m(v.carW);
  const bikeBay = m(v.bikeL) * m(v.bikeW);
  const bays = cars * carBay + bikes * bikeBay;
  const circ = Number.isFinite(v.circulation) ? v.circulation : 0;
  return done([
    ['Parking spaces', String(cars + bikes)],
    ['Car spaces', String(cars)],
    ['Two-wheeler spaces', String(bikes)],
    ['Bay area', areaText(bays)],
    ['Approximate area with circulation', areaText(bays * (1 + circ / 100))],
  ]);
}

const STEEL_KG = { slab: 80, beam: 120, column: 150, footing: 60 };

export function barKgPerM(diaMm) {
  return (diaMm * diaMm) / 162;
}

export function structuralCalc(v) {
  let vol = null;
  if (v.member === 'slab') {
    if (!pos(v.length) || !pos(v.width) || !pos(v.thickness)) return pending();
    vol = boxVolume(v.length, v.width, v.thickness);
  } else if (v.member === 'beam') {
    if (!pos(v.length) || !pos(v.breadth) || !pos(v.depth)) return pending();
    vol = boxVolume(v.breadth, v.depth, v.length) * (pos(v.count) ? v.count : 1);
  } else if (v.member === 'column') {
    const count = pos(v.count) ? v.count : 1;
    if (!pos(v.height)) return pending();
    const one = v.section === 'round'
      ? (pos(v.diameter) ? Math.PI * m(v.diameter / 2) ** 2 * m(v.height) : null)
      : (pos(v.breadth) && pos(v.depth) ? boxVolume(v.breadth, v.depth, v.height) : null);
    if (!pos(one)) return pending();
    vol = one * count;
  } else {
    if (!pos(v.length) || !pos(v.footingW) || !pos(v.footingD)) return pending();
    vol = boxVolume(v.length, v.footingW, v.footingD) * (pos(v.count) ? v.count : 1);
  }
  const lines = [['Concrete volume', volText(vol)]];
  if (v.steel === 'bars') {
    const bars = (v.bars || []).filter((b) => pos(b.dia) && pos(b.count) && pos(b.length));
    if (!bars.length) return pending();
    const kg = bars.reduce((s, b) => s + b.count * m(b.length) * barKgPerM(b.dia), 0);
    lines.push(['Steel', `${num(kg, 2)} kg`]);
  } else {
    const rate = pos(v.kgm3) ? v.kgm3 : STEEL_KG[v.member];
    lines.push(['Steel', `${num(vol * rate, 1)} kg`], ['Steel rate used', `${num(rate, 1)} kg/m³`]);
  }
  return done(lines, { note: 'Bar weight uses d²/162 kilograms per metre, with the diameter in millimetres. Blank kg/m³ uses a rough allowance: 80 slab, 120 beam, 150 column, 60 footing.' });
}

export function solarCalc(v) {
  const lines = [];
  if (pos(v.window) && pos(v.floor)) lines.push(['Window-to-floor ratio', `${num((v.window / v.floor) * 100, 1)}%`]);
  if (pos(v.opening) && pos(v.wall)) lines.push(['Opening ratio', `${num((v.opening / v.wall) * 100, 1)}%`]);
  const alt = v.altitude;
  if (Number.isFinite(alt) && alt > 0 && alt < 90) {
    const tan = Math.tan((alt * Math.PI) / 180);
    if (pos(v.overhang)) lines.push(['Shade depth on the wall', lenText(v.overhang * tan)]);
    if (pos(v.shade)) lines.push(['Overhang for that shade', lenText(v.shade / tan)]);
  }
  if (!lines.length) return pending();
  return done(lines);
}

export function costCalc(v) {
  const rows = (v.lines || []).map((line) => {
    if (!pos(line.qty) || !Number.isFinite(line.rate)) return null;
    const waste = Number.isFinite(line.wastage) ? line.wastage : 0;
    if (waste < 0) return { error: true };
    const qty = line.qty * (1 + waste / 100);
    return {
      name: line.name || 'Item',
      unit: line.unit || '',
      amount: qty * line.rate,
      qty,
    };
  });
  if (rows.some((r) => r?.error)) return invalid('Wastage cannot be negative.');
  const ready = rows.filter(Boolean);
  if (!ready.length) return pending();
  const total = ready.reduce((s, r) => s + r.amount, 0);
  const money = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
  return done([
    ['Preliminary total', money(total)],
    ...ready.map((r) => [r.name, `${money(r.amount)}${r.unit ? ` · ${num(r.qty, 3)} ${r.unit}` : ''}`]),
  ]);
}

const FNS = {
  units: unitsCalc,
  area: areaCalc,
  volume: volumeCalc,
  concrete: concreteCalc,
  brick: brickCalc,
  block: blockCalc,
  plaster: plasterCalc,
  flooring: flooringCalc,
  tile: tileCalc,
  paint: paintCalc,
  waterproof: waterproofCalc,
  scale: scaleCalc,
  stair: stairCalc,
  ramp: rampCalc,
  slope: slopeCalc,
  roof: roofCalc,
  opening: openingCalc,
  far: farCalc,
  parking: parkingCalc,
  structural: structuralCalc,
  solar: solarCalc,
  cost: costCalc,
};

export function runCalculator(id, mode, values) {
  const fn = FNS[id];
  if (!fn) return invalid('Unknown calculator.');
  return fn(values, mode);
}

export function resultText(result) {
  if (!result?.lines?.length) return '';
  return result.lines.map((l) => `${l.label}: ${l.value}`).join('\n');
}
