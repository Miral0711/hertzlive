// Hands parsed values to the detailed form without putting them in the URL.

let draft = null;

export function holdDraft(next) {
  draft = next;
}

export function peekDraft(calculatorId) {
  if (!draft || draft.calculatorId !== calculatorId) return null;
  return draft;
}

export function takeDraft(calculatorId) {
  const current = peekDraft(calculatorId);
  if (current) draft = null;
  return current;
}
