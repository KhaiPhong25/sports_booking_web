import { expect, test } from "@playwright/test";

const catalog = {
  sports: [{ id: "sport-badminton", name: "Cầu lông" }],
  areas: [{ id: "area-q1", name: "Quận 1" }],
  amenities: [{ id: "amenity-parking", name: "Bãi giữ xe" }],
};

const initialVenue = {
  id: "venue-1",
  areaId: "area-q1",
  name: "Sân Xanh Quận 1",
  address: "12 Nguyễn Huệ, Quận 1",
  description: "Cụm sân cầu lông trong nhà tại trung tâm thành phố.",
  latitude: 10.7731,
  longitude: 106.703,
  status: "APPROVED",
  amenities: [{ id: "amenity-parking", name: "Bãi giữ xe" }],
  offerings: [
    {
      id: "offering-1",
      sportId: "sport-badminton",
      sportName: "Cầu lông",
      confirmationMode: "OWNER_APPROVAL",
      advanceBookingDays: 14,
      cancellationNoticeMinutes: 120,
      isActive: true,
      courts: [
        { id: "court-1", internalName: "Sân A", isActive: true },
        { id: "court-2", internalName: "Sân B", isActive: true },
      ],
    },
  ],
};

const initialBooking = {
  id: "booking-1",
  venueId: "venue-1",
  venueName: initialVenue.name,
  offeringId: "offering-1",
  sportName: "Cầu lông",
  status: "PENDING",
  startAt: "2026-09-14T01:00:00.000Z",
  endAt: "2026-09-14T02:00:00.000Z",
  priceAmount: 180000,
  courtId: "court-1",
  courtName: "Sân A",
  customer: {
    displayName: "Nguyễn An",
    email: "customer@example.com",
    phone: "+84901234567",
  },
};

async function mockOwnerApi(page) {
  let venue = JSON.parse(JSON.stringify(initialVenue));
  let booking = { ...initialBooking };
  let operatingHours = [
    { id: "hours-1", weekday: 1, startMinute: 480, endMinute: 1320 },
  ];
  const mutations = [];

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    const method = request.method();
    const payload = request.postDataJSON?.() ?? {};
    const json = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (path === "/auth/refresh" && method === "POST") {
      return json({
        accessToken: "owner-token",
        user: { id: "owner-1", role: "OWNER" },
      });
    }
    if (path === "/catalog" && method === "GET") return json(catalog);
    if (path === "/owner/venues" && method === "GET") {
      return json({ items: [venue], total: 1, page: 1, pageSize: 100 });
    }
    if (path === "/owner/venues/venue-1" && method === "GET") {
      return json(venue);
    }
    if (path === "/owner/venues/venue-1" && method === "PATCH") {
      venue = { ...venue, ...payload };
      mutations.push("venue:update");
      return json(venue);
    }
    if (path === "/owner/offerings/offering-1" && method === "PATCH") {
      venue.offerings[0] = { ...venue.offerings[0], ...payload };
      mutations.push("offering:update");
      return json(venue.offerings[0]);
    }
    if (path === "/owner/courts/court-1" && method === "PATCH") {
      venue.offerings[0].courts[0] = {
        ...venue.offerings[0].courts[0],
        ...payload,
      };
      mutations.push("court:update");
      return json(venue.offerings[0].courts[0]);
    }
    if (path === "/owner/bookings" && method === "GET") {
      return json({ items: [booking], total: 1, page: 1, pageSize: 100 });
    }
    if (path === "/owner/bookings/booking-1" && method === "GET") {
      return json(booking);
    }
    if (path === "/owner/bookings/booking-1/confirm" && method === "POST") {
      await new Promise((resolve) => setTimeout(resolve, 500));
      booking = { ...booking, status: "CONFIRMED" };
      mutations.push("booking:confirm");
      return json(booking);
    }
    if (path === "/owner/bookings/booking-1/reassign" && method === "POST") {
      booking = {
        ...booking,
        courtId: payload.courtId,
        courtName: "Sân B",
      };
      mutations.push("booking:reassign");
      return json(booking);
    }
    if (path === "/owner/venues/venue-1/operating-hours" && method === "GET") {
      return json(operatingHours);
    }
    if (path === "/owner/venues/venue-1/operating-hours" && method === "PUT") {
      operatingHours = payload.windows;
      mutations.push("hours:update");
      return json(operatingHours);
    }
    if (path === "/owner/venues/venue-1/closures" && method === "GET") {
      return json([]);
    }
    if (
      path === "/owner/offerings/offering-1/pricing-rules" &&
      method === "GET"
    ) {
      return json([]);
    }

    return json({ message: `Chưa mock ${method} ${path}` }, 501);
  });

  return { mutations: () => mutations };
}

test("owner vận hành booking, inventory, lịch và giá trong một hành trình", async ({
  page,
}) => {
  const api = await mockOwnerApi(page);

  await page.goto("/owner");
  await expect(
    page.getByRole("heading", { name: "Tổng quan vận hành" }),
  ).toBeVisible();
  await expect(page.getByText("Booking chờ duyệt")).toBeVisible();

  await page.getByRole("link", { name: "Lịch booking" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Lịch booking" }),
  ).toBeVisible();
  await page.getByLabel("Tuần chứa ngày").fill("2026-09-14");
  await page.getByRole("button", { name: "Xem lịch" }).click();
  await page.getByRole("link", { name: "Xem booking" }).click();
  await expect(page.getByText("customer@example.com")).toBeVisible();

  await page.getByRole("button", { name: "Duyệt booking" }).click();
  await expect(
    page.getByRole("button", { name: "Từ chối booking" }),
  ).toBeDisabled();
  await expect(page.getByText("Đã xác nhận", { exact: true })).toBeVisible();
  await page.getByLabel("Chuyển sang sân").selectOption("court-2");
  await page.getByRole("button", { name: "Chuyển sân" }).click();
  await expect(page.getByText("Sân B", { exact: true })).toBeVisible();

  await page.goto("/owner/venues");
  const venueCard = page.locator('[data-venue-id="venue-1"]');
  await venueCard.getByText("Chỉnh sửa thông tin địa điểm").click();
  await venueCard.getByLabel("Tên địa điểm").fill("Sân Xanh Đã Cập Nhật");
  await venueCard
    .getByRole("button", { name: "Lưu thông tin địa điểm" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sân Xanh Đã Cập Nhật" }),
  ).toBeVisible();

  await venueCard
    .getByRole("button", { name: "Lưu chính sách offering" })
    .click();
  await venueCard.getByLabel("Tên sân con").first().fill("Sân Trung Tâm");
  await venueCard.getByRole("button", { name: "Đổi tên" }).first().click();

  await page.goto("/owner/schedule");
  await expect(page.getByText("Thứ hai 08:00–22:00")).toBeVisible();
  await page.getByRole("button", { name: "Lưu giờ hoạt động" }).click();

  expect(api.mutations()).toEqual(
    expect.arrayContaining([
      "booking:confirm",
      "booking:reassign",
      "venue:update",
      "offering:update",
      "court:update",
      "hours:update",
    ]),
  );
});

test("owner calendar và biểu mẫu quản lý dùng được trên mobile", async ({
  page,
}) => {
  await mockOwnerApi(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/owner/calendar?week=2026-09-14");

  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Bỏ qua điều hướng" }),
  ).toBeFocused();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
  await expect(page.getByRole("list", { name: /Booking từ/ })).toBeVisible();
  await expect(page.getByLabel("Địa điểm")).toBeVisible();
});
