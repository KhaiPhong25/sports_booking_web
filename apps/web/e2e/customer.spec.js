import { expect, test } from "@playwright/test";

const venue = {
  id: "venue-1",
  name: "Sân Thể Thao Quận 1",
  address: "12 Nguyễn Huệ, Quận 1, TP.HCM",
  description: "Sân cầu lông trong nhà, gần trung tâm thành phố.",
  latitude: 10.7731,
  longitude: 106.703,
  images: [],
  amenities: [{ id: "amenity-1", name: "Bãi giữ xe" }],
  offerings: [
    {
      id: "offering-1",
      sportId: "sport-badminton",
      sportName: "Cầu lông",
      confirmationMode: "INSTANT",
    },
  ],
};

const booking = {
  id: "booking-1",
  venueName: venue.name,
  sportName: "Cầu lông",
  status: "CONFIRMED",
  startAt: "2026-10-10T01:00:00.000Z",
  endAt: "2026-10-10T02:00:00.000Z",
  priceAmount: 180000,
};

async function mockCustomerApi(page) {
  let loggedIn = false;
  let bookingStatus = "CONFIRMED";
  let notificationReadAt = null;
  let bookingCreates = 0;

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

    if (path === "/catalog" && method === "GET") {
      return json({
        sports: [{ id: "sport-badminton", name: "Cầu lông" }],
        areas: [{ id: "area-q1", name: "Quận 1" }],
        amenities: [],
      });
    }
    if (path === "/venues" && method === "GET") {
      return json({ items: [venue], total: 1, page: 1, pageSize: 20 });
    }
    if (path === `/venues/${venue.id}` && method === "GET") {
      return json(venue);
    }
    if (path === "/offerings/offering-1/quotes" && method === "POST") {
      return json({ amount: 180000, currency: "VND" });
    }
    if (path === "/auth/refresh" && method === "POST") {
      return loggedIn
        ? json({ accessToken: "customer-token" })
        : json({ message: "Bạn cần đăng nhập" }, 401);
    }
    if (path === "/auth/login" && method === "POST") {
      loggedIn = true;
      return json({
        accessToken: "customer-token",
        user: { id: "customer-1", roles: ["CUSTOMER"] },
      });
    }
    if (path === "/bookings" && method === "POST") {
      bookingCreates += 1;
      await new Promise((resolve) => setTimeout(resolve, 100));
      return json({ ...booking, status: bookingStatus }, 201);
    }
    if (path === "/bookings" && method === "GET") {
      return json({
        items: [{ ...booking, status: bookingStatus }],
        total: 1,
        page: 1,
        pageSize: 50,
      });
    }
    if (path === `/bookings/${booking.id}` && method === "GET") {
      return json({ ...booking, status: bookingStatus });
    }
    if (path === `/bookings/${booking.id}/cancel` && method === "POST") {
      bookingStatus = "CANCELLED";
      return json({ ...booking, status: bookingStatus });
    }
    if (path === "/notifications" && method === "GET") {
      const unread = url.searchParams.get("unread");
      const item = {
        id: "notification-1",
        type: "BOOKING_CONFIRMED",
        payload: { bookingId: booking.id, venueName: venue.name },
        readAt: notificationReadAt,
        createdAt: "2026-10-01T03:00:00.000Z",
      };
      const items =
        (unread === "true" && notificationReadAt) ||
        (unread === "false" && !notificationReadAt)
          ? []
          : [item];
      return json({ items, total: items.length, page: 1, pageSize: 50 });
    }
    if (path === "/notifications/notification-1/read" && method === "POST") {
      notificationReadAt = "2026-10-01T04:00:00.000Z";
      return json({ readAt: notificationReadAt });
    }

    return json({ message: `Chưa mock ${method} ${path}` }, 501);
  });

  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({ status: 204 }),
  );

  return { bookingCreates: () => bookingCreates };
}

test("khách xem lịch, đăng nhập rồi đặt và quản lý booking", async ({
  page,
}) => {
  const api = await mockCustomerApi(page);
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Tìm sân thể thao" }),
  ).toBeVisible();
  await page.getByLabel("Môn thể thao").selectOption("sport-badminton");
  await page.getByLabel("Khu vực").selectOption("area-q1");
  await page.getByLabel("Ngày").fill("2026-10-10");
  await page.getByLabel("Bắt đầu", { exact: true }).fill("08:00");
  await page.getByLabel("Kết thúc", { exact: true }).fill("09:00");
  await page.getByRole("button", { name: "Tìm sân còn trống" }).click();

  await expect(page.getByText("Còn sân trong khung giờ đã chọn")).toBeVisible();
  await page.getByRole("link", { name: venue.name }).click();
  await expect(
    page.getByRole("region", { name: `Bản đồ vị trí ${venue.name}` }),
  ).toBeVisible();
  await expect(page.getByLabel("Bắt đầu", { exact: true })).toHaveValue(
    "2026-10-10T08:00",
  );

  await page.getByRole("button", { name: "Nhận báo giá" }).click();
  await expect(page.getByText(/Tổng giá:.*180[.\s]000/)).toBeVisible();
  await page.getByRole("button", { name: "Đặt sân" }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=/);

  await page.getByLabel("Email").fill("customer@example.com");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("safe-password-123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/venues\/venue-1\?/);

  await page.locator("[data-booking-form]").evaluate((form) => {
    form.dispatchEvent(
      new SubmitEvent("submit", { bubbles: true, cancelable: true }),
    );
    form.dispatchEvent(
      new SubmitEvent("submit", { bubbles: true, cancelable: true }),
    );
  });
  await expect(page.getByRole("link", { name: "Xem chi tiết" })).toBeVisible();
  expect(api.bookingCreates()).toBe(1);
  await page.getByRole("link", { name: "Xem chi tiết" }).click();
  await expect(
    page.getByRole("heading", { name: "Chi tiết booking" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hủy booking" }).click();
  await expect(page.getByText("Đã hủy", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Thông báo" }).click();
  await expect(page.getByRole("heading", { name: "Thông báo" })).toBeVisible();
  await page.getByRole("button", { name: "Đánh dấu đã đọc" }).click();
  await expect(
    page.getByRole("article").getByText("Đã đọc", { exact: true }),
  ).toBeVisible();
});

test("giao diện mobile có skip link và điều khiển truy cập bằng bàn phím", async ({
  page,
}) => {
  await mockCustomerApi(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Bỏ qua điều hướng" }),
  ).toBeFocused();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
  await expect(
    page.getByRole("navigation", { name: "Điều hướng chính" }),
  ).toBeVisible();
  await expect(page.getByLabel("Môn thể thao")).toBeVisible();
});
