import { evaluateArithmetic, isArithmeticToken } from '../arithmetic';

const arithmeticRule = {
  id: 'arithmetic',
  mode: null,
  title: 'Calculation',
  keywords: [],
  required: [],
  optional: [],
  answer: 'Calculation',
  immediate: true,
  partial: [],
  priority: 5,
  pattern(tokens) {
    if (!tokens.length || tokens.some((token) => !isArithmeticToken(token))) return null;
    const used = tokens.map((_, index) => index);
    const hasMark = tokens.some((token) => token.type === 'op' || token.type === 'paren');
    if (!hasMark) return { incomplete: true, quiet: true, used };
    const parsed = evaluateArithmetic(tokens);
    if (!parsed) return null;
    if (parsed.incomplete) return { incomplete: true, used };
    return {
      values: {},
      used,
      outcome: {
        ok: true,
        summary: parsed.text,
        lines: [{ label: 'Calculation', value: parsed.text }],
      },
    };
  },
};

export default arithmeticRule;
