import { state, svc, toast, render, uid } from '../../shared/core.js';
import { TODAY, NAS_TREE } from '../../shared/data.js';
import { Btn, Empty, Select } from '../../ui/ui';
import Icon from '../../ui/Icon';
import { DLink } from '../nav';
import { openDialog } from '../session';
import { role, staff, Ph, Mono } from './common';

// Read-only NAS browser scoped to one folder (prototype filesView with opts.scope).
function fileShares() {
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
function fileResolve(path) {
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
const fileKind = (p) => {
  const x = (p.split('.').pop() || '').toLowerCase();
  if (['dwg', 'dxf', 'rvt', 'skp'].includes(x)) return 'CAD';
  if (x === 'pdf') return 'PDF';
  if (['jpg', 'jpeg', 'png', 'heic'].includes(x)) return 'Photo';
  return 'Doc';
};
const fileHref = (base, p) => `${base}${base.includes('?') ? '&' : '?'}path=${encodeURIComponent(p)}`;
const winPath = (p) => '\\\\nas\\' + p.replace(/\//g, '\\');
function fileFlat(node, path, out = []) {
  (node.c || []).forEach((c) => {
    const p = path + '/' + c.p;
    out.push({ e: c, path: p });
    if (c.dir) fileFlat(c, p, out);
  });
  return out;
}

// ---------- handlers ----------
function fileSel(path) {
  state.desk.fileSel = state.desk.fileSel === path ? null : path;
  render();
}
function fileOpen(path) {
  const k = fileKind(path);
  if (k === 'Photo' || k === 'PDF') {
    openDialog({ kind: 'file-preview', path });
  } else {
    navigator.clipboard?.writeText(winPath(path));
    toast('No preview for ' + k + '. Path copied, open it in your CAD app.');
  }
}
function fileCopy(path) {
  const w = winPath(path);
  navigator.clipboard?.writeText(w);
  toast('Copied ' + w + ' (Mac: smb://nas/' + path + ')');
}
function fileShare(path) {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + 7);
  const s = {
    id: uid(), path, by: state.userId, at: TODAY + 'T' + new Date().toTimeString().slice(0, 5), expires: d.toISOString().slice(0, 10),
  };
  state.desk.shares.unshift(s);
  navigator.clipboard?.writeText('https://studio.link/s/' + s.id);
  svc.log('Shared file link', s.path);
  toast('Link copied. Valid 7 days, listed under My links.');
}

// ---------- pieces ----------
const treeLink = 'flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap rounded-md px-2 py-[5px] text-[13px] no-underline';
function TreeLink({ to, on, depth = 0, children }) {
  return (
    <DLink to={to} className={`${treeLink} ${on ? 'bg-accent-soft font-semibold' : ''}`} style={{ paddingLeft: 8 + depth * 14, color: on ? 'var(--accent-text)' : 'inherit' }}>
      {children}
    </DLink>
  );
}
function TreeNodes({ node, path, depth, base, cur }) {
  return (node.c || []).filter((c) => c.dir).map((c) => {
    const p = path + '/' + c.p;
    const on = cur === p || cur.startsWith(p + '/');
    return (
      <div key={p} className="contents">
        <TreeLink to={fileHref(base, p)} on={on} depth={depth}><Icon name="folder" small /> {c.p}</TreeLink>
        {on && <TreeNodes node={c} path={p} depth={depth + 1} base={base} cur={cur} />}
      </div>
    );
  });
}
function Tree({ base, cur, scope }) {
  const r = fileResolve(scope);
  if (!r) return null;
  return (
    <>
      <TreeLink to={fileHref(base, r.path)} on={cur === r.path}><b>{r.node.p}</b></TreeLink>
      <TreeNodes node={r.node} path={r.path} depth={1} base={base} cur={cur} />
    </>
  );
}
const Tags = ({ e }) => (
  <>
    {e.chat && <> <span className="rounded-full bg-accent-soft px-2 text-xs font-semibold leading-6 text-accent-text">from chat</span></>}
    {e.why && <> <span className="rounded-full bg-warn-soft px-2 text-xs font-semibold leading-6 text-warn">{e.why}</span></>}
  </>
);
function FileRow({ e, path, base, showPath }) {
  const sel = state.desk.fileSel === path;
  if (e.dir) {
    return (
      <tr>
        <td className="border-b border-line px-3.5 py-2">
          <DLink to={fileHref(base, path)} className="text-inherit no-underline"><Icon name="folder" small /> {showPath ? path : e.p}</DLink>
        </td>
        <td className="border-b border-line" /><td className="border-b border-line" />
      </tr>
    );
  }
  return (
    <tr className={sel ? 'bg-accent-soft' : ''}>
      <td className="border-b border-line px-3.5 py-2">
        <button type="button" className="border-0 bg-transparent p-0 text-left text-inherit" onClick={() => fileSel(path)}>
          <Icon name="file" small /> <Mono>{showPath ? path : e.p}</Mono>
        </button>
        <Tags e={e} />
      </td>
      <td className="border-b border-line px-3.5 py-2">{fileKind(e.p)}</td>
      <td className="border-b border-line px-3.5 py-2">{e.size || ''}</td>
    </tr>
  );
}
function FileThumb({ e, path, base }) {
  const sel = state.desk.fileSel === path;
  const k = fileKind(e.p);
  const pic = k === 'Photo' || k === 'PDF'
    ? <Ph hue={k === 'Photo' ? 28 : 200} seed={path.length % 17} ar={1.333} className="rounded-md" />
    : <div className="grid aspect-[1.333] place-items-center rounded-md bg-accent-soft"><Icon name={e.dir ? 'folder' : 'file'} /></div>;
  const cls = `block rounded-lg border p-1.5 text-xs text-inherit no-underline ${sel ? 'border-accent shadow-[0_0_0_2px_var(--accent-soft)]' : 'border-line'}`;
  const cap = <figcaption className="break-words px-0.5 pt-1.5">{e.p}{!e.dir && e.chat && <> <span className="rounded-full bg-accent-soft px-2 text-xs text-accent-text">from chat</span></>}</figcaption>;
  return e.dir ? (
    <DLink to={fileHref(base, path)} className={cls}>{pic}{cap}</DLink>
  ) : (
    <button type="button" className={`${cls} bg-transparent text-left`} onClick={() => fileSel(path)}>{pic}{cap}</button>
  );
}

const th = 'h-10 border-b border-line bg-surface-2 px-3.5 py-2 text-left text-xs font-semibold text-ink-2';

export function FilesView({ base, path, scope }) {
  const q = state.desk.fileQ || '';
  const kind = state.desk.fileKind || '';
  const view = state.desk.fileView || 'list';
  const r = fileResolve(path || scope || 'Projects');
  if (!r) return <Empty>Folder not found.</Empty>;
  const scoped = scope ? fileResolve(scope) : null;
  let rows = q
    ? fileFlat(scoped ? scoped.node : { c: [] }, scoped ? scoped.path : '')
        .concat(scope ? [] : fileShares().flatMap((s) => fileFlat({ c: s.entries }, s.name)))
        .filter((x) => x.e.p.toLowerCase().includes(q.toLowerCase()))
    : (r.node.c || []).map((e) => ({ e, path: r.path + '/' + e.p }));
  if (kind) rows = rows.filter((x) => x.e.dir || fileKind(x.e.p) === kind);
  rows = [...rows].sort((a, b) => (b.e.dir ? 1 : 0) - (a.e.dir ? 1 : 0));
  const sel = state.desk.fileSel;
  const selE = sel && fileResolve(sel);
  const bar = selE && !selE.node.dir && selE.path === sel;
  const head = (
    <thead><tr>
      <th className={th}>{q ? 'Match' : 'Name'}</th><th className={th}>Kind</th><th className={th}>Size</th>
    </tr></thead>
  );
  const wrap = (body) => (
    <div className="overflow-x-auto rounded-r3 border border-line bg-surface"><table className="w-full border-collapse">{head}<tbody>{body}</tbody></table></div>
  );
  let listing;
  if (q) {
    listing = rows.length ? wrap(rows.map((x) => <FileRow key={x.path} e={x.e} path={x.path} base={base} showPath />)) : <Empty>No files match "{q}".</Empty>;
  } else if (view === 'thumbs') {
    listing = (
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(140px,1fr))]">
        {rows.map((x) => <FileThumb key={x.path} e={x.e} path={x.path} base={base} />)}
        {!rows.length && <Empty>Empty folder.</Empty>}
      </div>
    );
  } else {
    listing = wrap(rows.length
      ? rows.map((x) => <FileRow key={x.path} e={x.e} path={x.path} base={base} />)
      : <tr><td colSpan={3} className="p-7 text-center text-ink-3">Empty folder.</td></tr>);
  }
  return (
    <div className="grid items-start gap-gap md:grid-cols-[200px_minmax(0,1fr)]">
      <nav className="flex flex-col gap-0.5 md:sticky md:top-0 md:border-r md:border-line md:pr-2 max-md:flex-row max-md:flex-wrap"><Tree base={base} cur={r.path} scope={scope} /></nav>
      <div className="min-w-0">
        <div className="mb-2 text-[13px] text-ink-3">
          {r.crumbs.map(([l, p], i) => (
            <span key={p}>
              {i > 0 && ' › '}
              {i === r.crumbs.length - 1 ? <b className="text-ink">{l}</b> : <DLink to={fileHref(base, p)} className="text-inherit underline">{l}</DLink>}
            </span>
          ))}
        </div>
        <form
          className="mb-2.5 flex flex-wrap items-center gap-2.5"
          onSubmit={(e) => { e.preventDefault(); state.desk.fileQ = new FormData(e.currentTarget).get('q') || ''; render(); }}
        >
          <input
            type="search" name="q" defaultValue={q} key={q} placeholder={`Search ${scope ? 'this folder' : 'all shares'}`} aria-label="Search files"
            className="min-h-9 rounded-r1 border border-line-2 bg-surface px-2.5 py-1.5 text-ink"
          />
          <Select value={kind} aria-label="Kind" onChange={(e) => { state.desk.fileKind = e.target.value; render(); }}>
            {['', 'CAD', 'PDF', 'Photo', 'Doc'].map((k) => <option key={k} value={k}>{k || 'All kinds'}</option>)}
          </Select>
          <Btn sm onClick={() => { state.desk.fileView = view === 'list' ? 'thumbs' : 'list'; render(); }}>{view === 'list' ? 'Thumbs' : 'List'}</Btn>
        </form>
        {bar && (
          <div className="mb-2.5 flex items-center gap-2 rounded-lg bg-accent-soft px-2.5 py-2">
            <Mono>{sel.split('/').pop()}</Mono><span className="flex-1" />
            <Btn sm onClick={() => fileOpen(sel)}>Open</Btn>
            <Btn sm onClick={() => fileCopy(sel)}>Copy path</Btn>
            <Btn sm kind="primary" onClick={() => fileShare(sel)}>Share</Btn>
          </div>
        )}
        {listing}
        <p className="text-ink-3"><small>Read only. Path <Mono>{r.share.root}</Mono>. Copy path opens the file in your CAD app from the NAS.</small></p>
      </div>
    </div>
  );
}
