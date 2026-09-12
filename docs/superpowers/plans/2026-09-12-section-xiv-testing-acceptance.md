# Section XIV Testing Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-verify all 25 acceptance criteria in Section XIV of `prompt.md` against the final repository and preserve fresh, reproducible evidence.

**Architecture:** Keep the existing layered test strategy: pure policy tests for deterministic rules, PostgreSQL/MinIO/MailHog integration tests for durable boundaries, NestJS E2E for HTTP/auth contracts, Playwright for critical browser journeys, and Docker Compose for the clean-start contract. Do not add product behavior unless a failing acceptance test proves a concrete gap.

**Tech Stack:** Jest, Vitest, Playwright, PostgreSQL, Redis, BullMQ, MailHog, MinIO, Docker Compose, npm workspaces

**Spec:** `prompt.md`, Section XIV — Testing Acceptance Criteria

## Global Constraints

- All 25 criteria must have an executable test or an observed Docker smoke assertion.
- Critical tests must not be skipped in the acceptance run.
- PostgreSQL integration must use `sports_booking_test`, never the development database.
- Booking concurrency must exercise simultaneous requests and validate exact capacity.
- Preserve project data volumes and the four user-owned untracked context files.
- Record exact commands, suite/test counts, failures and environmental limitations.

---

### Task 1: Audit the acceptance matrix

**Files:**

- Modify: `docs/quality/phase-11-hardening-checklist.md`
- Create: `docs/quality/testing-acceptance-report.md`

**Interfaces:**

- Consumes: the 25 criteria in `prompt.md` and existing Jest/Vitest/Playwright test cases
- Produces: a criterion-by-criterion evidence matrix with no undocumented gaps

- [x] **Step 1: Inspect every mapped test case**

  Read the named test body, not only its filename, and verify that its observable assertions match the criterion.

- [x] **Step 2: Identify gaps**

  Treat missing assertions, skipped critical tests, state-order dependencies and mock-only evidence as gaps.

- [x] **Step 3: Add a failing test for each real gap**

  Run the narrowest Jest, Vitest or Playwright command and confirm failure for the expected missing behavior before changing production code.

- [x] **Step 4: Implement only what the failing test requires**

  Keep controllers thin, server-authoritative price/court assignment intact, and PostgreSQL as durable truth.

- [x] **Step 5: Re-run each narrow test until green**

  Confirm the added assertion fails when the corresponding protection is mentally or locally mutated.

### Task 2: Run service-backed acceptance suites

**Files:**

- Modify: `docs/quality/testing-acceptance-report.md`

**Interfaces:**

- Consumes: Docker PostgreSQL, Redis, MinIO and MailHog services
- Produces: fresh API integration/E2E and worker integration evidence with zero critical skips

- [x] **Step 1: Start infrastructure and prepare the test database**

  Run Docker Compose services, create `sports_booking_test` if absent, and apply all Prisma migrations to the test database.

- [x] **Step 2: Run API integration tests**

  Run with `TEST_DATABASE_URL` and `TEST_OBJECT_STORAGE=true`; require all database and object-storage suites to execute.

- [x] **Step 3: Run API E2E tests**

  Run with `TEST_DATABASE_URL`; require auth, authorization, public access and critical booking flows to execute.

- [x] **Step 4: Run worker tests with external services enabled**

  Run with `TEST_DATABASE_URL` and `TEST_MAILHOG=true`; require PostgreSQL lifecycle/outbox and real SMTP coverage.

### Task 3: Run browser, quality and Docker clean-start gates

**Files:**

- Modify: `docs/quality/testing-acceptance-report.md`
- Modify: `docs/quality/final-verification.md`

**Interfaces:**

- Consumes: final repository tree and Docker Compose contract
- Produces: browser E2E, static-quality, build and clean-start evidence

- [x] **Step 1: Run full repository verification**

  Run `npm run verify`; require format, lint, typecheck, unit tests and production builds to pass.

- [x] **Step 2: Run Playwright critical journeys**

  Run all customer, owner and admin browser scenarios, including mobile/keyboard checks.

- [x] **Step 3: Exercise a Docker clean start**

  Build the final images, wait for healthy services, run migrations and seed, then check web, API health/readiness, Swagger, worker, PostgreSQL, Redis, MailHog and MinIO.

- [x] **Step 4: Preserve evidence and clean generated Docker artifacts**

  Stop project containers without deleting named volumes. Record observed results and remove only reproducible project images/cache when safe.

### Task 4: Review and checkpoint

**Files:**

- Modify: `docs/quality/testing-acceptance-report.md`
- Modify: `docs/quality/final-verification.md`
- Modify: `docs/quality/phase-11-hardening-checklist.md`

**Interfaces:**

- Consumes: command outputs and the final Git diff
- Produces: one auditable acceptance-verification commit

- [x] **Step 1: Review the scoped diff and acceptance coverage**

  Confirm every criterion maps to fresh evidence and no secret, generated output or unrelated user file is staged.

- [x] **Step 2: Run final documentation checks**

  Run Prettier and `git diff --check`; validate local Markdown links.

- [x] **Step 3: Commit the acceptance evidence**

  Stage only the plan and quality documentation plus any test/fix files required by observed failures, then commit as `test(acceptance): verify section xiv criteria`.
