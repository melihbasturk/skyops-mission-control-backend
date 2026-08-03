# SkyOps Mission Control API

NestJS REST API for drone inventory, mission execution, maintenance tracking, dashboard data,
and fleet-health reporting.

## Prerequisites

- Node.js 20 or newer
- npm
- Docker with Docker Compose, or PostgreSQL 16 with the `btree_gist` extension available

## Installation

```bash
cd skyops-mission-control-backend
npm install
cp .env.example .env
```

## Environment variables

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `development`, `test`, or `production` |
| `PORT` | HTTP port; Render supplies this in production |
| `DATABASE_URL` | PostgreSQL connection URL |
| `TEST_DATABASE_URL` | Dedicated PostgreSQL integration-test URL |
| `FRONTEND_URL` | Exact allowed CORS origin |

Startup fails before the HTTP server listens when required configuration is missing or invalid.

## Local PostgreSQL

From the repository root:

```bash
docker compose up -d postgres
docker compose ps
```

The Compose service creates `skyops` and `skyops_test` databases. If the persistent volume was
created before the test initialization script existed, create `skyops_test` manually or recreate
the development volume intentionally.

## Migrations

```bash
npm run migration:show
npm run migration:run
npm run migration:revert
```

Generate a migration after changing entities:

```bash
npm run migration:generate
```

Production migrations run from compiled JavaScript:

```bash
npm run build
npm run migration:run:prod
```

TypeORM schema synchronization and automatic migration execution are disabled in every
environment.

## Development and production

```bash
npm run start:dev
npm run build
npm run start:prod
```

The server listens on `0.0.0.0` and `PORT`. API endpoints use `/api/v1`; health uses `/health`.

## Seed data

Seed commands are always manual:

```bash
npm run seed:dev
npm run seed:reset
```

For a production database, build first and explicitly run:

```bash
npm run build
npm run seed:prod
```

The deterministic dataset contains 24 drones, 60 missions, and 36 maintenance logs. Seeding is
never run by startup, migrations, or normal deployment.

## Tests

```bash
npm run test:unit
npm run test:integration
npm run test:cov
```

Integration tests require `TEST_DATABASE_URL` and real PostgreSQL. They run migrations and clean
domain tables between tests; SQLite is not supported.

## Render deployment

Create a Render Web Service with:

- Root Directory: `skyops-mission-control-backend`
- Build Command: `npm ci && npm run build`
- Start Command: `npm run migration:run:prod && npm run start:prod`
- Health Check Path: `/health`

Set `NODE_ENV=production`, `DATABASE_URL` to the same-region Render PostgreSQL internal URL, and
`FRONTEND_URL` to the Render Static Site URL. Render supplies `PORT`.

The start-command migration arrangement is for a single free Web Service instance. Before
scaling or moving to multiple instances, move `npm run migration:run:prod` to a paid Render
pre-deploy command and use `npm run start:prod` as the start command.

Production seed execution remains manual. From outside Render, use the database's external TLS
URL only for the duration of the authorized seed operation.
