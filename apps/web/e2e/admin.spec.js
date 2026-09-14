import { expect, test } from "@playwright/test";

async function mockAdminApi(page) {
  let userLocked = false;
  let applicationStatus = "PENDING";
  let venueStatus = "PENDING_APPROVAL";
  const audits = [];

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    const method = request.method();
    const json = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (path === "/auth/refresh" && method === "POST") {
      return json({
        accessToken: "admin-token",
        user: { id: "admin-1", roles: ["CUSTOMER", "ADMIN"] },
      });
    }
    if (path === "/admin/users" && method === "GET") {
      return json({
        items: [
          {
            id: "user-1",
            displayName: "Nguyễn An",
            email: "an@example.com",
            phone: "+84901234567",
            roles: ["CUSTOMER"],
            isLocked: userLocked,
          },
        ],
        total: 1,
        page: Number(url.searchParams.get("page") ?? 1),
        pageSize: Number(url.searchParams.get("pageSize") ?? 20),
      });
    }
    if (path === "/admin/users/user-1/lock" && method === "PATCH") {
      userLocked = true;
      audits.unshift(audit("USER_LOCKED", "User", "user-1"));
      return json({ id: "user-1", isLocked: true });
    }
    if (path === "/admin/owner-applications" && method === "GET") {
      const visible =
        !url.searchParams.get("status") ||
        url.searchParams.get("status") === applicationStatus;
      return json({
        items: visible
          ? [
              {
                id: "application-1",
                businessName: "Sân Xanh",
                experience: "Ba năm vận hành sân",
                status: applicationStatus,
              },
            ]
          : [],
        total: visible ? 1 : 0,
        page: 1,
        pageSize: 20,
      });
    }
    if (
      path === "/admin/owner-applications/application-1/approve" &&
      method === "POST"
    ) {
      applicationStatus = "APPROVED";
      audits.unshift(
        audit(
          "OWNER_APPLICATION_APPROVED",
          "OwnerApplication",
          "application-1",
        ),
      );
      return json({ id: "application-1", status: applicationStatus });
    }
    if (path === "/admin/venues" && method === "GET") {
      const visible =
        !url.searchParams.get("status") ||
        url.searchParams.get("status") === venueStatus;
      return json({
        items: visible
          ? [
              {
                id: "venue-1",
                name: "Sân Trung Tâm",
                address: "Quận 1, TP.HCM",
                status: venueStatus,
              },
            ]
          : [],
        total: visible ? 1 : 0,
        page: 1,
        pageSize: 20,
      });
    }
    if (path === "/admin/venues/venue-1/approve" && method === "POST") {
      venueStatus = "APPROVED";
      audits.unshift(audit("VENUE_APPROVED", "Venue", "venue-1"));
      return json({ id: "venue-1", status: venueStatus });
    }
    if (path === "/admin/venues/venue-1/hide" && method === "POST") {
      venueStatus = "HIDDEN";
      audits.unshift(audit("VENUE_HIDDEN", "Venue", "venue-1"));
      return json({ id: "venue-1", status: venueStatus });
    }
    if (path === "/admin/audit-logs" && method === "GET") {
      const action = url.searchParams.get("action");
      const items = action
        ? audits.filter((item) => item.action === action)
        : audits;
      return json({ items, total: items.length, page: 1, pageSize: 20 });
    }
    return json({ message: `Chưa mock ${method} ${path}` }, 501);
  });

  function audit(action, resourceType, resourceId) {
    return {
      id: `audit-${audits.length + 1}`,
      action,
      resourceType,
      resourceId,
      beforeData: {},
      afterData: {},
      createdAt: "2026-09-11T03:00:00.000Z",
      actor: { displayName: "Quản trị viên", email: "admin@example.com" },
    };
  }
}

test("admin quản lý user, hồ sơ owner, venue và xem audit", async ({
  page,
}) => {
  await mockAdminApi(page);

  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Tổng quan hệ thống" }),
  ).toBeVisible();
  await expect(page.locator(".workspace-hero--admin")).toBeVisible();

  await page.getByRole("link", { name: "Quản lý người dùng" }).click();
  await expect(page.locator(".data-row")).toBeVisible();
  await page.getByLabel("Tìm kiếm").fill("Nguyễn An");
  await page.getByRole("button", { name: "Lọc tài khoản" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Khóa tài khoản" }).click();
  await expect(page.getByRole("button", { name: "Mở khóa" })).toBeVisible();

  await page.goto("/admin/owner-applications");
  await expect(page.locator(".moderation-queue")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Duyệt hồ sơ" }).click();
  await expect(
    page
      .locator('[data-application-id="application-1"]')
      .getByText("Đã duyệt", { exact: true }),
  ).toBeVisible();

  await page.goto("/admin/venues");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Duyệt địa điểm" }).click();
  await expect(
    page
      .locator('[data-venue-id="venue-1"]')
      .getByText("Đã duyệt", { exact: true }),
  ).toBeVisible();
  const venueCard = page.locator('[data-venue-id="venue-1"]');
  const hideReason = venueCard.getByLabel("Lý do từ chối hoặc ẩn");
  await hideReason.fill("Thông tin địa điểm cần tạm ẩn để xác minh");
  await expect(hideReason).toHaveValue(
    "Thông tin địa điểm cần tạm ẩn để xác minh",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await venueCard.getByRole("button", { name: "Ẩn địa điểm" }).click();
  await expect(
    page
      .locator('[data-venue-id="venue-1"]')
      .getByText("Đã ẩn", { exact: true }),
  ).toBeVisible();

  await page.goto("/admin/audit-logs");
  await page.getByLabel("Hành động").fill("USER_LOCKED");
  await page.getByRole("button", { name: "Lọc lịch sử" }).click();
  await expect(page).toHaveURL(/action=USER_LOCKED/);
  await expect(page.locator(".audit-card")).toHaveCount(1);
  await expect(page.locator(".audit-timeline")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "USER_LOCKED" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: "USER_LOCKED" }) })
      .getByText("Quản trị viên"),
  ).toBeVisible();
});

test("admin navigation và filters dùng được trên mobile", async ({ page }) => {
  await mockAdminApi(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/admin/users");

  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Bỏ qua điều hướng" }),
  ).toBeFocused();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
  expect(
    await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("navigation", { name: "Điều hướng quản trị" }),
  ).toBeVisible();
  await expect(page.getByLabel("Vai trò")).toBeVisible();
  await expect(
    page.locator('.admin-nav a[href="/admin/users"]'),
  ).toHaveAttribute("aria-current", "page");
});

test("route dashboard admin chính xác yêu cầu đăng nhập", async ({ page }) => {
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Bạn cần đăng nhập" }),
    }),
  );

  await page.goto("/admin");

  await expect(page).toHaveURL(/\/login\?returnTo=%2Fadmin/);
  await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
});
