export const fileKind = (p) => {
  const x = (p.split('.').pop() || '').toLowerCase();
  if (['dwg', 'dxf', 'rvt', 'skp'].includes(x)) return 'CAD';
  if (x === 'pdf') return 'PDF';
  if (['jpg', 'jpeg', 'png', 'heic'].includes(x)) return 'Photo';
  return 'Doc';
};
export const winPath = (p) => `\\\\nas\\${p.replace(/\//g, '\\')}`;
