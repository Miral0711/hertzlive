import { useMemo } from 'react';
import { state, svc, can, go, toast, render, fmtD, uid } from '../../shared/core.js';
import { NAS_TREE } from '../../shared/data.js';
import { Btn, Card, Empty, Input, Select, Pill, StatusPill, PageHeader, List, Item } from '../../ui/ui';
import Icon from '../../ui/Icon';
import { DLink } from '../nav';
import { first, name, role } from '../helpers';
import { openDialog } from '../session';
import Ph from './Ph';
import {
  fileShares, fileResolve, fileKind, fileHref, winPath, fileFlat, copyText, TODAY,
} from './util';

// ---------- actions (ACT handlers) ----------
export const fileSel = (p) => { state.desk.fileSel = state.desk.fileSel === p ? null : p; render(); };
export function fileOpen(p) {
  const k = fileKind(p);
  if (k === 'Photo' || k === 'PDF') openDialog({ kind: 'file-preview', path: p });
  else {
    copyText(winPath(p));
    toast('No preview for ' + k + '. Path copied, open it in your CAD app.');
  }
}
export function fileCopy(p) {
  const w = winPath(p);
  copyText(w);
  toast('Copied ' + w + ' (Mac: smb://nas/' + p + ')');
}
export function fileShare(p) {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + 7);
  const s = {
    id: uid(),
    path: p,
    by: state.userId,
    at: TODAY + 'T' + new Date().toTimeString().slice(0, 5),
    expires: d.toISOString().slice(0, 10),
  };
  state.desk.shares.unshift(s);
  copyText('https://studio.link/s/' + s.id);
  svc.log('Shared file link', s.path);
  toast('Link copied. Valid 7 days, listed under My links.');
}
export const fileUnshare = (id) => {
  state.desk.shares = state.desk.shares.filter((s) => s.id !== id);
  toast('Link revoked.');
};
export const shareCopy = (url) => { copyText(url); toast('Link copied.'); };
export const shareRevoke = (id) => { svc.revokeShare(id); toast('Share link revoked.'); render(); };
export const shareOpen = (id) => go(`#/s/${encodeURIComponent(id)}`);
export function nasDry() {
  let n = 0;
  let skip = 0;
  const walk = (e) => {
    if (e.map) n++;
    if (e.why) skip++;
    (e.c || []).forEach(walk);
  };
  NAS_TREE.entries.forEach(walk);
  state.desk.nasMsg = `Dry run: ${n} items would be mapped, ${skip} skipped. Nothing was moved or renamed.`;
  toast('Dry run done. See the note below the files.');
}

// ---------- browser ----------
const fileLinkCls = 'inline-flex items-center gap-1.5 text-inherit no-underline hover:underline';

function FileRow({ e, p, base, showPath }) {
  const sel = state.desk.fileSel === p;
  if (e.dir) {
    return (
      <tr>
        <td className="px-3.5 py-2"><DLink to={fileHref(base, p)} className={fileLinkCls}><Icon name="folder" small /> {showPath ? p : e.p}</DLink></td>
        <td /><td />
      </tr>
    );
  }
  return (
    <tr className={sel ? 'bg-accent-soft' : ''}>
      <td className="px-3.5 py-2">
        <button type="button" className={`${fileLinkCls} border-0 bg-transparent p-0 text-left`} onClick={() => fileSel(p)}>
          <Icon name="file" small /> <span className="font-mono text-[13px]">{showPath ? p : e.p}</span>
        </button>
        {e.chat && <> <Pill kind="soft">from chat</Pill></>}
        {e.why && <> <Pill kind="warn">{e.why}</Pill></>}
      </td>
      <td className="px-3.5 py-2">{fileKind(e.p)}</td>
      <td className="px-3.5 py-2">{e.size || ''}</td>
    </tr>
  );
}

function FileThumb({ e, p, base }) {
  const sel = state.desk.fileSel === p;
  const k = fileKind(e.p);
  const pic = k === 'Photo' || k === 'PDF'
    ? <Ph hue={k === 'Photo' ? 28 : 200} seed={p.length % 17} ar={1.333} />
    : <div className="grid place-items-center rounded-md bg-accent-soft" style={{ aspectRatio: '1.333' }}><Icon name={e.dir ? 'folder' : 'file'} /></div>;
  const cls = 'block rounded-lg border p-1.5 text-xs text-inherit no-underline';
  const cap = <figcaption className="break-words px-0.5 pt-1.5">{e.p}{!e.dir && e.chat && <> <Pill kind="soft">from chat</Pill></>}</figcaption>;
  return e.dir ? (
    <DLink to={fileHref(base, p)} className={`${cls} border-line`}>{pic}{cap}</DLink>
  ) : (
    <button type="button" onClick={() => fileSel(p)} className={`${cls} w-full text-left ${sel ? 'border-accent ring-2 ring-accent-soft' : 'border-line'}`}>{pic}{cap}</button>
  );
}

function FileTree({ base, cur, scope }) {
  const treeCls = (on) => `flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap rounded-md px-2 py-[5px] text-[13px] no-underline ${on ? 'bg-accent-soft font-semibold text-accent-text' : 'text-inherit hover:bg-surface-2'}`;
  const rec = (node, path, d) => (node.c || []).filter((c) => c.dir).map((c) => {
    const p = path + '/' + c.p;
    const on = cur === p || cur.startsWith(p + '/');
    return (
      <div key={p} className="contents">
        <DLink to={fileHref(base, p)} className={treeCls(cur === p || on)} style={{ paddingLeft: 8 + d * 14 }}><Icon name="folder" small /> {c.p}</DLink>
        {on && rec(c, p, d + 1)}
      </div>
    );
  });
  if (scope) {
    const r = fileResolve(scope);
    if (!r) return null;
    return (<><DLink to={fileHref(base, r.path)} className={treeCls(cur === r.path)}><b>{r.node.p}</b></DLink>{rec(r.node, r.path, 1)}</>);
  }
  return fileShares().map((s) => (
    <div key={s.name} className="contents">
      <DLink to={fileHref(base, s.name)} className={treeCls(cur === s.name)}><b>{s.name}</b></DLink>
      {rec({ c: s.entries }, s.name, 1)}
    </div>
  ));
}

// Exported: the projects module may embed the same browser, scoped to a project folder.
export function FilesView({ base, path, scope }) {
  const q = state.desk.fileQ || '';
  const kind = state.desk.fileKind || '';
  const view = state.desk.fileView || 'list';
  const r = fileResolve(path || scope || 'Projects');
  if (!r) return <Empty>Folder not found.</Empty>;
  let rows = q
    ? fileFlat(scope ? fileResolve(scope).node : { c: [] }, scope ? fileResolve(scope).path : '')
      .concat(scope ? [] : fileShares().flatMap((s) => fileFlat({ c: s.entries }, s.name)))
      .filter((x) => x.e.p.toLowerCase().includes(q.toLowerCase()))
    : (r.node.c || []).map((e) => ({ e, path: r.path + '/' + e.p }));
  if (kind) rows = rows.filter((x) => x.e.dir || fileKind(x.e.p) === kind);
  rows.sort((a, b) => (b.e.dir ? 1 : 0) - (a.e.dir ? 1 : 0));
  const sel = state.desk.fileSel;
  const selE = sel && fileResolve(sel);
  const th = 'h-10 border-b border-line bg-surface-2 px-3.5 py-2 text-left text-xs font-semibold text-ink-2';
  const table = (head, body) => (
    <div className="overflow-x-auto rounded-r3 border border-line bg-surface">
      <table className="w-full border-collapse"><thead><tr><th className={th}>{head}</th><th className={th}>Kind</th><th className={th}>Size</th></tr></thead><tbody>{body}</tbody></table>
    </div>
  );
  let listing;
  if (q) {
    listing = rows.length
      ? table('Match', rows.map((x) => <FileRow key={x.path} e={x.e} p={x.path} base={base} showPath />))
      : <Empty>{`No files match "${q}".`}</Empty>;
  } else if (view === 'thumbs') {
    listing = rows.length
      ? <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))' }}>{rows.map((x) => <FileThumb key={x.path} e={x.e} p={x.path} base={base} />)}</div>
      : <Empty>Empty folder.</Empty>;
  } else {
    listing = table('Name', rows.length
      ? rows.map((x) => <FileRow key={x.path} e={x.e} p={x.path} base={base} />)
      : <tr><td colSpan={3}><Empty>Empty folder.</Empty></td></tr>);
  }
  return (
    <div className="grid items-start gap-4 max-[900px]:grid-cols-1 min-[901px]:grid-cols-[220px_minmax(0,1fr)]">
      <nav className="flex flex-col gap-0.5 border-line pr-2 min-[901px]:sticky min-[901px]:top-0 min-[901px]:border-r" aria-label="Folders"><FileTree base={base} cur={r.path} scope={scope} /></nav>
      <div className="min-w-0">
        <div className="mb-2 text-[13px] text-ink-3">
          {r.crumbs.map(([l, p], i) => (
            <span key={p}>
              {i > 0 && ' › '}
              {i === r.crumbs.length - 1 ? <b className="text-ink">{l}</b> : <DLink to={fileHref(base, p)} className="text-inherit">{l}</DLink>}
            </span>
          ))}
        </div>
        <form
          className="mb-2.5 flex items-center gap-2.5"
          onSubmit={(e) => { e.preventDefault(); state.desk.fileQ = new FormData(e.currentTarget).get('q') || ''; render(); }}
        >
          <Input type="search" name="q" key={q} defaultValue={q} placeholder={`Search ${scope ? 'this folder' : 'all shares'}`} aria-label="Search files" className="min-w-0 flex-1" />
          <Select aria-label="Kind" value={kind} onChange={(e) => { state.desk.fileKind = e.target.value; render(); }}>
            {['', 'CAD', 'PDF', 'Photo', 'Doc'].map((k) => <option key={k} value={k}>{k || 'All kinds'}</option>)}
          </Select>
          <Btn sm onClick={() => { state.desk.fileView = view === 'list' ? 'thumbs' : 'list'; render(); }}>{view === 'list' ? 'Thumbs' : 'List'}</Btn>
        </form>
        {selE && !selE.node.dir && selE.path === sel && (
          <div className="mb-2.5 flex items-center gap-2 rounded-r2 bg-accent-soft px-2.5 py-2">
            <span className="min-w-0 flex-1 font-mono text-[13px]">{sel.split('/').pop()}</span>
            <Btn sm onClick={() => fileOpen(sel)}>Open</Btn>
            <Btn sm onClick={() => fileCopy(sel)}>Copy path</Btn>
            <Btn sm kind="primary" onClick={() => { fileShare(sel); render(); }}>Share</Btn>
          </div>
        )}
        {listing}
        <p className="text-ink-3"><small>Read only. Path <span className="font-mono">{r.share.root}</span>. Copy path opens the file in your CAD app from the NAS.</small></p>
      </div>
    </div>
  );
}

export function MyLinks() {
  const mine = state.desk.shares.filter((s) => role() === 'partner' || s.by === state.userId);
  return (
    <Card title="My links" className="mt-3.5">
      <List empty="No links yet. Select a file, then Share.">
        {mine.map((s) => (
          <Item key={s.id}>
            <span className="min-w-0 flex-1"><span className="font-mono text-[13px]">{s.path.split('/').pop()}</span> · to {s.to || 'link'} by {first(s.by)}, {fmtD(s.at)} · expires {fmtD(s.expires)}</span>
            <Btn sm onClick={() => { fileUnshare(s.id); }}>Revoke</Btn>
          </Item>
        ))}
      </List>
    </Card>
  );
}

export function ShareLinksCard() {
  if (!can('share', 'r')) return null;
  const rows = svc.shareLinks();
  return (
    <Card className="mt-3.5">
      <div className="mb-1 flex items-center justify-between gap-2.5"><h2 className="m-0 text-lg font-semibold">Share links</h2><Btn sm onClick={() => openDialog({ kind: 'create-share', projectId: '' })}>Create share link</Btn></div>
      <p className="mb-2.5 mt-0 text-[13px] text-ink-3">Temporary web links. No app needed to view; revoke any time.</p>
      <List empty="No share links yet.">
        {rows.map((l) => (
          <Item key={l.id}>
            <span className="min-w-0 flex-1"><b>{l.label}</b> <StatusPill status={l.status} /><br /><small className="text-ink-3">{name(l.by)} · until {fmtD(l.expires)} · {l.views} view{l.views === 1 ? '' : 's'}{l.pin ? ' · PIN set' : ''}</small></span>
            <div className="flex flex-wrap gap-2">
              <Btn sm onClick={() => shareCopy(svc.shareUrl(l))}>Copy link</Btn>
              <Btn sm onClick={() => shareOpen(l.id)}>Open</Btn>
              {l.status === 'active' && (can('share', 'a') || l.by === state.userId) && <Btn sm onClick={() => shareRevoke(l.id)}>Revoke</Btn>}
            </div>
          </Item>
        ))}
      </List>
    </Card>
  );
}

// ---------- pages ----------
export function FilesPage({ q }) {
  return (
    <>
      <PageHeader title="Files">{role() === 'partner' && <Btn onClick={() => { nasDry(); }}>Dry run import</Btn>}</PageHeader>
      <FilesView base="#/files" path={q.path} />
      {state.desk.nasMsg && <div className="mt-3.5 whitespace-pre-wrap rounded-r2 bg-accent-soft px-3.5 py-3">{state.desk.nasMsg}</div>}
      <MyLinks />
      <ShareLinksCard />
    </>
  );
}

export function PortfolioPage() {
  const list = svc.portfolio();
  return (
    <>
      <PageHeader title="Studio portfolio" />
      {list.length ? (
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))' }}>
          {list.map((p) => (
            <figure key={p.id} className="m-0 overflow-hidden rounded-r2 border border-line bg-surface">
              <Ph hue={p.hue} seed={p.id} />
              <figcaption className="px-2.5 py-2 text-xs"><b>{p.name}</b><br /><small>{p.type} · {p.year} · {p.city}</small><br />{p.blurb}</figcaption>
            </figure>
          ))}
        </div>
      ) : <Empty>No public projects yet.</Empty>}
    </>
  );
}

export function SharePage({ parts, q }) {
  const id = parts[0];
  const pin = q.pin || '';
  // Opening a link counts a view, so resolve once per id/pin instead of on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const r = useMemo(() => svc.openShare(id, pin), [id, pin]);
  if (!r.ok) {
    return (
      <>
        <PageHeader title="Shared link" />
        <Card>
          <p>{r.why}</p>
          {r.pin && (
            <form
              className="flex items-end gap-2.5"
              onSubmit={(e) => { e.preventDefault(); go(`#/s/${encodeURIComponent(id)}?pin=${encodeURIComponent(new FormData(e.currentTarget).get('pin') || '')}`); }}
            >
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-[13px] font-semibold text-ink-2">PIN<Input name="pin" required /></label>
              <Btn kind="primary" type="submit">View</Btn>
            </form>
          )}
        </Card>
      </>
    );
  }
  return (
    <>
      <PageHeader title={r.link.label} />
      <Card>
        <p className="mt-0 text-[13px] text-ink-3">Shared on the web. No app needed. Expires {fmtD(r.link.expires)}.</p>
        <List empty="Nothing shared here yet.">
          {(r.files || []).map((f, i) => <Item key={i}>{f.name || f.title || 'File'}</Item>)}
        </List>
      </Card>
    </>
  );
}
