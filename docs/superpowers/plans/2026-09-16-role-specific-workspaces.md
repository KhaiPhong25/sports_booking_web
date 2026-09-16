# Role-Specific Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every authenticated user to one effective-role workspace, render only that workspace's navigation, and keep the shared account dropdown consistently left-aligned.

**Architecture:** Centralize role priority and route authorization in pure helpers under `route-access.js`. Authentication and application bootstrap consume those helpers before rendering, while `renderShell()` consumes the same effective role to select exactly one navigation. NestJS guards remain the security authority; this plan changes frontend routing and presentation only.

**Tech Stack:** Vite 7, vanilla JavaScript ES modules, Vitest + jsdom, Playwright, CSS

**Spec:** `docs/superpowers/specs/2026-09-16-role-specific-workspaces-design.md`

## Global Constraints

- Effective-role priority is exactly `ADMIN > OWNER > CUSTOMER`.
- Admin lands on `/admin`, Owner on `/owner`, Customer on `/`.
- `/profile` and logout remain available to every authenticated role.
- Owner/Admin must not render Customer navigation or another privileged workspace navigation.
- Unauthorized direct URLs redirect before mounting page-specific code.
- `returnTo` must be same-origin, syntactically valid, and allowed for the effective role.
- Backend role and ownership enforcement must not be weakened or replaced.
- Preserve the current vanilla JavaScript architecture and existing uncommitted user work.
- Stage only files named by each checkpoint; do not include unrelated working-tree changes.

---

### Task 1: Centralized role and route policy

**Files:**

- Modify: `apps/web/src/services/route-access.test.js`
- Modify: `apps/web/src/services/route-access.js`

**Interfaces:**

- Produces: `effectiveRole(roles): "ADMIN" | "OWNER" | "CUSTOMER" | null`
- Produces: `workspaceHome(roles): "/admin" | "/owner" | "/" | null`
- Produces: `canAccessRoute(pathname, roles): boolean`
- Preserves: `requiresSession(pathname): boolean`

- [x] **Step 1: Write failing unit tests for priority, homes, and access matrix**

```js
expect(effectiveRole(["CUSTOMER", "OWNER", "ADMIN"])).toBe("ADMIN");
expect(workspaceHome(["CUSTOMER", "OWNER"])).toBe("/owner");
expect(canAccessRoute("/admin/users", ["CUSTOMER", "ADMIN"])).toBe(true);
expect(canAccessRoute("/bookings", ["CUSTOMER", "ADMIN"])).toBe(false);
expect(canAccessRoute("/owner/calendar", ["CUSTOMER", "OWNER"])).toBe(true);
expect(canAccessRoute("/admin", ["CUSTOMER", "OWNER"])).toBe(false);
expect(canAccessRoute("/profile", ["CUSTOMER", "OWNER"])).toBe(true);
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `npm test -w @sports-booking/web -- src/services/route-access.test.js`

Expected: FAIL because the three new exports do not exist.

- [x] **Step 3: Implement the minimal pure policy**

```js
const rolePriority = ["ADMIN", "OWNER", "CUSTOMER"];

export function effectiveRole(roles = []) {
  return rolePriority.find((role) => roles.includes(role)) ?? null;
}

export function workspaceHome(roles = []) {
  return (
    { ADMIN: "/admin", OWNER: "/owner", CUSTOMER: "/" }[effectiveRole(roles)] ??
    null
  );
}
```

Implement `canAccessRoute()` with explicit shared, customer, owner and admin route groups. Match `/owner/apply` before the `/owner/` prefix so it remains Customer-only.

- [x] **Step 4: Run focused and full web unit tests**

Run: `npm test -w @sports-booking/web -- src/services/route-access.test.js`

Expected: PASS.

Run: `npm test -w @sports-booking/web`

Expected: PASS.

- [x] **Step 5: Commit the policy checkpoint**

```bash
git add apps/web/src/services/route-access.js apps/web/src/services/route-access.test.js
git commit -m "feat(web): define role workspace access policy"
```

### Task 2: Exclusive application shell and account-menu alignment

**Files:**

- Modify: `apps/web/src/shell.test.js`
- Modify: `apps/web/src/shell.js`
- Modify: `apps/web/src/styles/main.css`

**Interfaces:**

- Consumes: `effectiveRole(roles)` and `workspaceHome(roles)` from Task 1.
- Produces: `renderShell(content, user, pathname)` with exactly one role navigation.
- Preserves: `mountShell(container, dependencies)` for account dropdown/logout behavior.

- [x] **Step 1: Write failing shell tests for mutually exclusive navigation and role-aware brand links**

```js
document.body.innerHTML = renderShell("<p>Admin</p>", {
  roles: ["CUSTOMER", "ADMIN"],
});
expect(document.querySelector(".admin-nav")).not.toBeNull();
expect(document.querySelector(".primary-nav")).toBeNull();
expect(document.querySelector(".owner-nav")).toBeNull();
expect(document.querySelector("a.brand")?.getAttribute("href")).toBe("/admin");
```

Add the equivalent Owner assertion (`/owner`) and preserve Customer/anonymous primary navigation assertions.

- [x] **Step 2: Run shell tests and verify RED**

Run: `npm test -w @sports-booking/web -- src/shell.test.js`

Expected: FAIL because Admin/Owner still render `.primary-nav` and brand links to `/`.

- [x] **Step 3: Render one navigation from the effective role**

Import the Task 1 helpers, calculate the role once, render only Customer, Owner, or Admin navigation, and set the brand destination to `workspaceHome(roles) ?? "/"`.

- [x] **Step 4: Left-align both dropdown actions**

```css
.account-menu__popover a,
.account-menu__popover button {
  justify-content: flex-start;
  text-align: left;
}
```

- [x] **Step 5: Run shell and full web unit tests**

Run: `npm test -w @sports-booking/web -- src/shell.test.js`

Expected: PASS.

Run: `npm test -w @sports-booking/web`

Expected: PASS.

- [x] **Step 6: Commit the shell checkpoint**

```bash
git add apps/web/src/shell.js apps/web/src/shell.test.js apps/web/src/styles/main.css
git commit -m "feat(web): render exclusive role navigation"
```

### Task 3: Role-aware login and bootstrap redirects

**Files:**

- Modify: `apps/web/src/pages/auth.test.js`
- Modify: `apps/web/src/pages/auth.js`
- Modify: `apps/web/src/services/route-access.test.js`
- Modify: `apps/web/src/services/route-access.js`
- Modify: `apps/web/src/main.js`
- Modify: `apps/web/e2e/customer.spec.js`
- Modify: `apps/web/e2e/owner.spec.js`
- Modify: `apps/web/e2e/admin.spec.js`

**Interfaces:**

- Consumes: `canAccessRoute(pathname, roles)`, `workspaceHome(roles)`, and `requiresSession(pathname)`.
- Produces: `loginReturnPath(search, roles)` returning an allowed local route or role home.
- Produces: `redirectForRoute(pathname, search, user)` returning a redirect URL or `null`.

- [x] **Step 1: Write failing auth tests for role landing and safe `returnTo`**

```js
expect(loginReturnPath("", ["CUSTOMER", "ADMIN"])).toBe("/admin");
expect(loginReturnPath("", ["CUSTOMER", "OWNER"])).toBe("/owner");
expect(
  loginReturnPath("?returnTo=%2Fadmin%2Fusers", ["CUSTOMER", "OWNER"]),
).toBe("/owner");
expect(loginReturnPath("?returnTo=%2Fprofile", ["CUSTOMER", "ADMIN"])).toBe(
  "/profile",
);
```

- [x] **Step 2: Write failing tests for the bootstrap route decision**

```js
expect(redirectForRoute("/admin", "", null)).toBe("/login?returnTo=%2Fadmin");
expect(
  redirectForRoute("/admin/users", "", {
    roles: ["CUSTOMER", "ADMIN"],
  }),
).toBeNull();
expect(
  redirectForRoute("/bookings", "", {
    roles: ["CUSTOMER", "ADMIN"],
  }),
).toBe("/admin");
expect(
  redirectForRoute("/admin", "", {
    roles: ["CUSTOMER", "OWNER"],
  }),
).toBe("/owner");
```

- [x] **Step 3: Run focused tests and verify RED**

Run: `npm test -w @sports-booking/web -- src/pages/auth.test.js src/services/route-access.test.js`

Expected: FAIL because login and bootstrap do not use role policy yet.

- [x] **Step 4: Implement role-aware login destination**

Keep the existing same-origin URL parsing. After parsing, return the requested target only when `canAccessRoute(target.pathname, roles)` is true; otherwise return `workspaceHome(roles) ?? "/"`. In `mountAuthPage`, use the returned login response's `user.roles`.

- [x] **Step 5: Apply redirect before shell render in `main.js`**

After session restoration and before selecting/rendering a page, redirect anonymous protected routes to login and authenticated cross-role routes to `workspaceHome(user.roles)`. Do not mount page code after calling `window.location.assign()`.

- [x] **Step 6: Add E2E assertions for exclusive menus and cross-role redirects**

```js
await page.goto("/admin");
await expect(
  page.getByRole("navigation", { name: "Điều hướng quản trị" }),
).toBeVisible();
await expect(
  page.getByRole("navigation", { name: "Điều hướng chính" }),
).toHaveCount(0);
await page.goto("/bookings");
await expect(page).toHaveURL("/admin");
```

Add corresponding Owner (`/admin` redirects to `/owner`) and Customer (`/admin` redirects to `/`) coverage.

- [x] **Step 7: Run unit and E2E tests**

Run: `npm test -w @sports-booking/web`

Expected: PASS.

Run: `npm run test:e2e -w @sports-booking/web`

Expected: PASS.

- [x] **Step 8: Commit the routing checkpoint**

```bash
git add apps/web/src/pages/auth.js apps/web/src/pages/auth.test.js apps/web/src/main.js apps/web/src/services/route-access.js apps/web/src/services/route-access.test.js apps/web/e2e/customer.spec.js apps/web/e2e/owner.spec.js apps/web/e2e/admin.spec.js
git commit -m "feat(web): route sessions to role dashboards"
```

### Task 4: Learning documentation and complete verification

**Files:**

- Create: `docs/learning-notes/role-specific-workspaces.md`

**Interfaces:**

- Documents: effective-role policy, route flow, important files, commands, mistakes, security boundary, and self-check questions.

- [x] **Step 1: Write the Vietnamese learning note**

Include sections: “Đã xây dựng”, “Lý do thiết kế”, “Luồng điều hướng”, “Files quan trọng”, “Chạy và kiểm thử”, “Lỗi thường gặp và bảo mật”, and “Câu hỏi tự kiểm tra”. Explicitly state that frontend redirects are UX, while NestJS guards enforce security.

- [x] **Step 2: Run documentation and frontend quality gates**

Run: `npm run format:check`

Expected: PASS.

Run: `npm run lint -w @sports-booking/web`

Expected: PASS.

Run: `npm run typecheck -w @sports-booking/web`

Expected: PASS.

Run: `npm test -w @sports-booking/web`

Expected: PASS.

Run: `npm run build -w @sports-booking/web`

Expected: PASS.

Run: `npm run test:e2e -w @sports-booking/web`

Expected: PASS.

- [x] **Step 3: Commit documentation separately**

```bash
git add docs/learning-notes/role-specific-workspaces.md
git commit -m "docs: explain role-specific workspaces"
```

- [x] **Step 4: Inspect final commit and working-tree scope**

Run: `git log --oneline -6`

Expected: separate policy, shell, routing, and documentation checkpoints; unrelated pre-existing modifications remain unstaged.

Run: `git status --short`

Expected: no uncommitted changes in files owned exclusively by this plan; unrelated pre-existing files may remain modified.
