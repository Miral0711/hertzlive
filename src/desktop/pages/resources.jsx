// Feature module: resources (files/NAS, share links, portfolio, settings, search).
import { svc } from '../../shared/core.js';
import { Card, DataTable, Empty, PageHeader } from '../../ui/ui';
import { DLink } from '../nav';
import { FromChat } from '../parts';
import { FilesPage, PortfolioPage, SharePage } from '../resources/files';
import { SettingsPage } from '../resources/settings';
import { FilePreviewDialog, CreateShareDialog, ReviewDialog } from '../resources/dialogs';

const GROUPS = [
  ['project', 'Projects'],
  ['person', 'People'],
  ['message', 'Messages'],
  ['voice', 'Voice notes'],
  ['photo', 'Photos'],
];

function SearchPage({ q }) {
  const s = q.q || '';
  if (!s.trim()) return <Empty>Type something to search.</Empty>;
  const rows = svc.search(s);
  const sections = GROUPS.map(([k, l]) => {
    const rs = rows.filter((r) => r.kind === k);
    if (!rs.length) return null;
    return (
      <Card key={k} title={l} className="mb-3.5">
        <DataTable
          cols={['Result', '']}
          rows={rs.map((r) => [
            <span key="t"><b>{r.title}</b><br /><small className="text-ink-3">{r.sub || ''}</small></span>,
            r.msgId ? <FromChat key="a" msgId={r.msgId} /> : <DLink key="a" to={r.ref}>Open</DLink>,
          ])}
        />
      </Card>
    );
  }).filter(Boolean);
  return (
    <>
      <PageHeader title={`Search · ${s}`} />
      {sections.length ? sections : <Card><Empty>No results.</Empty></Card>}
    </>
  );
}

export const pages = {
  files: FilesPage,
  nas: FilesPage,
  portfolio: PortfolioPage,
  s: SharePage,
  settings: SettingsPage,
  search: SearchPage,
};
export const dialogs = {
  'file-preview': FilePreviewDialog,
  'create-share': CreateShareDialog,
  review: ReviewDialog,
};
