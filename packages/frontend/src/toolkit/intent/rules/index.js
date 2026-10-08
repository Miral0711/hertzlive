import { CALCULATORS } from '../../catalog';
import areaRule from './area';
import arithmeticRule from './arithmetic';
import conversionRule from './conversion';
import concreteRule from './concrete';
import lengthRule from './length';
import scaleRule from './scale';
import slabRule from './slab';
import slopeRule from './slope';
import stairRule from './staircase';
import tileRule from './tile';

const CUSTOM = [arithmeticRule, conversionRule, areaRule, tileRule, stairRule, scaleRule, slopeRule, slabRule, lengthRule, concreteRule];
const covered = new Set(CUSTOM.map((rule) => rule.id));

function wordsOf(calc) {
  return `${calc.title} ${calc.keywords || ''}`
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((word) => word.length > 2);
}

function keywordRule(calc) {
  return {
    id: calc.id,
    mode: null,
    keywords: wordsOf(calc),
    required: [],
    optional: [],
    immediate: false,
    partial: [],
    priority: 50,
    pattern() { return null; },
  };
}

const volumeBrowse = {
  id: 'volume',
  mode: null,
  partialLabel: 'Volume',
  keywords: ['volume', 'room', 'excavation', 'tank', 'column', 'beam', 'footing'],
  required: [],
  optional: [],
  immediate: false,
  partial: ['length'],
  priority: 30,
  seed(tokens) {
    const length = tokens.find((token) => token.type === 'length');
    if (!length) return null;
    return { length: length.text, lengthUnit: length.unit };
  },
  pattern() { return null; },
};

export const RULES = [
  ...CUSTOM,
  volumeBrowse,
  ...CALCULATORS.filter((calc) => !covered.has(calc.id)).map(keywordRule),
];
