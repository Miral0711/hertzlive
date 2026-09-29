# Porting guide: archos desktop prototype -> React

Source of truth: `/Users/miral/projects/archos/apps/desktop/src/desk.js` (string-template pages +
one big `ACT` click-handler map) and `/Users/miral/projects/archos/shared/*` (already ported to
`src/shared/*`). Do not edit the prototype.

## Architecture
- `src/shared/core.js`: the prototype's mutable `state`, `svc` service layer, RBAC (`can`), `toast`,
  `go`, `render`, formatters (`inr`, `fmtD`, `fmtT`...). UNCHANGED semantics. Mutate `state`/call
  `svc.*` then call `render()` (or `toast()`, `go()`, which render) and React re-renders.
  `Shell` subscribes with `useStore()`, so pages re-render on every `render()`.
- `src/desktop/data.js`: desktop-only seed data + `seedDesk`. `src/desktop/helpers.js`: `P V name first role staff days navFor`.
- URL model: the app lives under `/desktop`. Legacy hash routes still work as strings:
  `go("#/projects/p1?tab=files")`, `<DLink to="#/sites/s1">` (`src/desktop/nav.jsx`).
  `state.route` and `parseRoute()` are kept in sync by Shell.
- Pages: a page is a component `({ parts, q }) => JSX` where `parts` = path segments after the
  page name (the prototype's `PAGES.x = ([id], q) => ...`) and `q` = query params object.
- Dialogs: prototype `state.desk.dialog = {kind, ...}` + `dialogHtml()` branch becomes a component
  `({ d }) => <Modal>` registered under the same `kind`. Open with `openDialog({kind,...})`
  (`session.js`), close with `closeDialog()`. Use `Modal`/`ModalActions` from `./Modal`.
- Feature modules export `pages` and `dialogs` objects from `src/desktop/pages/<module>.jsx`; that
  is the only way things get registered (`registry.js` already imports every module).
- Forms: React `onSubmit` handlers replacing `data-action` forms. `formData(form)` is the FormData helper.
  Use uncontrolled inputs (`defaultValue`) unless the prototype live-updates.
- `ACT[...]` handlers become event handlers on the buttons that had `data-action`. Port their
  logic 1:1 (same svc calls, same toasts, same validation). Find them with
  `grep -n '"name":\|name:' desk.js` inside the ACT map (lines ~4360-6207) by action name.

## Styling: Tailwind only (no new CSS files)
- Tokens are CSS variables exposed as Tailwind colors: `bg-surface`, `bg-surface-2/3`, `text-ink`,
  `text-ink-2/3`, `border-line`, `border-line-2`, `bg-accent`, `text-accent-text`, `bg-accent-soft`,
  `text-accent-ink`, `bg-warn-soft text-warn`, `bg-crit-soft text-crit`, `bg-ok-soft text-ok`, radii
  `rounded-r1/r2/r3`, shadows `shadow-s1/s2`. Dark mode and per-studio accent come for free.
- Use the primitives in `src/ui/ui.jsx` (Btn, Pill, StatusPill, Chip, Card, Cards, Grid2, Grid3, Row, Kpi, Kpis,
  PageHeader, Empty, Banner, Avatar, Bar, Item, ItemBody, List, Tabs, Field, Input, Select, Textarea,
  DataTable) and `Icon` (`src/ui/Icon.jsx`). Shared desktop parts: `src/desktop/parts.jsx`.
  Look at the prototype CSS in `/Users/miral/projects/archos/apps/desktop/src/head.html` for exact
  spacing/look of anything without a primitive; translate to utility classes.
- Never use `dangerouslySetInnerHTML` for user/seed text (the prototype used `esc()`; React escapes).
- Keep the accessibility the prototype had (aria-*, labels, roles, focus behaviour where practical).
- Links between pages: `<DLink to="#/...">`, never raw `<a href="#/...">`.
- External/shared code you need that does not exist: create it inside YOUR OWN files. Do NOT edit
  `src/ui/*`, `src/shared/*`, `src/desktop/{Shell,session,registry,parts,helpers,nav,Modal,DialogHost,data}.*`
  or another feature's file. (If a shared thing is truly broken, say so in your report.)
- Cross-feature chat/AI helpers: import only from `src/desktop/chat/assist.jsx` (stubs owned by "chat").

## Verifying
- `npx eslint --ext .js,.jsx src/desktop/pages/<yours>.jsx <other files you created>` must be clean (project
  eslint config; catches undefined names and hook mistakes).
- `BUILD_PATH=<scratchpad>/build-<yourname> CI=false npx react-scripts build` must compile
  (other agents work in parallel, so ignore errors in files that are not yours and retry later).
  Always use your own BUILD_PATH; never build into `build/`.
