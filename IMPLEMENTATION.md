# Backend Implementation

## Architecture

The application uses focused NestJS modules for drones, missions, maintenance, reporting, and
health. Controllers translate HTTP requests; application services own transactions and repository
access; pure domain functions own state transitions, maintenance calculations, overlap reasoning,
and serial normalization.

TypeORM repositories are injected directly. The backend intentionally avoids generic repository
interfaces, CQRS, event buses, and additional personnel or location entities.

## Database design

The schema has three domain tables:

- `drones` stores inventory, current persisted operational status, exact flight-hour totals, and
  the latest maintenance baseline.
- `missions` stores schedules, lifecycle timestamps, completion/abort hours, and immutable
  terminal history.
- `maintenance_logs` stores immutable completed-maintenance records.

Foreign keys use `ON DELETE RESTRICT`. A drone is hard-deleted only when both histories are empty;
otherwise retirement preserves the record.

Flight hours use PostgreSQL `numeric(10,2)`. Decimal arithmetic is used for calculations and the
database performs atomic persisted increments. Operational timestamps use `timestamptz`;
maintenance boundaries use UTC `date` values.

## Effective drone status

Persisted status records event-driven state, while the API exposes effective status. Precedence is:

1. `RETIRED`
2. `IN_MISSION`
3. persisted maintenance or maintenance due by hours/date
4. `AVAILABLE`

This prevents a drone from remaining operational when a date threshold passes without a write or
background job. The same maintenance policy supplies API commands, dashboard projections, and
fleet-health calculations.

## Mission state machine

Allowed transitions are:

- `PLANNED → PRE_FLIGHT_CHECK`
- `PRE_FLIGHT_CHECK → IN_PROGRESS`
- `IN_PROGRESS → COMPLETED`
- Any non-terminal state → `ABORTED`

Terminal states have no outgoing transitions. Mission editing is limited to `PLANNED`; lifecycle
changes use explicit command endpoints.

An in-progress abortion requires positive hours and adds them to the drone exactly once. A
pre-start abortion rejects flight hours.

## Maintenance calculations

Maintenance is due at 50.00 hours since the latest baseline or on baseline date plus 90 calendar
days. At the date boundary the drone is due and unavailable; date-overdue begins on the following
UTC date. Reaching 50.00 hours is immediately hour-overdue.

Maintenance-log hours must be within 0.10 hours of the authoritative drone total. Dates cannot
precede the current baseline or exceed today. A valid log updates the baseline and next date in
the same transaction.

## Mission-overlap protection

Application validation finds conflicts early and returns `MISSION_OVERLAP`. PostgreSQL remains the
concurrency authority through a partial GiST exclusion constraint over drone UUID and
`tstzrange(planned_start_at, planned_end_at, '[)')` for non-terminal missions. `btree_gist`
provides UUID equality, and `[)` permits exact adjacency.

## Transactions and concurrency

- Scheduling locks the drone, rechecks effective eligibility, checks overlap, and inserts.
- Starting locks mission and drone and updates both atomically.
- Completion/abort lock both rows and apply hours exactly once.
- Maintenance completion locks the drone and writes log/baseline atomically.
- Retirement locks the drone and checks every non-terminal mission.
- Hard deletion locks the drone and verifies empty histories.

The exclusion constraint handles simultaneous scheduling attempts even when both application
checks initially observe no conflict.

## Validation and errors

Validation is layered across DTOs, domain services, and named PostgreSQL constraints. Errors use a
stable response with `statusCode`, `code`, `message`, optional `details`, `timestamp`, and `path`.
Malformed input uses 400, missing resources 404, current-state conflicts 409, semantically invalid
commands 422, and database-unavailable health responses 503.

## Migrations

Schema synchronization and `migrationsRun` are disabled. Development executes TypeScript
migrations through the TypeORM ts-node wrapper. Production builds migrations to `dist` and runs
them as JavaScript. Seed data is never part of migrations.

## Seed strategy

The seed uses stable IDs, relative dates, and a single transaction. Reruns remove only known seed
IDs before recreating the dataset. It includes all statuses and types, upcoming/recent work,
completed and aborted hours, maintenance alerts, and both histories.

## Testing architecture

Pure rules are tested without Nest or a database. Supertest integration tests use PostgreSQL,
actual migrations, transaction boundaries, and the GiST constraint. Tables are truncated between
integration tests, and suites run serially while concurrency cases use independent connections.

## Trade-offs and limitations

- Effective status requires shared read logic because time alone can change availability.
- Historical records are immutable; an auditable correction workflow is deferred.
- Authentication, notifications, telemetry, and background scheduling are outside the current
  backend.
- Free Render deployment runs migrations before startup because free Web Services do not provide
  pre-deploy commands. This must move to pre-deploy before horizontal scaling.
