// Calculator directory. Field definitions only — the maths lives in calc.js.

export const CATEGORIES = [
  ['measure', 'Measurements & Units'],
  ['area', 'Area & Geometry'],
  ['volume', 'Volume'],
  ['materials', 'Materials & Quantity'],
  ['design', 'Building Design'],
  ['drawing', 'Drawing & Scale'],
  ['cost', 'Cost / Basic Estimation'],
];

const categoryName = Object.fromEntries(CATEGORIES);

const len = (key, label, unit = 'm', extra = {}) => ({ key, label, type: 'length', unit, ...extra });
const area = (key, label, extra = {}) => ({ key, label, type: 'area', unit: 'm2', ...extra });
const vol = (key, label, extra = {}) => ({ key, label, type: 'volume', unit: 'm3', ...extra });
const mass = (key, label, extra = {}) => ({ key, label, type: 'mass', unit: 'kg', ...extra });
const num = (key, label, extra = {}) => ({ key, label, type: 'number', ...extra });
const text = (key, label, extra = {}) => ({ key, label, type: 'text', ...extra });
const sel = (key, label, options, extra = {}) => ({ key, label, type: 'select', options, ...extra });
const show = (key, value, field) => ({ ...field, when: Array.isArray(value) ? { key, in: value } : { key, value } });

const wall = (key = 'walls') => ({
  key,
  label: 'Walls',
  type: 'repeat',
  itemLabel: 'Wall',
  addLabel: 'Add wall',
  fields: [len('length', 'Length'), len('height', 'Height')],
});

const PRELIM = 'Preliminary quantity. Confirm sizes, mix, and wastage before ordering.';
const NOT_CODE = 'Preliminary only. This is not a substitute for checking the rules that apply to the site.';
const NOT_STRUCT = 'Preliminary estimate only. This is not a substitute for structural engineering calculations.';
const NOT_SOLAR = 'Preliminary design aid for daylight and shading. Not a solar or energy study.';

const SCALES = [['10', '1 : 10'], ['20', '1 : 20'], ['25', '1 : 25'], ['50', '1 : 50'], ['75', '1 : 75'], ['100', '1 : 100'], ['200', '1 : 200'], ['500', '1 : 500'], ['custom', 'Custom']];

export const CALCULATORS = [
  {
    id: 'units',
    title: 'Unit converter',
    category: 'measure',
    blurb: 'Feet and inches, metric, area, volume, weight, percentage, ratio, fractions',
    keywords: 'feet inches mm cm metre meter sq ft sqft cu ft convert percentage ratio decimal fraction architectural',
    modes: [
      { id: 'length', label: 'Length', keywords: 'feet inches mm', fields: [len('value', 'Length', 'mm', { hint: 'Try 12\'-6" or 15\'-4" or 1200 mm' })] },
      { id: 'area', label: 'Area', keywords: 'sq ft sqft square', fields: [area('value', 'Area')] },
      { id: 'volume', label: 'Volume', keywords: 'cu ft cubic litre', fields: [vol('value', 'Volume')] },
      { id: 'weight', label: 'Weight', keywords: 'kg lb tonne', fields: [mass('value', 'Weight')] },
      {
        id: 'percent',
        label: 'Percentage',
        keywords: 'percent %',
        fields: [
          sel('kind', 'Find', [['of', 'A percentage of a number'], ['what', 'What percentage one number is'], ['change', 'Percentage change']], { default: 'of' }),
          show('kind', 'of', num('percent', 'Percentage')),
          show('kind', 'of', num('whole', 'Of')),
          show('kind', 'what', num('part', 'Part')),
          show('kind', 'what', num('whole', 'Whole')),
          show('kind', 'change', num('from', 'From')),
          show('kind', 'change', num('to', 'To')),
        ],
      },
      { id: 'ratio', label: 'Ratio', keywords: 'ratio proportion', fields: [num('a', 'A'), num('b', 'B')] },
      { id: 'fraction', label: 'Fraction', keywords: 'decimal fraction', fields: [text('text', 'Decimal or fraction', { hint: '0.5, 1/2, or 4 1/2' })] },
    ],
  },
  {
    id: 'area',
    title: 'Area',
    category: 'area',
    blurb: 'Rectangles, circles, polygons, and a combined room total',
    keywords: 'rectangle square triangle circle semicircle trapezoid polygon room geometry',
    modes: [
      { id: 'rectangle', label: 'Rectangle', keywords: 'rectangle', fields: [len('length', 'Length'), len('width', 'Width')] },
      { id: 'square', label: 'Square', keywords: 'square', fields: [len('side', 'Side')] },
      {
        id: 'triangle',
        label: 'Triangle',
        keywords: 'triangle heron',
        fields: [
          sel('method', 'Known', [['base', 'Base and height'], ['sides', 'Three sides']], { default: 'base' }),
          show('method', 'base', len('base', 'Base')),
          show('method', 'base', len('height', 'Height')),
          show('method', 'sides', len('a', 'Side A')),
          show('method', 'sides', len('b', 'Side B')),
          show('method', 'sides', len('c', 'Side C')),
        ],
      },
      {
        id: 'circle',
        label: 'Circle',
        keywords: 'circle radius diameter',
        fields: [
          sel('known', 'Known', [['radius', 'Radius'], ['diameter', 'Diameter']], { default: 'radius' }),
          show('known', 'radius', len('radius', 'Radius')),
          show('known', 'diameter', len('diameter', 'Diameter')),
        ],
      },
      {
        id: 'semicircle',
        label: 'Semi-circle',
        keywords: 'semicircle semi circle',
        fields: [
          sel('known', 'Known', [['radius', 'Radius'], ['diameter', 'Diameter']], { default: 'radius' }),
          show('known', 'radius', len('radius', 'Radius')),
          show('known', 'diameter', len('diameter', 'Diameter')),
        ],
      },
      { id: 'trapezoid', label: 'Trapezoid', keywords: 'trapezoid trapezium', fields: [len('a', 'Parallel side A'), len('b', 'Parallel side B'), len('height', 'Height between them')] },
      {
        id: 'polygon',
        label: 'Irregular polygon',
        keywords: 'polygon irregular shoelace',
        fields: [{
          key: 'points', label: 'Vertices, in order', type: 'repeat', seed: 3, min: 3, itemLabel: 'Point', addLabel: 'Add point',
          fields: [len('x', 'X'), len('y', 'Y')],
        }],
      },
      {
        id: 'rooms',
        label: 'Several rooms',
        keywords: 'room rooms combined total',
        fields: [{
          key: 'rooms', label: 'Spaces', type: 'repeat', itemLabel: 'Space', addLabel: 'Add space',
          fields: [text('name', 'Name', { hint: 'Optional' }), len('length', 'Length'), len('width', 'Width')],
        }],
      },
    ],
  },
  {
    id: 'volume',
    title: 'Volume',
    category: 'volume',
    blurb: 'Rooms, concrete, excavation, tanks, and structural members',
    keywords: 'room concrete excavation tank column beam slab footing volume',
    modes: [
      { id: 'room', label: 'Room', keywords: 'room', fields: [len('length', 'Length'), len('width', 'Width'), len('height', 'Height')] },
      { id: 'concrete', label: 'Concrete', keywords: 'concrete', fields: [len('length', 'Length'), len('width', 'Width'), len('depth', 'Depth')] },
      { id: 'excavation', label: 'Excavation', keywords: 'excavation dig', fields: [len('length', 'Length'), len('width', 'Width'), len('depth', 'Depth'), num('bulking', 'Bulking %', { default: '0', hint: 'Leave at 0 for bank volume only' })] },
      {
        id: 'tank',
        label: 'Tank',
        keywords: 'tank water litre',
        fields: [
          sel('shape', 'Shape', [['rect', 'Rectangular'], ['cylinder', 'Cylindrical']], { default: 'rect' }),
          show('shape', 'rect', len('length', 'Length')),
          show('shape', 'rect', len('width', 'Width')),
          show('shape', 'cylinder', len('diameter', 'Diameter')),
          len('height', 'Height'),
        ],
      },
      {
        id: 'column',
        label: 'Column',
        keywords: 'column',
        fields: [
          sel('section', 'Section', [['rect', 'Rectangular'], ['round', 'Circular']], { default: 'rect' }),
          show('section', 'rect', len('width', 'Width', 'mm')),
          show('section', 'rect', len('depth', 'Depth', 'mm')),
          show('section', 'round', len('diameter', 'Diameter', 'mm')),
          len('height', 'Height'),
          num('count', 'Number of columns', { default: '1' }),
        ],
      },
      { id: 'beam', label: 'Beam', keywords: 'beam', fields: [len('width', 'Width', 'mm'), len('depth', 'Depth', 'mm'), len('length', 'Length'), num('count', 'Number of beams', { default: '1' })] },
      { id: 'slab', label: 'Slab', keywords: 'slab', fields: [len('length', 'Length'), len('width', 'Width'), len('thickness', 'Thickness', 'mm')] },
      { id: 'footing', label: 'Footing', keywords: 'footing foundation', fields: [len('length', 'Length'), len('width', 'Width'), len('depth', 'Depth'), num('count', 'Number of footings', { default: '1' })] },
    ],
  },
  {
    id: 'concrete',
    title: 'Concrete',
    category: 'materials',
    blurb: 'Cement, sand, and aggregate from a nominal mix',
    keywords: 'concrete cement sand aggregate bags mix m20',
    note: PRELIM,
    fields: [
      sel('input', 'Calculate from', [['size', 'Length × width × depth'], ['volume', 'A known volume']], { default: 'size' }),
      show('input', 'size', len('length', 'Length')),
      show('input', 'size', len('width', 'Width')),
      show('input', 'size', len('depth', 'Depth')),
      show('input', 'volume', vol('volume', 'Volume')),
      sel('mix', 'Nominal mix', [['1:1.5:3', '1 : 1.5 : 3'], ['1:2:4', '1 : 2 : 4'], ['1:3:6', '1 : 3 : 6'], ['1:4:8', '1 : 4 : 8']], { default: '1:2:4' }),
      num('wastage', 'Wastage %', { default: '0' }),
    ],
  },
  {
    id: 'brick',
    title: 'Brickwork',
    category: 'materials',
    blurb: 'Brick count and mortar for a wall',
    keywords: 'brick brickwork masonry mortar',
    note: PRELIM,
    fields: [
      len('length', 'Wall length'),
      len('height', 'Wall height'),
      len('thickness', 'Wall thickness', 'mm'),
      sel('size', 'Brick size', [['traditional', 'Traditional 230 × 110 × 70'], ['modular', 'Modular 190 × 90 × 90'], ['custom', 'Custom']], { default: 'traditional' }),
      show('size', 'custom', len('unitL', 'Brick length', 'mm')),
      show('size', 'custom', len('unitH', 'Brick height', 'mm')),
      show('size', 'custom', len('unitT', 'Brick thickness', 'mm')),
      num('joint', 'Mortar joint (mm)', { default: '10' }),
      sel('mix', 'Mortar mix', [['1:6', '1 : 6'], ['1:5', '1 : 5'], ['1:4', '1 : 4']], { default: '1:6' }),
    ],
  },
  {
    id: 'block',
    title: 'Blockwork',
    category: 'materials',
    blurb: 'Block count and mortar for a wall',
    keywords: 'block blockwork aac masonry',
    note: PRELIM,
    fields: [
      len('length', 'Wall length'),
      len('height', 'Wall height'),
      len('thickness', 'Wall thickness', 'mm'),
      sel('size', 'Block size', [['full', '400 × 200 × 200'], ['half', '400 × 200 × 100'], ['custom', 'Custom']], { default: 'full' }),
      show('size', 'custom', len('unitL', 'Block length', 'mm')),
      show('size', 'custom', len('unitH', 'Block height', 'mm')),
      show('size', 'custom', len('unitT', 'Block thickness', 'mm')),
      num('joint', 'Mortar joint (mm)', { default: '10' }),
      sel('mix', 'Mortar mix', [['1:6', '1 : 6'], ['1:4', '1 : 4']], { default: '1:6' }),
    ],
  },
  {
    id: 'plaster',
    title: 'Plaster',
    category: 'materials',
    blurb: 'Plaster area, mortar, cement, and sand',
    keywords: 'plaster mortar cement sand',
    note: PRELIM,
    fields: [
      sel('input', 'Calculate from', [['walls', 'Wall sizes'], ['area', 'A known area']], { default: 'walls' }),
      show('input', 'walls', wall()),
      show('input', 'area', area('area', 'Area')),
      len('thickness', 'Thickness', 'mm', { default: '12' }),
      sel('mix', 'Mix', [['1:6', '1 : 6'], ['1:4', '1 : 4']], { default: '1:6' }),
    ],
  },
  {
    id: 'flooring',
    title: 'Flooring',
    category: 'materials',
    blurb: 'Floor area with a wastage allowance',
    keywords: 'floor flooring area wastage tile tiles',
    note: PRELIM,
    fields: [
      sel('input', 'Calculate from', [['size', 'Length × width'], ['area', 'A known area']], { default: 'size' }),
      show('input', 'size', len('length', 'Length')),
      show('input', 'size', len('width', 'Width')),
      show('input', 'area', area('area', 'Area')),
      num('wastage', 'Wastage %', { default: '5' }),
    ],
  },
  {
    id: 'tile',
    title: 'Tile Quantity',
    category: 'materials',
    blurb: 'Calculate tile count and wastage',
    keywords: 'tile tiles flooring wall box wastage',
    note: PRELIM,
    fields: [
      sel('input', 'Area from', [['size', 'Length × width'], ['area', 'A known area']], { default: 'size' }),
      show('input', 'size', len('length', 'Length')),
      show('input', 'size', len('width', 'Width')),
      show('input', 'area', area('area', 'Area')),
      len('tileW', 'Tile width', 'mm', { default: '600' }),
      len('tileH', 'Tile height', 'mm', { default: '600' }),
      num('wastage', 'Wastage %', { default: '10' }),
      num('perBox', 'Tiles per box', { default: '4' }),
    ],
  },
  {
    id: 'paint',
    title: 'Paint',
    category: 'materials',
    blurb: 'Paintable area, paint, and primer after openings',
    keywords: 'paint painting primer coats wall finish coverage',
    note: PRELIM,
    fields: [
      wall(),
      { key: 'openings', label: 'Doors, windows, and other openings', type: 'repeat', seed: 0, itemLabel: 'Opening', addLabel: 'Add opening', fields: [len('width', 'Width'), len('height', 'Height'), num('count', 'Count', { default: '1' })] },
      num('coats', 'Paint coats', { default: '2' }),
      num('coverage', 'Paint coverage (m² per litre)', { default: '10' }),
      num('primerCoats', 'Primer coats', { default: '1' }),
      num('primerCoverage', 'Primer coverage (m² per litre)', { default: '10' }),
    ],
  },
  {
    id: 'waterproof',
    title: 'Waterproofing',
    category: 'materials',
    blurb: 'Coating quantity from area, coats, and coverage',
    keywords: 'waterproof waterproofing coating terrace',
    note: PRELIM,
    fields: [
      sel('input', 'Calculate from', [['size', 'Length × width'], ['area', 'A known area']], { default: 'size' }),
      show('input', 'size', len('length', 'Length')),
      show('input', 'size', len('width', 'Width')),
      show('input', 'area', area('area', 'Area')),
      num('coats', 'Coats', { default: '2' }),
      num('coverage', 'Coverage (m² per litre, per coat)', { default: '1' }),
    ],
  },
  {
    id: 'scale',
    title: 'Drawing scale',
    category: 'drawing',
    blurb: 'Drawing measure to actual size, and back',
    keywords: 'scale drawing 1:100 1:50 actual',
    fields: [
      sel('scale', 'Scale', SCALES, { default: '100' }),
      show('scale', 'custom', num('custom', 'Custom scale 1 :')),
      sel('direction', 'Convert', [['toActual', 'Drawing → actual'], ['toDrawing', 'Actual → drawing']], { default: 'toActual' }),
      len('length', 'Measurement', 'mm'),
    ],
  },
  {
    id: 'stair',
    title: 'Staircase',
    category: 'design',
    blurb: 'Risers, treads, going, and stair angle',
    keywords: 'stair staircase riser tread going step',
    fields: [
      len('height', 'Floor-to-floor height'),
      len('length', 'Available length', 'm', { hint: 'Optional. Used to fit the treads.' }),
      len('width', 'Stair width', 'm', { hint: 'Optional' }),
      len('riser', 'Preferred riser', 'mm', { default: '150' }),
      len('tread', 'Preferred tread', 'mm', { default: '250', hint: 'Used when available length is empty' }),
    ],
  },
  {
    id: 'ramp',
    title: 'Ramp',
    category: 'design',
    blurb: 'Length, rise, run, gradient, and slope',
    keywords: 'ramp gradient slope accessibility stair staircase',
    fields: [
      len('rise', 'Rise'),
      sel('known', 'Also known', [['run', 'Run'], ['percent', 'Slope %'], ['ratio', 'Ratio 1 : n']], { default: 'run' }),
      show('known', 'run', len('run', 'Run')),
      show('known', 'percent', num('percent', 'Slope %')),
      show('known', 'ratio', num('ratio', 'n in 1 : n', { hint: '12 gives a 1 : 12 ramp' })),
    ],
  },
  {
    id: 'slope',
    title: 'Slope',
    category: 'design',
    blurb: 'Rise and run, percentage, and ratio',
    keywords: 'slope gradient percent ratio rise run',
    modes: [
      { id: 'rise-run', label: 'Rise + run', keywords: 'rise run', fields: [len('rise', 'Rise'), len('run', 'Run')] },
      {
        id: 'slope-run',
        label: 'Slope + run',
        keywords: 'slope run rise',
        fields: [
          num('slope', 'Slope'),
          sel('unit', 'Slope as', [['percent', 'Percentage'], ['deg', 'Degrees']], { default: 'percent' }),
          len('run', 'Run'),
        ],
      },
      { id: 'percent-ratio', label: 'Percentage → ratio', keywords: 'percentage ratio', fields: [num('percent', 'Slope %')] },
      { id: 'ratio-percent', label: 'Ratio → percentage', keywords: 'ratio percentage', fields: [num('ratio', 'n in 1 : n')] },
    ],
  },
  {
    id: 'roof',
    title: 'Roof',
    category: 'design',
    blurb: 'Pitch, angle, rise, and gable roof area',
    keywords: 'roof pitch angle rise run gable sheet',
    note: PRELIM,
    fields: [
      len('length', 'Building length'),
      len('width', 'Building width'),
      len('overhang', 'Eaves overhang', 'mm', { default: '0', hint: 'Horizontal, each side. 0 if none.' }),
      sel('pitch', 'Pitch given as', [['ratio', 'Rise and run'], ['angle', 'Angle']], { default: 'ratio' }),
      show('pitch', 'ratio', num('rise', 'Rise', { default: '4' })),
      show('pitch', 'ratio', num('run', 'Run', { default: '12' })),
      show('pitch', 'angle', num('angle', 'Angle (degrees)', { default: '20' })),
      num('coverage', 'Sheet coverage (m²)', { hint: 'Optional. Leave empty to skip the piece count.' }),
      num('wastage', 'Wastage %', { default: '10' }),
    ],
  },
  {
    id: 'opening',
    title: 'Doors and windows',
    category: 'design',
    blurb: 'Opening, frame, glass, and shutter area',
    keywords: 'door window opening frame glass shutter',
    fields: [
      len('width', 'Opening width'),
      len('height', 'Opening height'),
      len('frame', 'Frame width', 'mm', { default: '50', hint: 'Border taken off each side for the clear opening' }),
      num('count', 'Number of openings', { default: '1' }),
    ],
  },
  {
    id: 'far',
    title: 'FAR / FSI',
    category: 'design',
    blurb: 'Built-up, coverage, carpet, and efficiency',
    keywords: 'far fsi built-up builtup carpet coverage super efficiency plot',
    note: NOT_CODE,
    fields: [
      area('plot', 'Plot area'),
      num('fsi', 'FSI / FAR', { hint: 'Optional' }),
      num('coverage', 'Ground coverage %', { hint: 'Optional' }),
      area('built', 'Built-up area', { hint: 'Optional' }),
      area('carpet', 'Carpet area', { hint: 'Optional' }),
      area('super', 'Super built-up area', { hint: 'Optional' }),
    ],
  },
  {
    id: 'parking',
    title: 'Parking',
    category: 'design',
    blurb: 'Car and two-wheeler bays, and an approximate area',
    keywords: 'parking car bike two wheeler bay',
    note: 'Preliminary bay area only. Not a regulatory compliance result.',
    fields: [
      num('cars', 'Car spaces', { default: '1' }),
      num('bikes', 'Two-wheeler spaces', { default: '0' }),
      len('carL', 'Car bay length', 'm', { default: '5' }),
      len('carW', 'Car bay width', 'm', { default: '2.5' }),
      len('bikeL', 'Two-wheeler bay length', 'm', { default: '2' }),
      len('bikeW', 'Two-wheeler bay width', 'm', { default: '1' }),
      num('circulation', 'Circulation %', { default: '35', hint: 'Added on top of the bay area' }),
    ],
  },
  {
    id: 'structural',
    title: 'Structural quantities',
    category: 'design',
    blurb: 'Member volume and a rough steel weight',
    keywords: 'steel reinforcement slab beam column footing bar structural',
    note: NOT_STRUCT,
    fields: [
      sel('member', 'Member', [['slab', 'Slab'], ['beam', 'Beam'], ['column', 'Column'], ['footing', 'Footing']], { default: 'slab' }),
      show('member', 'column', sel('section', 'Section', [['rect', 'Rectangular'], ['round', 'Circular']], { default: 'rect' })),
      show('member', ['slab', 'beam', 'footing'], len('length', 'Length')),
      show('member', 'slab', len('width', 'Width')),
      show('member', 'slab', len('thickness', 'Thickness', 'mm')),
      {
        ...len('breadth', 'Width', 'mm'),
        when: { any: [{ key: 'member', value: 'beam' }, { all: [{ key: 'member', value: 'column' }, { key: 'section', value: 'rect' }] }] },
      },
      {
        ...len('depth', 'Depth', 'mm'),
        when: { any: [{ key: 'member', in: ['beam'] }, { all: [{ key: 'member', value: 'column' }, { key: 'section', value: 'rect' }] }] },
      },
      show('member', 'footing', len('footingW', 'Width')),
      show('member', 'footing', len('footingD', 'Depth')),
      { ...len('diameter', 'Diameter', 'mm'), when: { all: [{ key: 'member', value: 'column' }, { key: 'section', value: 'round' }] } },
      show('member', 'column', len('height', 'Height')),
      show('member', ['beam', 'column', 'footing'], num('count', 'Count', { default: '1' })),
      sel('steel', 'Steel from', [['rate', 'kg per m³'], ['bars', 'A bar list']], { default: 'rate' }),
      show('steel', 'rate', num('kgm3', 'kg per m³', { hint: 'Blank uses 80 slab, 120 beam, 150 column, 60 footing' })),
      show('steel', 'bars', {
        key: 'bars', label: 'Bars', type: 'repeat', itemLabel: 'Bar', addLabel: 'Add bar',
        fields: [num('dia', 'Diameter (mm)', { default: '12' }), num('count', 'Number', { default: '1' }), len('length', 'Length')],
      }),
    ],
  },
  {
    id: 'solar',
    title: 'Daylight and shading',
    category: 'design',
    blurb: 'Window-to-floor ratio, opening ratio, and a simple overhang shade',
    keywords: 'solar daylight window floor ratio shading overhang sun',
    note: NOT_SOLAR,
    fields: [
      area('window', 'Window area', { hint: 'Optional' }),
      area('floor', 'Floor area', { hint: 'Optional' }),
      area('opening', 'Opening area', { hint: 'Optional' }),
      area('wall', 'Wall area', { hint: 'Optional' }),
      len('overhang', 'Overhang depth', 'mm', { hint: 'Optional' }),
      len('shade', 'Shade depth you want', 'mm', { hint: 'Optional' }),
      num('altitude', 'Solar altitude (degrees)', { hint: 'Angle of the sun above the horizon' }),
    ],
  },
  {
    id: 'cost',
    title: 'Cost estimate',
    category: 'cost',
    blurb: 'Quantity × rate, with wastage. Not linked to project money.',
    keywords: 'cost estimate rate quantity wastage price',
    note: 'A standalone sum. It does not read or write project budgets, invoices, or the Money module.',
    fields: [{
      key: 'lines',
      label: 'Items',
      type: 'repeat',
      itemLabel: 'Item',
      addLabel: 'Add item',
      fields: [
        text('name', 'Item'),
        num('qty', 'Quantity'),
        text('unit', 'Unit', { hint: 'm², bag, nos…' }),
        num('rate', 'Rate'),
        num('wastage', 'Wastage %', { default: '0' }),
      ],
    }],
  },
];

export function categoryLabel(id) {
  return categoryName[id] || id;
}

export function calculatorById(id) {
  return CALCULATORS.find((c) => c.id === id) || null;
}

export function fieldsFor(calc, mode) {
  if (!calc) return [];
  if (calc.modes?.length) return (calc.modes.find((m) => m.id === mode) || calc.modes[0]).fields;
  return calc.fields;
}

export function defaultMode(calc) {
  return calc?.modes?.[0]?.id || null;
}

export function matchMode(calc, q) {
  const terms = String(q || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length || !calc?.modes) return null;
  let best = null;
  calc.modes.forEach((m) => {
    const keys = `${m.label} ${m.keywords || ''}`.toLowerCase();
    const score = terms.filter((t) => keys.includes(t)).length;
    if (score && (!best || score > best.score)) best = { id: m.id, score };
  });
  return best?.id || null;
}

export function searchCalculators(q) {
  const terms = String(q || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const hits = [];
  CALCULATORS.forEach((c) => {
    const title = c.title.toLowerCase();
    const keys = `${c.keywords}`.toLowerCase();
    if (!terms.every((t) => title.includes(t) || keys.includes(t))) return;
    const score = terms.reduce((sum, t) => sum + (title.startsWith(t) ? 5 : title.includes(t) ? 3 : 1), 0);
    hits.push({ id: c.id, mode: matchMode(c, q), title: c.title, blurb: c.blurb, category: c.category, score });
  });
  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  if (terms.every((t) => t.length > 2 && 'saved calculations history'.includes(t))) {
    hits.push({ id: 'history', title: 'Saved calculations', blurb: 'History', category: 'history' });
  }
  return hits;
}
