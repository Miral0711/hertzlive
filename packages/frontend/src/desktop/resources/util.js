import { state, svc, toast, uid } from '../../shared/core.js';
import { NAS_TREE, TODAY } from '../../shared/data.js';
import { role, staff } from '../helpers';

export const copyText = (t) => { try { navigator.clipboard?.writeText(t); } catch (_) { /* clipboard unavailable */ } };

export function fileShares() {
  const all = [{ name: 'Projects', root: NAS_TREE.root, entries: NAS_TREE.entries }];
  const emp = NAS_TREE.employees;
  if (emp && staff()) {
    all.push({
      name: 'Employees',
      root: emp.root,
      entries: role() === 'partner' ? emp.entries : emp.entries.filter((e) => e.map === 'Person ' + state.userId),
    });
  }
  return all;
}
export function fileResolve(path) {
  const segs = (path || '').split('/').filter(Boolean);
  const share = fileShares().find((s) => s.name === segs[0]);
  if (!share) return null;
  let node = { p: share.name, dir: true, c: share.entries };
  let cur = share.name;
  const crumbs = [[share.name, cur]];
  for (const s of segs.slice(1)) {
    const n = (node.c || []).find((x) => x.p === s);
    if (!n) break;
    node = n;
    cur += '/' + s;
    crumbs.push([s, cur]);
  }
  return { share, node, crumbs, path: cur };
}
export const fileKind = (p) => {
  const x = (p.split('.').pop() || '').toLowerCase();
  if (['dwg', 'dxf', 'rvt', 'skp'].includes(x)) return 'CAD';
  if (x === 'pdf') return 'PDF';
  if (['jpg', 'jpeg', 'png', 'heic'].includes(x)) return 'Photo';
  return 'Doc';
};
export const fileHref = (base, p) => `${base}${base.includes('?') ? '&' : '?'}path=${encodeURIComponent(p)}`;
export const winPath = (p) => '\\\\nas\\' + p.replace(/\//g, '\\');
export function fileFlat(node, path, out = []) {
  (node.c || []).forEach((c) => {
    const p = path + '/' + c.p;
    out.push({ e: c, path: p });
    if (c.dir) fileFlat(c, p, out);
  });
  return out;
}

export { uid, svc, toast, TODAY };
