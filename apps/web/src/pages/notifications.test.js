// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderNotifications } from "./notifications.js";

describe("customer notifications", () => {
  it("renders an explicit empty state and an accessible filter", () => {
    document.body.innerHTML = renderNotifications([]);
    expect(document.querySelector(".empty-state")?.textContent).toContain(
      "chưa có thông báo",
    );
    expect(
      document.querySelector('label[for="notification-filter"]'),
    ).not.toBeNull();
  });

  it("identifies unread items with text and offers an owned mark-read action", () => {
    document.body.innerHTML = renderNotifications([
      {
        id: "notification-1",
        type: "BOOKING_CONFIRMED",
        payload: { bookingId: "booking-1", venueName: "Sân Xanh" },
        readAt: null,
        createdAt: "2026-09-10T03:00:00.000Z",
      },
      {
        id: "notification-2",
        type: "BOOKING_EXPIRED",
        payload: { bookingId: "booking-2", venueName: "Sân Đỏ" },
        readAt: "2026-09-10T04:00:00.000Z",
        createdAt: "2026-09-10T03:30:00.000Z",
      },
    ]);

    const unread = document.querySelector(
      '[data-notification-id="notification-1"]',
    );
    const read = document.querySelector(
      '[data-notification-id="notification-2"]',
    );
    expect(unread?.textContent).toContain("Chưa đọc");
    expect(unread?.querySelector("button[data-mark-read]")).not.toBeNull();
    expect(
      unread?.querySelector('a[href="/bookings/booking-1"]'),
    ).not.toBeNull();
    expect(read?.textContent).toContain("Đã đọc");
    expect(read?.querySelector("button[data-mark-read]")).toBeNull();
  });
});
