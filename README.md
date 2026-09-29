# Archos workspace

An Nx workspace (npm workspaces) holding the Archos product's frontend and backend.

```
packages/
  frontend/   React (Create React App + Tailwind) desktop app — a port of the archos prototype's apps/desktop
  backend/    Express + TypeScript API — PostgreSQL via Prisma, JWT auth
```

## Prerequisites

- Node.js 20+, npm 10+
- Docker (for local Postgres)

## Setup

```sh
npm install
npm run db:up                 # starts Postgres in Docker (localhost:5433)
cp packages/backend/.env.example packages/backend/.env   # already done; edit JWT_SECRET for real use
npx nx run backend:prisma-migrate
```

## Running

```sh
npm run frontend   # http://localhost:3000  (redirects to /desktop/today)
npm run backend    # http://localhost:4000
npm run dev        # both, in parallel
```

## Backend API (v1: auth only)

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/auth/register` | — | `{ name, email, password, role? }` |
| POST | `/auth/login` | — | `{ email, password }` |
| GET | `/auth/me` | Bearer token | — |
| GET | `/health` | — | — |

`role` is one of `partner \| designer \| site_manager \| hr \| client \| contractor` (defaults to `designer`).
Register/login both return `{ token, user }`; use `Authorization: Bearer <token>` on `/auth/me`.

The frontend still reads its own mock data/localStorage (`packages/frontend/src/shared`) — it is not
yet wired up to this API. See `packages/frontend/src/desktop/PORTING.md` for the frontend's own structure.

## Database

Postgres runs in Docker on port **5433** (not 5432, to avoid clashing with any other local Postgres).
Schema lives in `packages/backend/prisma/schema.prisma`; migrations in `packages/backend/prisma/migrations/`.

```sh
npm run db:up      # start
npm run db:down    # stop
npx nx run backend:prisma-migrate   # after changing schema.prisma
npx nx run backend:prisma-generate  # regenerate the Prisma client only
```

## Nx

Both packages are plain npm-workspace packages; Nx (`nx.json`, `workspaceLayout.appsDir: "packages"`)
sits on top purely for task running/caching (`nx serve frontend`, `nx build backend`, `nx run-many ...`).
Nothing about either package's own tooling (react-scripts, tsx/tsc) changed to adopt Nx.
