# Production Release Checklist

## Purpose

This checklist is the minimum repository-specific release gate for Finly production deployments.

It is intentionally practical. The goal is to reduce release risk with explicit checks that match the current repository, not to define a platform-specific deployment process.

## Pre-Deploy

### 1. Confirm repository state

- The intended branch and revision are known.
- CI is green for the exact release candidate.
- `npm run test:e2e` passed in CI.
- No known blocking regression is open for auth, onboarding, accounts, transactions, import, admin access, export/delete, or billing placeholder routes.

### 2. Confirm required environment variables

Verify the production environment has the current expected values configured:

- `DATABASE_URL`
- `APP_ORIGIN`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `PASSWORD_RESET_BASE_URL`
- `NODE_ENV=production`
- `PORT`

If the frontend is deployed separately, also confirm:

- `VITE_API_URL`

Do not print or copy secret values into tickets, chat logs, or release notes.

### 3. Confirm origin and auth posture

- `APP_ORIGIN` matches the real frontend origin exactly.
- JWT secrets are present and not using local or placeholder values.
- Password reset links generated from `PASSWORD_RESET_BASE_URL` point to the intended public frontend.
- Admin access posture is known:
  - the expected admin user already exists, or
  - the operator has the approved bootstrap path ready

### 4. Confirm backup readiness

Before running `npm run db:migrate` in production:

- create a fresh Postgres backup
- record the backup timestamp
- record the operator
- record the backup path or managed snapshot reference

Use the runbook in `docs/operations/backup-restore.md`.

### 5. Confirm observability readiness

- request logs are available
- `x-request-id` can be traced in backend logs
- `/api/health` and `/api/ready` are reachable from the deployment environment
- the frontend fallback path for runtime crashes is present

Reference: `docs/observability.md`

## Deploy

### 1. Build the release candidate

Run:

```bash
npm run build
```

### 2. Apply database migrations

Run:

```bash
npm run db:migrate
```

Rules:

- do not skip migrations if the release depends on schema changes
- do not edit old migrations in place
- if a migration fails after partial release activity, treat recovery as an explicit operational incident

### 3. Start the backend

Use the repository-supported runtime:

- local compiled runtime: `npm run server:start`
- container runtime: `node dist-server/server.js`

Deployment-platform-specific wrappers are optional, but the runtime contract should remain the same.

## Post-Deploy

### 1. Health and readiness checks

Verify:

- `GET /api/health` returns `200`
- `GET /api/ready` returns `200`

### 2. Smoke checks

Confirm these flows on the deployed environment:

- login works
- refresh/session continuity works
- `/pricing` loads
- `/legal/terms` loads
- `/legal/privacy` loads
- `/legal/cancellation` loads
- `/billing/success` loads
- `/billing/cancel` loads
- unauthenticated `/` follows the expected auth redirect flow
- dashboard loads for an authenticated regular user
- account listing loads
- transaction listing loads

### 3. Admin and security posture

Confirm:

- regular users remain blocked from `/api/admin`
- the intended admin user can still access the admin area
- `APP_ORIGIN` still matches effective frontend traffic
- expected security headers are still present

### 4. Release decision

If all checks pass:

- mark the release as complete
- keep the pre-deploy backup reference attached to the release record

If any critical check fails:

- stop additional rollout steps
- decide between forward-fix and rollback using the section below

## Rollback

### 1. Application rollback

- return the backend and frontend to the previous known-good artifact
- confirm `/api/health` and `/api/ready` again after rollback

### 2. Database rollback posture

- do not assume schema rollback is safe
- if migrations were already applied, prefer a forward-fix unless there is an explicit, approved restore plan
- if restore is required, do not restore directly into production without an incident-level decision

Use the runbook in `docs/operations/backup-restore.md`.

### 3. Validation after rollback

Re-run the minimum smoke checks:

- login
- dashboard
- accounts
- transactions
- `/api/health`
- `/api/ready`

## Notes

- This checklist is repository-specific but deployment-platform-neutral.
- If the runtime architecture changes, update this checklist together with `docs/deploy.md`, `docs/env.md`, and `docs/operations/backup-restore.md`.
