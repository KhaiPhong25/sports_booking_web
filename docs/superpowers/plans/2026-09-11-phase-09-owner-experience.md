# Phase 9 Owner Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện owner dashboard để chủ sân quản lý booking, lịch theo tuần, venue/inventory, giờ hoạt động, closure và pricing trên web responsive.

**Architecture:** Giữ Vite + vanilla ES modules và các owner REST API hiện có. Tách owner UI khỏi các file public/customer thành các page module tập trung; PostgreSQL/API tiếp tục quyết định ownership, transition, court reassignment và giá. Chỉ mở rộng owner booking response với thông tin liên hệ customer cần cho vận hành.

**Tech Stack:** NestJS, Prisma/PostgreSQL, Vite, vanilla JavaScript, Vitest/jsdom, Playwright Chromium.

**Spec:** `docs/architecture/design-spec.md`

## Global Constraints

- Không gửi `ownerId` hoặc authoritative price từ browser.
- Court reassignment chỉ gửi court thuộc offering đang hiển thị; API vẫn kiểm tra ownership, active và overlap.
- Mọi timestamp hiển thị ở `Asia/Ho_Chi_Minh`; khoảng API dùng ISO UTC và half-open `[startAt,endAt)`.
- Owner action chỉ hiện khi booking status cho phép; reject/cancel bắt buộc lý do tối thiểu 3 ký tự.
- UI tiếng Việt, semantic, responsive, có loading/empty/success/error và keyboard focus.
- Không stage `AGENTS.md`, `CODEX_PROJECT_CONTEXT.md`, `prompt.md` hoặc blueprint.

---

### Task 1: Owner dashboard và weekly calendar

**Files:**

- Create: `apps/web/src/pages/owner-dashboard.js`
- Create: `apps/web/src/pages/owner-dashboard.test.js`
- Create: `apps/web/src/pages/owner-calendar.js`
- Create: `apps/web/src/pages/owner-calendar.test.js`

**Interfaces:**

- Produces: `renderOwnerDashboard({venues,bookings})`, `mountOwnerDashboard(container)`, `weekRange(date)`, `renderOwnerCalendar({bookings,venues,weekStart,venueId})`, `mountOwnerCalendar(container)`.

- [x] **Step 1: Viết DOM tests thất bại cho dashboard và calendar**

```js
expect(renderOwnerDashboard({ venues, bookings })).toContain(
  "Booking chờ duyệt",
);
expect(weekRange("2026-09-16")).toEqual({
  startDate: "2026-09-14",
  endDate: "2026-09-21",
});
expect(
  calendar.querySelector('a[href="/owner/bookings/booking-1"]'),
).not.toBeNull();
```

- [x] **Step 2: Chạy test đỏ**

Run: `npx vitest run src/pages/owner-dashboard.test.js src/pages/owner-calendar.test.js`

Expected: FAIL vì hai page module chưa tồn tại.

- [x] **Step 3: Implement dashboard và lịch tuần tối thiểu**

```js
const query = new window.URLSearchParams({
  from: `${startDate}T00:00:00+07:00`,
  to: `${endDate}T00:00:00+07:00`,
  sort: "startAtAsc",
  pageSize: "100",
});
```

Dashboard tải venue/booking song song; calendar nhóm booking theo business date, có tuần trước/sau và filter venue.

- [x] **Step 4: Chạy tests xanh và refactor**

Run: `npx vitest run src/pages/owner-dashboard.test.js src/pages/owner-calendar.test.js`

Expected: PASS.

### Task 2: Owner booking list/detail/actions và customer contact

**Files:**

- Create: `apps/web/src/pages/owner-bookings.js`
- Create: `apps/web/src/pages/owner-bookings.test.js`
- Modify: `apps/api/src/bookings/booking.types.ts`
- Modify: `apps/api/src/bookings/bookings.service.ts`
- Modify: `apps/api/test/scheduling-booking-api.integration-spec.ts`

**Interfaces:**

- API owner views produce `customer: {displayName,email,phone}`; customer views không nhận contact object này.
- Web produces `renderOwnerBookings`, `renderOwnerBookingDetail`, `mountOwnerBookings`, `mountOwnerBookingDetail`.

- [x] **Step 1: Viết integration/DOM tests thất bại**

```ts
expect(ownerDetail.body.customer).toEqual({
  displayName: customerEmail,
  email: customerEmail,
  phone: "+84901234567",
});
```

```js
expect(detail.textContent).toContain("customer@example.com");
expect(detail.querySelector('[data-action="confirm"]')).not.toBeNull();
expect(terminalDetail.querySelector("button[data-action]")).toBeNull();
```

- [x] **Step 2: Chạy test đỏ**

Run: `TEST_DATABASE_URL=postgresql://sports:sports_local_password@127.0.0.1:5432/sports_booking_test?schema=public npm run test:integration -w @sports-booking/api -- --runTestsByPath test/scheduling-booking-api.integration-spec.ts`

Run: `npx vitest run src/pages/owner-bookings.test.js`

Expected: FAIL vì contact và owner page chưa có.

- [x] **Step 3: Implement contact projection và owner booking pages**

```ts
...(includeCourt
  ? {
      courtId: booking.courtId,
      courtName: booking.court.internalName,
      customer: booking.customer,
    }
  : {}),
```

List dùng whitelist filter `venueId,status,from,to,sort`; detail lấy `/owner/bookings/:id`. Action handler validate reason/court, disable nút khi pending request và render response mới nhất.

- [x] **Step 4: Chạy integration và DOM tests xanh**

Expected: owner thấy contact đúng booking; owner khác vẫn nhận 404; các button đúng state.

### Task 3: Venue inventory, schedule, closure và pricing CRUD

**Files:**

- Create: `apps/web/src/pages/owner-venues.js`
- Create: `apps/web/src/pages/owner-venues.test.js`
- Modify: `apps/web/src/pages/schedule-pricing.js`
- Modify: `apps/web/src/pages/schedule-pricing.test.js`
- Modify: `apps/web/src/pages/venues.js`
- Modify: `apps/web/src/pages/venues.test.js`
- Modify: `apps/web/src/pages/bookings.js`
- Modify: `apps/web/src/pages/bookings.test.js`

**Interfaces:**

- Produces owner venue edit/archive, offering policy update, court rename/active toggle, current operating-window replacement, closure update/delete và pricing update/delete.
- Public/customer exports trong `venues.js` và `bookings.js` giữ nguyên.

- [x] **Step 1: Viết DOM tests thất bại cho safe forms và current state**

```js
expect(page.querySelector('[name="ownerId"]')).toBeNull();
expect(page.querySelector("[data-venue-edit]")).not.toBeNull();
expect(page.querySelector("[data-offering-edit]")).not.toBeNull();
expect(page.querySelector("[data-court-edit]")).not.toBeNull();
expect(schedule.textContent).toContain("08:00–22:00");
expect(schedule.querySelector('[data-action="delete-closure"]')).not.toBeNull();
expect(schedule.querySelector('[data-action="delete-price"]')).not.toBeNull();
```

- [x] **Step 2: Chạy test đỏ**

Run: `npx vitest run src/pages/owner-venues.test.js src/pages/schedule-pricing.test.js`

Expected: FAIL tại các edit/list/delete capability chưa có.

- [x] **Step 3: Implement CRUD và reload-after-mutation**

```js
await apiRequest(`/owner/courts/${courtId}`, {
  method: "PATCH",
  body: JSON.stringify({ internalName }),
});
```

Operating hours gửi toàn bộ `windows` đang edit trong một PUT, không vô tình xóa các ngày khác. Closure/pricing edit dùng PATCH với full DTO; delete dùng DELETE và xác nhận qua `window.confirm`.

- [x] **Step 4: Chạy DOM tests xanh**

Expected: form có label/action phù hợp, không chứa authority fields, current data hiển thị dễ đọc.

### Task 4: Routing, browser journey, docs và checkpoint

**Files:**

- Modify: `apps/web/src/main.js`
- Modify: `apps/web/src/shell.js`
- Modify: `apps/web/src/styles/main.css`
- Create: `apps/web/e2e/owner.spec.js`
- Modify: `README.md`
- Modify: `docs/architecture/api-contract.md`
- Create: `docs/learning-notes/phase-09-owner-web.md`

**Interfaces:**

- Produces routes `/owner`, `/owner/calendar`, `/owner/bookings`, `/owner/bookings/:id`, `/owner/venues`, `/owner/schedule`.

- [x] **Step 1: Viết Playwright E2E thất bại**

```js
await page.goto("/owner");
await page.getByRole("link", { name: "Lịch booking" }).click();
await page.getByRole("link", { name: "Xem booking" }).click();
await page.getByRole("button", { name: "Duyệt booking" }).click();
await page.getByRole("button", { name: "Chuyển sân" }).click();
await page.getByRole("button", { name: "Lưu giờ hoạt động" }).click();
```

- [x] **Step 2: Chạy browser test đỏ**

Run: `npm run test:e2e -w @sports-booking/web -- owner.spec.js`

Expected: FAIL vì routes/dashboard/calendar/detail chưa được đăng ký.

- [x] **Step 3: Wire routes, responsive/accessibility styles và docs**

Thêm owner navigation landmark, responsive calendar/list/form layout, live regions, disabled state; cập nhật README/API contract và learning note tiếng Việt.

- [x] **Step 4: Chạy quality gates và review**

Run: `npm run verify`

Run: `TEST_DATABASE_URL=postgresql://sports:sports_local_password@127.0.0.1:5432/sports_booking_test?schema=public npm run test:integration -w @sports-booking/api`

Run: `TEST_DATABASE_URL=postgresql://sports:sports_local_password@127.0.0.1:5432/sports_booking_test?schema=public npm run test:e2e -w @sports-booking/api`

Run: `npm run test:e2e -w @sports-booking/web`

Run: `docker compose up -d --build api web && curl --fail http://127.0.0.1:3000/api/v1/health && curl --fail http://127.0.0.1:5173/owner`

Expected: tất cả required suites pass và services healthy.

- [x] **Step 5: Review diff/secrets và commit**

```bash
git diff --check
git commit -m "feat(phase-9): complete owner web experience"
```
