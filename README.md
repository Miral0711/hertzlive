# Archos workspace

An Nx workspace (npm workspaces) holding the Archos product's frontend.

```
packages/
  frontend/   React (Create React App + Tailwind) desktop app — a port of the archos prototype's apps/desktop
```

This is a **frontend-only** project: there is no backend, database, or API server. All data
(projects, sites, chat, attendance, leave/holiday management, tenant/persona switching, etc.) is
local mock/seed data in `packages/frontend/src/shared`, loaded into memory at boot and persisted
to the browser's `localStorage` so changes survive a reload. See
`packages/frontend/src/desktop/PORTING.md` for the frontend's own structure.

## Prerequisites

- Node.js 20+, npm 10+

## Setup

```sh
npm install
```

## Running

```sh
npm run frontend   # http://localhost:3000  (redirects to /desktop/today)
npm run dev        # same, alias
```

Sign in with any of the demo accounts shown on the login screen (password `password`), or use the
"viewing as" persona switcher once signed in.

## Nx

The frontend is a plain npm-workspace package; Nx (`nx.json`, `workspaceLayout.appsDir: "packages"`)
sits on top purely for task running/caching (`nx serve frontend`, `nx build frontend`). Nothing
about the package's own tooling (react-scripts) changed to adopt Nx.
