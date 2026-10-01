import { state, svc, toast, render, uid } from '../../shared/core.js';
import { TODAY, NAS_TREE } from '../../shared/data.js';
import { Btn, Empty, Table, Th, Td, Tr } from '../../ui/ui';
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
const treeLink = 'flex items-center gap-2 rounded-r1 py-1.5 pr-2 text-[13px] no-underline hover:bg-surface-3';
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
      <TreeLink to={fileHref(base, r.path)} on={cur === r.path}><Icon name="folder" small /><b>{r.node.p}</b></TreeLink>
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
      <Tr>
        <Td>
          <DLink to={fileHref(base, path)} className="inline-flex items-center gap-2 font-medium text-ink no-underline"><Icon name="folder" small className="text-accent-text" /> {showPath ? path : e.p}</DLink>
        </Td>
        <Td className="text-ink-2">Folder</Td>
        <Td className="text-ink-3">{(e.c || []).length ? `${(e.c || []).length} item${(e.c || []).length === 1 ? '' : 's'}` : ''}</Td>
      </Tr>
    );
  }
  return (
    <Tr className={sel ? '[&>td]:bg-accent-soft' : ''}>
      <Td>
        <button type="button" className="inline-flex items-center gap-2 border-0 bg-transparent p-0 text-left text-inherit" onClick={() => fileSel(path)}>
          <Icon name="file" small className="text-ink-3" /> <Mono>{showPath ? path : e.p}</Mono>
        </button>
        <Tags e={e} />
      </Td>
      <Td className="text-ink-2">{fileKind(e.p)}</Td>
      <Td className="text-ink-2">{e.size || ''}</Td>
    </Tr>
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
  const wrap = (body) => (
    <Table>
      <thead><tr><Th>{q ? 'Match' : 'Name'}</Th><Th>Kind</Th><Th>Size / items</Th></tr></thead>
      <tbody>{body}</tbody>
    </Table>
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
    <div className="overflow-hidden rounded-r3 border border-line bg-surface md:grid md:grid-cols-[230px_minmax(0,1fr)]">
      <nav aria-label="Folders" className="flex flex-col gap-0.5 border-b border-line bg-surface-2 p-3 md:border-b-0 md:border-r max-md:flex-row max-md:flex-wrap"><Tree base={base} cur={r.path} scope={scope} /></nav>
      <div className="min-w-0 p-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-3">
          <span>
          {r.crumbs.map(([l, p], i) => (
            <span key={p}>
              {i > 0 && <span className="mx-1">›</span>}
              {i === r.crumbs.length - 1 ? <b className="text-ink">{l}</b> : <DLink to={fileHref(base, p)} className="text-accent-text no-underline hover:underline">{l}</DLink>}
            </span>
          ))}
          </span>
          <span className="text-xs">{rows.filter((x) => x.e.dir).length} folder{rows.filter((x) => x.e.dir).length === 1 ? '' : 's'} · {rows.filter((x) => !x.e.dir).length} file{rows.filter((x) => !x.e.dir).length === 1 ? '' : 's'}</span>
        </div>
        <form
          className="mb-2.5 flex flex-wrap items-center gap-2.5"
          onSubmit={(e) => { e.preventDefault(); state.desk.fileQ = new FormData(e.currentTarget).get('q') || ''; render(); }}
        >
          <input
            type="search" name="q" defaultValue={q} key={q} placeholder={`Search ${scope ? 'this folder' : 'all shares'}`} aria-label="Search files"
            className="min-h-9 min-w-[200px] flex-1 rounded-r1 border border-line-2 bg-surface px-2.5 py-1.5 text-ink"
          />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Kind">
            {['', 'CAD', 'PDF', 'Photo', 'Doc'].map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => { state.desk.fileKind = k; render(); }} className={`inline-flex min-h-8 items-center rounded-full border px-3 text-[13px] font-semibold ${kind === k ? 'border-accent bg-accent text-accent-ink' : 'border-line-2 bg-surface text-ink-2 hover:border-accent hover:text-accent-text'}`}>{k || 'All'}</button>
            ))}
          </div>
          <Btn sm onClick={() => { state.desk.fileView = view === 'list' ? 'thumbs' : 'list'; render(); }}>{view === 'list' ? 'Thumbnails' : 'List'}</Btn>
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
        <p className="mb-0 mt-3 text-ink-3"><small>Read only. Path <Mono>{r.share.root}</Mono>. Copy path opens the file in your CAD app from the NAS.</small></p>
      </div>
    </div>
  );
}
