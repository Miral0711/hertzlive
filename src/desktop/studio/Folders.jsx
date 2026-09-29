import { useState } from 'react';
import { state, svc, toast, uid } from '../../shared/core.js';
import { TODAY } from '../../shared/data.js';
import { Btn, Empty, Input } from '../../ui/ui';
import Icon from '../../ui/Icon';
import { DLink } from '../nav';
import { openDialog } from '../session';
import { Mono } from './common';
import Ph from '../resources/Ph';
import {
  fileResolve as resolve, fileKind as kindOf, fileFlat as flat, fileHref as link, winPath, copyText,
} from '../resources/util';

// Read-only NAS browser scoped to one share (personal folders). Mirrors the prototype's filesView,
// reusing the Files page's lookups (../resources/util) so both browsers agree on folder contents.

function Tree({ base, cur, scope }) {
  const rec = (node, path, d) =>
    (node.c || []).filter((c) => c.dir).map((c) => {
      const p = path + '/' + c.p;
      const on = cur === p || cur.startsWith(p + '/');
      return (
        <div key={p}>
          <DLink to={link(base, p)} style={{ paddingLeft: 8 + d * 14 }} className={`flex items-center gap-1.5 rounded-r1 py-1 text-ink no-underline hover:bg-surface-2 ${on ? 'bg-accent-soft' : ''}`}>
            <Icon name="folder" small /> {c.p}
          </DLink>
          {on && rec(c, p, d + 1)}
        </div>
      );
    });
  const r = resolve(scope);
  if (!r) return null;
  return (
    <>
      <DLink to={link(base, r.path)} className={`block rounded-r1 px-2 py-1 text-ink no-underline hover:bg-surface-2 ${cur === r.path ? 'bg-accent-soft' : ''}`}><b>{r.node.p}</b></DLink>
      {rec(r.node, r.path, 1)}
    </>
  );
}

function shareFile(p) {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + 7);
  const s = { id: uid(), path: p, by: state.userId, at: `${TODAY}T${new Date().toTimeString().slice(0, 5)}`, expires: d.toISOString().slice(0, 10) };
  state.desk.shares.unshift(s);
  copyText(`https://studio.link/s/${s.id}`);
  svc.log('Shared file link', s.path);
  toast('Link copied. Valid 7 days, listed under My links.');
}

function FileThumb({ e, p, base, sel, onSelect }) {
  const k = kindOf(e.p);
  const pic = k === 'Photo' || k === 'PDF'
    ? <Ph hue={k === 'Photo' ? 28 : 200} seed={p.length % 17} ar={1.333} />
    : <div className="grid place-items-center rounded-md bg-accent-soft" style={{ aspectRatio: '1.333' }}><Icon name={e.dir ? 'folder' : 'file'} /></div>;
  const cap = <figcaption className="break-words px-0.5 pt-1.5">{e.p}{!e.dir && e.chat && <> <span className="rounded-full bg-accent-soft px-2 text-xs text-accent-text">from chat</span></>}</figcaption>;
  return e.dir ? (
    <DLink to={link(base, p)} className="block rounded-lg border border-line p-1.5 text-xs text-ink no-underline">{pic}{cap}</DLink>
  ) : (
    <button
      type="button"
      onClick={onSelect}
      className={`block w-full rounded-lg border p-1.5 text-left text-xs text-ink ${sel === p ? 'border-accent ring-2 ring-accent-soft' : 'border-line'}`}
    >
      {pic}{cap}
    </button>
  );
}

export default function Folders({ path, scope = 'Employees', base = '#/people?tab=folders' }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const [sel, setSel] = useState(null);
  const [view, setView] = useState('list');
  const r = resolve(path || scope);
  if (!r) return <Empty>Folder not found.</Empty>;
  const sc = resolve(scope);
  let rows = query
    ? flat(sc.node, sc.path).filter((x) => x.e.p.toLowerCase().includes(query.toLowerCase()))
    : (r.node.c || []).map((e) => ({ e, path: r.path + '/' + e.p }));
  if (kind) rows = rows.filter((x) => x.e.dir || kindOf(x.e.p) === kind);
  rows = [...rows].sort((a, b) => (b.e.dir ? 1 : 0) - (a.e.dir ? 1 : 0));
  const selE = sel && resolve(sel);
  const showBar = selE && !selE.node.dir && selE.path === sel;
  const open = (p) => {
    const k = kindOf(p);
    if (k === 'Photo' || k === 'PDF') openDialog({ kind: 'file-preview', path: p });
    else {
      navigator.clipboard?.writeText(winPath(p));
      toast('No preview for ' + k + '. Path copied, open it in your CAD app.');
    }
  };
  const copy = (p) => {
    const w = winPath(p);
    navigator.clipboard?.writeText(w);
    toast('Copied ' + w + ' (Mac: smb://nas/' + p + ')');
  };
  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <nav className="text-[13px]" aria-label="Folders"><Tree base={base} cur={r.path} scope={scope} /></nav>
      <div className="min-w-0">
        <div className="mb-2 text-[13px] text-ink-2">
          {r.crumbs.map(([l, p], i) => (
            <span key={p}>
              {i > 0 && ' › '}
              {i === r.crumbs.length - 1 ? <b>{l}</b> : <DLink to={link(base, p)} className="text-accent-text underline">{l}</DLink>}
            </span>
          ))}
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this folder" aria-label="Search files" />
          <select aria-label="Kind" value={kind} onChange={(e) => setKind(e.target.value)} className="min-h-9 rounded-r1 border border-line-2 bg-surface px-2.5 text-ink">
            {['', 'CAD', 'PDF', 'Photo', 'Doc'].map((k) => <option key={k} value={k}>{k || 'All kinds'}</option>)}
          </select>
          <Btn sm onClick={() => setView(view === 'list' ? 'thumbs' : 'list')}>{view === 'list' ? 'Thumbs' : 'List'}</Btn>
        </div>
        {showBar && (
          <div className="mb-2 flex items-center gap-2">
            <span className="grow"><Mono>{sel.split('/').pop()}</Mono></span>
            <Btn sm onClick={() => open(sel)}>Open</Btn>
            <Btn sm onClick={() => copy(sel)}>Copy path</Btn>
            <Btn sm kind="primary" onClick={() => shareFile(sel)}>Share</Btn>
          </div>
        )}
        {rows.length ? view === 'thumbs' && !query ? (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))' }}>
            {rows.map(({ e, path: p }) => <FileThumb key={p} e={e} p={p} base={base} sel={sel} onSelect={() => setSel(sel === p ? null : p)} />)}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-r3 border border-line bg-surface">
            <table className="w-full border-collapse">
              <thead><tr>{[query ? 'Match' : 'Name', 'Kind', 'Size'].map((h) => <th key={h} className="border-b border-line bg-surface-2 px-3.5 py-2 text-left text-xs font-semibold text-ink-2">{h}</th>)}</tr></thead>
              <tbody>
                {rows.map(({ e, path: p }) => (
                  <tr key={p} className={sel === p ? 'bg-accent-soft' : ''}>
                    <td className="border-b border-line px-3.5 py-2">
                      {e.dir ? (
                        <DLink to={link(base, p)} className="inline-flex items-center gap-1.5 text-ink no-underline"><Icon name="folder" small /> {query ? p : e.p}</DLink>
                      ) : (
                        <button type="button" className="inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-left text-ink" onClick={() => setSel(sel === p ? null : p)}>
                          <Icon name="file" small /> <Mono>{query ? p : e.p}</Mono>
                        </button>
                      )}
                      {e.chat && <span className="ml-1 rounded-full bg-accent-soft px-2 text-xs text-accent-text">from chat</span>}
                      {e.why && <span className="ml-1 rounded-full bg-warn-soft px-2 text-xs text-warn">{e.why}</span>}
                    </td>
                    <td className="border-b border-line px-3.5 py-2">{e.dir ? '' : kindOf(e.p)}</td>
                    <td className="border-b border-line px-3.5 py-2">{e.size || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>{query ? `No files match "${query}".` : 'Empty folder.'}</Empty>}
        <p className="mt-2 text-ink-3"><small>Read only. Path <Mono>{r.share.root}</Mono>. Copy path opens the file in your CAD app from the NAS.</small></p>
      </div>
    </div>
  );
}
