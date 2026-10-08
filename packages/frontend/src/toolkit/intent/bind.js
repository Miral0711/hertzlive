// Maps a length or number token onto the field names the calculator forms already use.

export function lengthFields(key, token) {
  if (!token) return {};
  if (token.type === 'number') return { [key]: token.raw, [`${key}Unit`]: 'ft' };
  return { [key]: token.text, [`${key}Unit`]: token.unit || 'mm' };
}

export function bare(token) {
  return token?.type === 'number';
}
