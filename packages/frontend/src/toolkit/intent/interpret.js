// Match-count loop. Calculator names live in the rule files, not here.

import { calculatorById, fieldsFor } from '../catalog';
import { runCalculator } from '../calc';
import { initialValues, normalize } from '../read';
import { normalizeTokens } from './language';
import { RULES } from './rules/index';
import { tokenize } from './tokenize';

const MEASURE = new Set(['length', 'number', 'area', 'volume', 'size', 'percent', 'ratio']);

function unexplained(tokens, used) {
  const have = new Set(used || []);
  return tokens.some((_, index) => !have.has(index));
}

function satisfied(rule, found) {
  return (rule.required || []).every((key) => {
    const value = found.values?.[key];
    return value != null && String(value).trim() !== '';
  });
}

function titleFor(rule, partial) {
  if (partial && rule.partialLabel) return rule.partialLabel;
  return rule.title || calculatorById(rule.id)?.title || rule.id;
}

function toChoice(rule, found, partial) {
  const named = partial && rule.partialLabel;
  return {
    id: rule.id,
    mode: found?.mode || rule.mode || null,
    title: named ? rule.partialLabel : (found?.title || titleFor(rule, false)),
    blurb: partial ? '' : (rule.blurb || calculatorById(rule.id)?.blurb || ''),
    values: found?.values || null,
    assumption: found?.assumption || '',
    priority: rule.priority ?? 100,
  };
}

function present(rule, found, outcome) {
  const wanted = [].concat(rule.answer || outcome.lines[0]?.label || []);
  const headline = outcome.lines.filter((line) => wanted.includes(line.label));
  const shown = headline.length ? headline : outcome.lines.slice(0, 1);
  const answered = new Set(shown.map((line) => line.label));
  const facts = (found.facts || []).map(([label, value]) => ({ label, value: String(value) }));
  const factLabels = new Set(facts.map((line) => line.label));
  const rest = outcome.lines.filter((line) => !answered.has(line.label) && !factLabels.has(line.label));
  return { headline: shown, facts, details: [...facts, ...rest] };
}

function execute(rule, found) {
  if (found.outcome?.ok && Array.isArray(found.outcome.lines)) {
    return { outcome: found.outcome, inputs: found.values || {} };
  }
  const calc = calculatorById(rule.id);
  if (!calc) return null;
  const fields = fieldsFor(calc, rule.mode);
  const merged = { ...initialValues(fields), ...found.values };
  const norm = normalize(fields, merged);
  if (norm.errors.length) return null;
  const outcome = runCalculator(rule.id, rule.mode, norm.values);
  if (!outcome?.ok) return null;
  return { outcome, inputs: merged };
}

function keywordChoices(tokens, rules) {
  const words = tokens.filter((token) => token.type === 'word').map((token) => token.raw.toLowerCase());
  if (!words.length) return [];
  return rules.filter((rule) => {
    const keys = (rule.keywords || []).map((key) => String(key).toLowerCase());
    return words.every((word) => keys.some((key) => key === word || (word.length >= 3 && key.startsWith(word))));
  });
}

function partialKind(tokens) {
  const skip = new Set(['at', 'of', 'the', 'a', 'an', 'with', 'for', 'and']);
  const meaningful = tokens.filter((token) => token.type !== 'op' && !(token.type === 'word' && skip.has(token.raw.toLowerCase())));
  if (meaningful.length === 1 && meaningful[0].type === 'length') return 'length';
  return null;
}

function sortChoices(list) {
  return [...list].sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
}

/**
 * @param {string} text
 * @param {Array<object>} [rules]
 * @returns {{ kind: 'empty'|'incomplete'|'result'|'choices', quiet?: boolean, result: object|null, choices: object[] }}
 */
function partialPrompt(tokens) {
  const length = tokens.find((token) => token.type === 'length');
  if (length) return `What would you like to do with ${length.raw.trim()}?`;
  return 'What do you want to calculate?';
}

export function interpret(text, rules = RULES) {
  const tokens = normalizeTokens(tokenize(text));
  const matches = [];
  const pending = [];
  rules.forEach((rule) => {
    if (typeof rule.pattern !== 'function') return;
    const found = rule.pattern(tokens);
    if (!found || unexplained(tokens, found.used)) return;
    if (found.incomplete) {
      pending.push(found);
      return;
    }
    if (!satisfied(rule, found)) return;
    matches.push({ rule, found });
  });

  if (matches.length === 1 && matches[0].rule.immediate) {
    const ran = execute(matches[0].rule, matches[0].found);
    if (ran) {
      return {
        kind: 'result',
        result: {
          ...toChoice(matches[0].rule, matches[0].found, false),
          assumption: matches[0].found.assumption || '',
          lead: matches[0].found.lead || '',
          note: matches[0].found.note || '',
          inputs: ran.inputs,
          outcome: ran.outcome,
          ...present(matches[0].rule, matches[0].found, ran.outcome),
        },
        choices: [],
      };
    }
  }

  if (matches.length >= 1) {
    return {
      kind: 'choices',
      prompt: 'What do you want to calculate?',
      result: null,
      choices: sortChoices(matches.map(({ rule, found }) => toChoice(rule, found, false))),
    };
  }

  const kind = partialKind(tokens);
  const fromPartial = kind ? rules.filter((rule) => (rule.partial || []).includes(kind)) : [];
  const seeded = (rule) => (typeof rule.seed === 'function' ? { values: rule.seed(tokens) || {} } : null);
  const measured = tokens.some((token) => MEASURE.has(token.type));
  const fromWords = measured ? [] : keywordChoices(tokens, rules);
  const seen = new Set();
  const choices = [];
  [...fromPartial, ...fromWords].forEach((rule) => {
    const fromThisPartial = fromPartial.includes(rule);
    const choice = toChoice(rule, fromThisPartial ? seeded(rule) : null, fromThisPartial && !fromWords.includes(rule));
    const key = `${choice.id}:${choice.mode || ''}:${choice.title}`;
    if (seen.has(key)) return;
    seen.add(key);
    choices.push(choice);
  });
  if (!choices.length && pending.length) {
    const hinted = pending.find((found) => found.hint);
    return {
      kind: 'incomplete',
      quiet: pending.every((found) => found.quiet),
      hint: hinted?.hint || '',
      result: null,
      choices: [],
    };
  }
  if (!choices.length) return { kind: 'empty', result: null, choices: [] };
  const onlyPartial = fromPartial.length > 0 && fromWords.length === 0;
  return {
    kind: 'choices',
    prompt: onlyPartial ? partialPrompt(tokens) : '',
    result: null,
    choices: sortChoices(choices),
  };
}
