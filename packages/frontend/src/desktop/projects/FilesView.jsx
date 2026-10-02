// The project Files tab embeds the same browser as the main Files module (desktop/resources/
// files.jsx) scoped to the project's NAS folder — previously a near-identical ~240-line copy of
// the tree/row/toolbar logic kept in sync by hand. Re-exporting keeps one implementation for both
// surfaces, so a UI change to the browser (tree, breadcrumbs, toolbar, table) shows up in both
// the Files page and every project's Files tab.
export { FilesView } from '../resources/files';
