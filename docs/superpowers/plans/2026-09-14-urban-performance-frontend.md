# Urban Performance Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign every public, customer, owner, and admin route with one responsive Urban Performance design system while preserving all API and business behavior.

**Architecture:** Keep the existing Vite vanilla-JavaScript application and its render/mount split. Introduce CSS design tokens and a small icon/UI helper layer, then migrate each route group without changing HTTP contracts, route protection, timezone conversion, or idempotency behavior. Add one generated local hero asset and use code-native fallbacks for missing venue media.

**Tech Stack:** Vite 7, vanilla HTML/CSS/JavaScript ES modules, Leaflet, Vitest/JSDOM, Playwright Chromium, built-in image generation.

**Spec:** `docs/superpowers/specs/2026-09-14-frontend-redesign-design.md`

## Global Constraints

- Keep Vite + HTML/CSS/JavaScript ES modules; do not add React, Tailwind, a UI framework, or a chart library.
- Do not change API endpoints, payloads, backend code, auth/session behavior, booking rules, Leaflet provider, or timezone conversion.
- Preserve semantic labels, route paths, live regions, skip link, `data-*` behavior hooks, and 375 px mobile support.
- Keep all API-derived text escaped before HTML interpolation.
- Store generated project imagery under `apps/web/public/assets/`; no remote stock-image dependency, logo, text, or watermark.
- Respect `prefers-reduced-motion`, use visible keyboard focus, and never convey status with color alone.
- Keep the user-owned untracked `docs/project-deep-dive.md` out of every commit.

---

### Task 1: Design tokens, icon primitives, and application shell

**Files:**

- Create: `apps/web/src/components/icons.js`
- Create: `apps/web/src/components/icons.test.js`
- Modify: `apps/web/src/shell.js`
- Modify: `apps/web/src/shell.test.js`
- Modify: `apps/web/src/main.js`
- Modify: `apps/web/src/styles/main.css`
- Modify: `apps/web/index.html`

**Interfaces:**

- Produces: `icon(name, className = "") -> string` for a fixed, internal SVG icon set.
- Produces: `renderShell(content, user = null, pathname = window.location.pathname) -> string` with active route state.
- Preserves: all current navigation labels and role-gated navigation.

- [ ] **Step 1: Write failing shell and icon tests**

Add assertions that `icon("search")` returns an SVG with `aria-hidden="true"`, unknown names return an empty string, the active navigation link has `aria-current="page"`, authenticated identity is rendered, and owner/admin navigation remains role-gated.

```js
expect(icon("search")).toContain('aria-hidden="true"');
expect(icon("missing")).toBe("");
expect(renderShell("<p>Nội dung</p>", user, "/owner")).toContain(
  'href="/owner" aria-current="page"',
);
```

- [ ] **Step 2: Run tests and confirm the new contract fails**

Run: `npm test -w @sports-booking/web -- --run src/components/icons.test.js src/shell.test.js`

Expected: FAIL because `icons.js` and the pathname-aware shell do not exist.

- [ ] **Step 3: Implement icon helper and shell hierarchy**

Create a whitelist of inline line-icons (`search`, `calendar`, `booking`, `bell`, `venue`, `users`, `shield`, `arrow`, `menu`) with no user-provided SVG input. Update shell with brand mark, primary nav, account area, role workspace nav, active state, and existing accessible labels. Pass `window.location.pathname` from `main.js`.

- [ ] **Step 4: Replace legacy CSS foundation with tokens and primitives**

Define the exact palette/radius/spacing/shadow/motion variables from the spec; add reset, body, typography, container, button, form, card, pill, toolbar, metric, navigation, loading/error/empty-state, and reduced-motion rules. Keep old behavior-hook class names but remove obsolete visual declarations.

- [ ] **Step 5: Add document metadata and verify**

Add `theme-color=#081724` and a concise product description in `index.html`. Run:

```bash
npm test -w @sports-booking/web -- --run src/components/icons.test.js src/shell.test.js
npm run typecheck -w @sports-booking/web
npm run lint -w @sports-booking/web
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/index.html apps/web/src/main.js apps/web/src/shell.js apps/web/src/shell.test.js apps/web/src/components/icons.js apps/web/src/components/icons.test.js apps/web/src/styles/main.css
git commit -m "feat(web): establish urban performance design system"
```

### Task 2: Generated hero asset and public discovery experience

**Files:**

- Create: `apps/web/public/assets/sports-hero.png`
- Modify: `apps/web/src/pages/venues.js`
- Modify: `apps/web/src/pages/venues.test.js`
- Modify: `apps/web/src/styles/main.css`

**Interfaces:**

- Consumes: `icon()` and global design tokens from Task 1.
- Preserves: `renderVenueSearchForm`, `renderPublicVenues`, `renderPublicVenueDetail`, `mountPublicVenues`, `mountPublicVenueDetail` signatures and search/query behavior.

- [ ] **Step 1: Write failing public-page tests**

Assert that landing output contains `.discovery-hero`, a local `/assets/sports-hero.png` source, `.search-dock`, real capability copy, sport/result card hierarchy, and venue detail contains `.venue-detail__booking` plus the existing accessible map label.

```js
expect(html).toContain('class="discovery-hero"');
expect(html).toContain("/assets/sports-hero.png");
expect(html).toContain('class="search-dock');
expect(detail).toContain('class="venue-detail__booking');
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm test -w @sports-booking/web -- --run src/pages/venues.test.js`

Expected: FAIL on the new visual structure.

- [ ] **Step 3: Generate and inspect the hero image**

Use built-in image generation with this project-bound prompt:

```text
Use case: photorealistic-natural
Asset type: responsive sports booking website hero
Primary request: cinematic urban multi-sport court in Ho Chi Minh City at blue hour, subtle football, basketball and badminton cues, distant unidentifiable athletes in motion
Composition/framing: wide landscape, strong court leading lines, clear dark negative space on the left and center for Vietnamese headline and search interface
Lighting/mood: premium stadium lighting, energetic but refined
Color palette: deep navy, natural court green, restrained lime highlights
Constraints: realistic photography, no text, no logo, no watermark, no brand signage, no close-up recognizable faces, no oversaturated neon
```

Inspect the output, iterate once only if composition/text artifacts fail constraints, then copy the selected final to `apps/web/public/assets/sports-hero.png`.

- [ ] **Step 4: Implement landing, result cards, and venue detail**

Build the hero/search dock, truthful value strip, sport chips, media-first venue cards with code-native fallback, and two-column detail/booking presentation. Preserve labels, query persistence, form handlers, map region, quote flow, anonymous login redirect, and escaping.

- [ ] **Step 5: Verify public behavior**

Run:

```bash
npm test -w @sports-booking/web -- --run src/pages/venues.test.js src/pages/bookings.test.js src/services/map-provider.test.js
npm run typecheck -w @sports-booking/web
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/public/assets/sports-hero.png apps/web/src/pages/venues.js apps/web/src/pages/venues.test.js apps/web/src/styles/main.css
git commit -m "feat(web): redesign public venue discovery"
```

### Task 3: Authentication, owner application, and customer workspace

**Files:**

- Modify: `apps/web/src/pages/auth.js`
- Modify: `apps/web/src/pages/auth.test.js`
- Modify: `apps/web/src/pages/owner-application.js`
- Modify: `apps/web/src/pages/owner-application.test.js`
- Modify: `apps/web/src/pages/bookings.js`
- Modify: `apps/web/src/pages/bookings.test.js`
- Modify: `apps/web/src/pages/notifications.js`
- Modify: `apps/web/src/pages/notifications.test.js`
- Modify: `apps/web/src/styles/main.css`

**Interfaces:**

- Preserves: all exported render/mount functions, `loginReturnPath`, `bookingIdempotencyKey`, and chronological interval validation.
- Consumes: shared CSS primitives and `icon()`.

- [ ] **Step 1: Add failing structure and state tests**

Assert auth uses `.auth-layout` and `.auth-panel`; owner application has a review-process panel; booking pages use `.workspace-header` and `.booking-list`; notification output uses `.activity-feed`, retains explicit unread text, and empty states link back to `/`.

- [ ] **Step 2: Confirm focused tests fail**

Run:

```bash
npm test -w @sports-booking/web -- --run src/pages/auth.test.js src/pages/owner-application.test.js src/pages/bookings.test.js src/pages/notifications.test.js
```

Expected: FAIL on new structure only; existing behavior assertions remain green where independent.

- [ ] **Step 3: Implement customer-facing redesign**

Create the split auth layout, application review explainer, responsive booking summary/detail/action zones, upgraded booking widget, filter toolbar, activity-feed notifications, and useful empty/error states. Preserve form names, labels, role/live regions, submit locking, return URL validation, API payloads and idempotency key reuse.

- [ ] **Step 4: Verify customer routes**

Run the four focused test files plus `src/services/auth-api.test.js` and `src/services/route-access.test.js`; then run web typecheck/lint.

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/auth.js apps/web/src/pages/auth.test.js apps/web/src/pages/owner-application.js apps/web/src/pages/owner-application.test.js apps/web/src/pages/bookings.js apps/web/src/pages/bookings.test.js apps/web/src/pages/notifications.js apps/web/src/pages/notifications.test.js apps/web/src/styles/main.css
git commit -m "feat(web): elevate customer booking experience"
```

### Task 4: Owner dashboard, calendar, and booking operations

**Files:**

- Modify: `apps/web/src/pages/owner-dashboard.js`
- Modify: `apps/web/src/pages/owner-dashboard.test.js`
- Modify: `apps/web/src/pages/owner-calendar.js`
- Modify: `apps/web/src/pages/owner-calendar.test.js`
- Modify: `apps/web/src/pages/owner-bookings.js`
- Modify: `apps/web/src/pages/owner-bookings.test.js`
- Modify: `apps/web/src/styles/main.css`

**Interfaces:**

- Preserves: `weekRange`, `fetchAllOwnerBookings`, all render/mount exports and every booking action endpoint.
- Produces: consistent owner workspace visual hierarchy reusable by inventory/schedule pages.

- [ ] **Step 1: Write failing owner workspace tests**

Assert dashboard has `.workspace-hero--owner`; calendar has `.week-calendar` plus mobile-friendly `.calendar-day`; booking detail has `.operations-panel`, contact cards and unchanged valid action labels.

- [ ] **Step 2: Confirm tests fail**

Run the three owner test files. Expected: FAIL on new structural classes.

- [ ] **Step 3: Implement owner operations UI**

Redesign metrics/action cards, weekly navigation/day columns, booking list rows, filters, contact details and confirm/reject/cancel/reassign panel. Keep full-pagination fetch, HCM business-date grouping, disabled-while-request behavior and terminal-state action hiding.

- [ ] **Step 4: Verify and commit**

Run focused tests, typecheck and lint; then commit only the listed owner files with:

```bash
git commit -m "feat(web): redesign owner booking workspace"
```

### Task 5: Owner venue inventory, scheduling, and pricing

**Files:**

- Modify: `apps/web/src/pages/owner-venues.js`
- Modify: `apps/web/src/pages/owner-venues.test.js`
- Modify: `apps/web/src/pages/schedule-pricing.js`
- Modify: `apps/web/src/pages/schedule-pricing.test.js`
- Modify: `apps/web/src/styles/main.css`

**Interfaces:**

- Preserves: all current form field names, `data-*` event hooks, API payloads, owner IDs derived server-side, and unique control IDs.

- [ ] **Step 1: Write failing inventory tests**

Assert venue summaries use `.resource-card`, nested offerings use `.resource-subsection`, court rows remain editable, and schedule/pricing separates `.schedule-panel`, `.closure-panel`, and `.pricing-panel` while retaining unique IDs across venues.

- [ ] **Step 2: Confirm tests fail**

Run owner venue and schedule/pricing unit tests. Expected: FAIL on new structure.

- [ ] **Step 3: Implement dense-form redesign**

Use summary-first details/cards, clear nested ownership hierarchy, compact policy metadata, readable court maintenance state, three distinct schedule sections, stronger destructive-action separation, and one-column mobile transformations. Keep every existing submit/click branch and API request unchanged.

- [ ] **Step 4: Verify and commit**

Run focused tests, typecheck and lint; commit with:

```bash
git commit -m "feat(web): modernize owner resource management"
```

### Task 6: Admin dashboard, moderation, users, and audit

**Files:**

- Modify: `apps/web/src/pages/admin-ui.js`
- Modify: `apps/web/src/pages/admin-dashboard.js`
- Modify: `apps/web/src/pages/admin-dashboard.test.js`
- Modify: `apps/web/src/pages/admin-users.js`
- Modify: `apps/web/src/pages/admin-users.test.js`
- Modify: `apps/web/src/pages/admin-moderation.js`
- Modify: `apps/web/src/pages/admin-moderation.test.js`
- Modify: `apps/web/src/pages/admin-audit.js`
- Modify: `apps/web/src/pages/admin-audit.test.js`
- Modify: `apps/web/src/styles/main.css`

**Interfaces:**

- Preserves: pagination/filter query behavior, moderation action labels, confirm dialogs, reason validation, status text and before/after JSON escaping.
- Produces: shared admin status/pagination/empty/error visual patterns.

- [ ] **Step 1: Write failing admin structure tests**

Assert `.workspace-hero--admin`, `.data-row`, `.moderation-queue`, `.audit-timeline`, `aria-current`, existing role/status text and safe escaped audit data.

- [ ] **Step 2: Confirm tests fail**

Run all four admin page test files. Expected: FAIL on new layout contracts.

- [ ] **Step 3: Implement admin redesign**

Create system-control dashboard, responsive identity rows, review queue cards, clear approve/reject/hide hierarchy, audit timeline and polished shared pagination/filter/error states. Preserve all HTTP and mutation behavior.

- [ ] **Step 4: Verify and commit**

Run focused admin tests, typecheck and lint; commit with:

```bash
git commit -m "feat(web): unify admin operations experience"
```

### Task 7: Responsive, accessibility, visual QA, and complete verification

**Files:**

- Modify: `apps/web/src/styles/main.css`
- Modify: `apps/web/e2e/customer.spec.js`
- Modify: `apps/web/e2e/owner.spec.js`
- Modify: `apps/web/e2e/admin.spec.js`
- Modify only if a verified defect requires it: affected `apps/web/src/**/*.js` and matching unit test.

**Interfaces:**

- Consumes: every route and component from Tasks 1–6.
- Preserves: all critical journeys and accessible names.

- [ ] **Step 1: Extend browser assertions before polish**

Add assertions for hero/local image load, active navigation, key workspace surfaces, no horizontal overflow, focus visibility and reduced-motion media behavior without introducing brittle pixel snapshots.

- [ ] **Step 2: Run Playwright and capture actual failures**

Run: `npm run test:e2e -w @sports-booking/web`

Expected before final polish: any remaining layout/selector issues fail with a concrete route/assertion.

- [ ] **Step 3: Inspect rendered routes at three viewports**

Run the Vite preview used by Playwright and inspect public landing/detail, login, customer bookings/notifications, owner dashboard/calendar/inventory/schedule, and all admin pages at 375×812, 768×1024 and 1440×900. Fix only observed clipping, overflow, contrast, hierarchy, loading/error or focus defects.

- [ ] **Step 4: Run the complete web quality gate**

```bash
npm test -w @sports-booking/web
npm run typecheck -w @sports-booking/web
npm run lint -w @sports-booking/web
npm run build -w @sports-booking/web
npm run test:e2e -w @sports-booking/web
npm run format:check
git diff --check
```

Expected: every command passes; Vite production build includes the local hero asset; all Playwright customer/owner/admin/mobile journeys pass.

- [ ] **Step 5: Commit final polish**

```bash
git add apps/web
git commit -m "test(web): verify responsive urban performance redesign"
```

### Task 8: Final scope audit and handoff

**Files:**

- Modify: `docs/quality/final-verification.md`

**Interfaces:**

- Consumes: final command evidence from Task 7.

- [ ] **Step 1: Compare implementation against every design-spec section**

Check palette, typography, shell, public, customer, owner, admin, image, error states, responsive, accessibility, reduced motion and non-goals. Record any gap and fix it with the smallest test-first change before continuing.

- [ ] **Step 2: Record verification evidence**

Append a dated frontend-redesign section to `docs/quality/final-verification.md` listing exact commands/results, tested viewports, generated asset path and unchanged backend scope.

- [ ] **Step 3: Format and commit documentation**

```bash
npm run format:check
git diff --check
git add docs/quality/final-verification.md
git commit -m "docs(web): record frontend redesign verification"
```

- [ ] **Step 4: Report handoff**

Report route coverage, asset path, commits, verification results and any remaining limitation. Do not claim visual QA or tests passed without fresh command evidence.
