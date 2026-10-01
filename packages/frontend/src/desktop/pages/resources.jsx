// Feature module: resources (files/NAS, share links, portfolio, settings).
import { FilesPage, PortfolioPage, SharePage } from '../resources/files';
import { SettingsPage } from '../resources/settings';
import { FilePreviewDialog, CreateShareDialog, ReviewDialog } from '../resources/dialogs';

export const pages = {
  files: FilesPage,
  nas: FilesPage,
  portfolio: PortfolioPage,
  s: SharePage,
  settings: SettingsPage,
};
export const dialogs = {
  'file-preview': FilePreviewDialog,
  'create-share': CreateShareDialog,
  review: ReviewDialog,
};
