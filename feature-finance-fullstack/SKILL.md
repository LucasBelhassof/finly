---
name: feature-finance-fullstack
description: Implement and extend this personal finance full-stack application safely. Use when Codex needs to change this specific product across React + Vite + TypeScript frontend, Express + TypeScript backend, PostgreSQL migrations, authentication, transactions, categories, accounts, installments, housing, insights, chat, metrics, imports, or AI-assisted transaction flows while preserving existing contracts and backend-enforced user scoping.
---

# Feature Finance Fullstack

## Overview

Use this skill to make incremental changes in this repository without reworking stable architecture. Prefer extending existing routes, hooks, pages, services, repositories, and auth flows instead of creating parallel structures.

## Core Workflow

1. Read the files in scope before changing behavior.
2. Before coding, write a short mini-spec with exactly:
   - Objective
   - Business rules
   - Risks
   - Acceptance criteria
3. Change the smallest viable set of files.
4. Validate with the minimum relevant checks for the touched scope.
5. Report changed files, commands run, test results, and known limitations.

## Frontend Integration

- Reuse existing routing in `src/App.tsx` and named routes in `src/lib/routes.ts`.
- Prefer existing pages in `src/pages/*`, hooks in `src/hooks/*`, and API access through `src/lib/api.ts`.
- Use existing React Query patterns; keep query keys explicit and invalidate only affected caches.
- Preserve current UI language and reuse existing components before adding new ones.
- Handle the relevant loading, empty, error, and success states for the touched flow.
- When API request/response shapes change, update all related frontend types, forms, hooks, and query consumers in the same change.

## Backend Integration

- Reuse authenticated request context through `request.auth.userId`.
- Extend existing backend modules instead of adding parallel service layers, especially in auth.
- Keep validation before processing.
- Reuse existing service and repository patterns. Only introduce a new service or repository when the logic is materially complex or clearly reusable.
- Preserve response shapes unless a contract change is truly required and localized.

## User Scoping

- Every read/write path touching user data must enforce scoping by authenticated user id on the backend.
- Never rely on frontend filtering for per-user isolation.
- Recheck repository methods, SQL predicates, joins, imports, summaries, and metrics when adding new filters or aggregations.

## Auth Rules

- Extend the existing auth module in `server/modules/auth/*`; do not replace it.
- Keep the access token + refresh token cookie flow intact.
- Reuse `AuthProvider`, `ProtectedRoute`, `PublicOnlyRoute`, and `GET /api/auth/me` when frontend auth data must evolve.
- Respect compatibility with pre-auth users and credential bootstrap flows already present in the database history.

## Financial Domain Rules

- Treat money and aggregates conservatively; do not change calculations casually.
- Keep installment logic, account linkage, balances, monthly totals, and filtered period behavior consistent.
- When changing transactions, categories, accounts, imports, or metrics, check the impact on previews, summaries, and derived charts.
- Preserve compatibility with existing seeded, imported, and legacy data unless the task explicitly includes a data migration plan.
- Add tests when behavior or calculation changes.

## Migrations

- Add new SQL migrations in `server/migrations/`; never edit old migrations.
- Keep migrations sequential, descriptive, and as idempotent as practical.
- Update related types, repositories, services, and consumers together when schema changes.

## Validation

- Run the minimum relevant checks for the touched area.
- Prioritize tests for auth, sessions, financial calculations, installments, imports, migrations, and contract changes.
- If only UI composition changed, do a focused code review and explicitly report that automated tests were not run.

## Repo-Specific Guardrails

- Do not duplicate pages, providers, routes, or authentication stacks when extension is enough.
- Do not move or refactor broad areas without a direct functional requirement.
- Do not trust frontend-only access control for protected or administrative behavior.
- Prefer backend aggregation for dashboards and metrics; keep heavy computation out of JSX when possible.