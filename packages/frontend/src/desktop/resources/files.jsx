import { useMemo } from 'react';
import { state, svc, can, go, toast, render, fmtD, uid } from '../../shared/core.js';
import { NAS_TREE } from '../../shared/data.js';
import { Btn, Card, Empty, Input, Pill, StatusPill, PageHeader, List, Item, Table, Th, Td, Tr, ToggleChip, Breadcrumbs, Grid2, Banner } from '../../ui/ui';
import Icon from '../../ui/Icon';
import { DLink } from '../nav';
import { first, name, role } from '../helpers';
import { openDialog } from '../session';
import Ph from '../../ui/Ph';
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

function FileRow({ e, p, base, showPath }) {
  const sel = state.desk.fileSel === p;
  if (e.dir) {
    return (
      <Tr>
        <Td><DLink to={fileHref(base, p)} className="inline-flex items-center gap-2 font-medium text-ink no-underline"><Icon name="folder" small className="text-accent-text" /> {showPath ? p : e.p}</DLink></Td>
        <Td className="text-ink-2">Folder</Td>
        <Td className="text-ink-3">{(e.c || []).length ? `${(e.c || []).length} item${(e.c || []).length === 1 ? '' : 's'}` : ''}</Td>
      </Tr>
    );
  }
  return (
    <Tr className={sel ? '[&>td]:bg-accent-soft' : ''}>
      <Td>
        <button type="button" className="inline-flex items-center gap-2 border-0 bg-transparent p-0 text-left text-inherit" onClick={() => fileSel(p)}>
          <Icon name="file" small className="text-ink-3" /> <span className="font-mono text-[13px]">{showPath ? p : e.p}</span>
        </button>
        {e.chat && <> <Pill kind="soft">from chat</Pill></>}
        {e.why && <> <Pill kind="warn">{e.why}</Pill></>}
      </Td>
      <Td className="text-ink-2">{fileKind(e.p)}</Td>
      <Td className="text-ink-2">{e.size || ''}</Td>
    </Tr>
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
  // Active folder gets the accent fill; ancestors of the active folder stay plain so the current
  // location reads at a glance instead of the whole open branch lighting up.
  const treeCls = (on) => `flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap rounded-r1 py-[7px] pr-2 text-[13px] no-underline ${on ? 'bg-accent-soft font-semibold text-accent-text' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'}`;
  const rec = (node, path, d) => (node.c || []).filter((c) => c.dir).map((c) => {
    const p = path + '/' + c.p;
    const on = cur === p || cur.startsWith(p + '/');
    return (
      <div key={p} className="contents">
        <DLink to={fileHref(base, p)} className={treeCls(cur === p)} style={{ paddingLeft: 10 + d * 14 }}><Icon name="folder" small className={cur === p ? '' : 'text-ink-3'} /> {c.p}</DLink>
        {on && rec(c, p, d + 1)}
      </div>
    );
  });
  if (scope) {
    const r = fileResolve(scope);
    if (!r) return null;
    return (<><DLink to={fileHref(base, r.path)} className={treeCls(cur === r.path)}><Icon name="folder" small /><b>{r.node.p}</b></DLink>{rec(r.node, r.path, 1)}</>);
  }
  return fileShares().map((s) => (
    <div key={s.name} className="contents">
      <DLink to={fileHref(base, s.name)} className={treeCls(cur === s.name)}><Icon name="folder" small /><b>{s.name}</b></DLink>
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
  const table = (head, body) => (
    <Table>
      <thead><tr><Th>{head}</Th><Th>Kind</Th><Th>Size / items</Th></tr></thead>
      <tbody>{body}</tbody>
    </Table>
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
  const dirs = rows.filter((x) => x.e.dir).length;
  const fileCount = rows.length - dirs;
  const crumbItems = r.crumbs.map(([l, p], i) => ({ key: p, label: l, to: fileHref(base, p) }));
  return (
    <div className="overflow-hidden rounded-r3 border border-line bg-surface md:grid md:grid-cols-[220px_minmax(0,1fr)]">
      <nav className="flex flex-col gap-0.5 border-b border-line bg-surface p-3 md:border-b-0 md:border-r md:pr-2" aria-label="Folders">
        <p className="m-0 mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Locations</p>
        <FileTree base={base} cur={r.path} scope={scope} />
      </nav>
      <div className="min-w-0 p-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Breadcrumbs items={crumbItems} linkAs={DLink} />
          <span className="text-xs text-ink-3">{dirs} folder{dirs === 1 ? '' : 's'} · {fileCount} file{fileCount === 1 ? '' : 's'}</span>
        </div>
        <form
          className="mb-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); state.desk.fileQ = new FormData(e.currentTarget).get('q') || ''; render(); }}
        >
          <Input type="search" name="q" key={q} defaultValue={q} placeholder={`Search ${scope ? 'this folder' : 'all shares'}`} aria-label="Search files" className="min-w-[200px] flex-1" />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Kind">
            {['', 'CAD', 'PDF', 'Photo', 'Doc'].map((k) => (
              <ToggleChip key={k} on={kind === k} onClick={() => { state.desk.fileKind = k; render(); }}>{k || 'All'}</ToggleChip>
            ))}
          </div>
          <Btn sm onClick={() => { state.desk.fileView = view === 'list' ? 'thumbs' : 'list'; render(); }}>{view === 'list' ? 'Thumbnails' : 'List'}</Btn>
        </form>
        {selE && !selE.node.dir && selE.path === sel && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-r2 bg-accent-soft px-3.5 py-2.5">
            <span className="min-w-0 flex-1 font-mono text-[13px]">{sel.split('/').pop()}</span>
            <Btn sm onClick={() => fileOpen(sel)}>Open</Btn>
            <Btn sm onClick={() => fileCopy(sel)}>Copy path</Btn>
            <Btn sm kind="primary" onClick={() => { fileShare(sel); render(); }}>Share</Btn>
          </div>
        )}
        {listing}
        <p className="mb-0 mt-3 text-xs text-ink-3">Read only. Path <span className="font-mono">{r.share.root}</span>. Copy path opens the file in your CAD app from the NAS.</p>
      </div>
    </div>
  );
}

export function MyLinks() {
  const mine = state.desk.shares.filter((s) => role() === 'partner' || s.by === state.userId);
  return (
    <Card title="My links">
      <List compact empty="No saved links yet. Select a file and choose Share to create one.">
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
    <Card>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2.5"><h2 className="m-0 text-lg font-semibold">Share links</h2><Btn sm kind="primary" onClick={() => openDialog({ kind: 'create-share', projectId: '' })}>Create share link</Btn></div>
      <p className="mb-2.5 mt-0 text-[13px] text-ink-3">Temporary web links. No app needed to view; revoke any time.</p>
      <List compact empty="No share links yet.">
        {rows.map((l) => (
          <Item key={l.id}>
            <span className="min-w-0 flex-1">
              <b>{l.label}</b> <StatusPill status={l.status} />{l.pin && <Pill kind="soft">PIN set</Pill>}
              <br /><small className="text-ink-3">{name(l.by)} · until {fmtD(l.expires)} · {l.views} view{l.views === 1 ? '' : 's'}</small>
            </span>
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
      <PageHeader title="Files" sub="Browse project and employee folders, and share files with clients.">{role() === 'partner' && <Btn onClick={() => { nasDry(); }}>Dry run import</Btn>}</PageHeader>
      <FilesView base="#/files" path={q.path} />
      {state.desk.nasMsg && <Banner className="mt-gap-lg whitespace-pre-wrap">{state.desk.nasMsg}</Banner>}
      <Grid2 className="mt-gap-lg items-start">
        <MyLinks />
        <ShareLinksCard />
      </Grid2>
    </>
  );
}

export function PortfolioPage() {
  const list = svc.portfolio();
  return (
    <>
      <PageHeader title="Studio portfolio" sub="A selection of the studio's completed work." />
      {list.length ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))' }}>
          {list.map((p) => (
            <figure key={p.id} className="m-0 overflow-hidden rounded-r3 border border-line bg-surface">
              <div className="h-44 overflow-hidden bg-surface-2"><Ph hue={p.hue} seed={p.id} ar={1.6} className="h-full" /></div>
              <figcaption className="p-4">
                <b className="block text-base">{p.name}</b>
                <small className="text-ink-3">{p.type} · {p.year} · {p.city}</small>
                {p.blurb && <p className="mb-0 mt-2 text-[13px] text-ink-2">{p.blurb}</p>}
              </figcaption>
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
