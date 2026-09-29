// Feature module: sites (+ import wizard, sample library, templates).
import { SitesIndex, SitePage } from '../sites/SiteBoard';
import ImportPage from '../sites/Import';
import { SamplesPage, TemplatesPage } from '../sites/Library';
import { LogDialog, TemplateDialog } from '../sites/Dialogs';

export const pages = {
  sites: ({ parts, q }) => (parts[0] ? <SitePage id={parts[0]} q={q} /> : <SitesIndex />),
  import: () => <ImportPage />,
  samples: () => <SamplesPage />,
  templates: () => <TemplatesPage />,
};

export const dialogs = {
  log: LogDialog,
  template: TemplateDialog,
};
