// Local arithmetic. No eval, no units, no React.

const ARITH = new Set(['+', '-', 'mul', 'div']);

function formatResult(value) {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round((value + Number.EPSILON) * 1e10) / 1e10;
  if (Object.is(rounded, -0) || Math.abs(rounded) < 1e-10) return '0';
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
  return String(rounded);
}

/**
 * @returns {{ value: number } | { incomplete: true } | null}
 * null means this is not a finished or unfinished arithmetic expression.
 */
export function evaluateArithmetic(tokens) {
  let index = 0;
  const peek = () => tokens[index];
  const eat = () => tokens[index++];

  function parseAdd() {
    let left = parseMul();
    if (!left || left.incomplete) return left;
    while (peek()?.type === 'op' && (peek().op === '+' || peek().op === '-')) {
      const op = eat().op;
      if (!peek()) return { incomplete: true };
      const right = parseMul();
      if (!right) return null;
      if (right.incomplete) return { incomplete: true };
      left = { value: op === '+' ? left.value + right.value : left.value - right.value };
    }
    return left;
  }

  function parseMul() {
    let left = parseUnary();
    if (!left || left.incomplete) return left;
    while (peek()?.type === 'op' && (peek().op === 'mul' || peek().op === 'div')) {
      const op = eat().op;
      if (!peek()) return { incomplete: true };
      const right = parseUnary();
      if (!right) return null;
      if (right.incomplete) return { incomplete: true };
      if (op === 'div' && right.value === 0) return null;
      left = { value: op === 'mul' ? left.value * right.value : left.value / right.value };
    }
    return left;
  }

  function parseUnary() {
    if (peek()?.type === 'op' && (peek().op === '-' || peek().op === '+')) {
      const op = eat().op;
      if (!peek()) return { incomplete: true };
      const value = parseUnary();
      if (!value || value.incomplete) return value;
      return { value: op === '-' ? -value.value : value.value };
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const token = peek();
    if (!token) return { incomplete: true };
    if (token.type === 'paren' && token.side === '(') {
      eat();
      if (!peek()) return { incomplete: true };
      const inner = parseAdd();
      if (!inner) return null;
      if (inner.incomplete) return inner;
      if (!peek()) return { incomplete: true };
      if (peek().type !== 'paren' || peek().side !== ')') return null;
      eat();
      return inner;
    }
    if (token.type === 'number') {
      eat();
      return { value: token.value };
    }
    return null;
  }

  const parsed = parseAdd();
  if (!parsed) return null;
  if (parsed.incomplete) return parsed;
  if (index < tokens.length) return null;
  const text = formatResult(parsed.value);
  if (text == null) return null;
  return { value: parsed.value, text };
}

export function isArithmeticToken(token) {
  if (token.type === 'number' || token.type === 'paren') return true;
  return token.type === 'op' && ARITH.has(token.op);
}
