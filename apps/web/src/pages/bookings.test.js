// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  bookingIdempotencyKey,
  isChronologicalInterval,
  renderBookingWidget,
  renderCustomerBookingDetail,
  renderCustomerBookings,
  renderOwnerBookings,
} from "./bookings.js";

describe("booking pages", () => {
  it("reuses one idempotency key for the same intent and rotates it after input changes", () => {
    document.body.innerHTML = renderBookingWidget("offering-1");
    const form = document.querySelector("[data-booking-form]");
    const createKey = vi
      .fn()
      .mockReturnValueOnce("key-1")
      .mockReturnValueOnce("key-2");
    const first = {
      startAt: "2026-09-14T01:00:00.000Z",
      endAt: "2026-09-14T02:00:00.000Z",
    };

    expect(bookingIdempotencyKey(form, first, createKey)).toBe("key-1");
    expect(bookingIdempotencyKey(form, first, createKey)).toBe("key-1");
    expect(
      bookingIdempotencyKey(
        form,
        { ...first, endAt: "2026-09-14T03:00:00.000Z" },
        createKey,
      ),
    ).toBe("key-2");
    expect(createKey).toHaveBeenCalledTimes(2);
  });

  it("rejects empty, invalid and reversed booking intervals", () => {
    expect(isChronologicalInterval("", "")).toBe(false);
    expect(
      isChronologicalInterval(
        "2026-09-14T02:00:00.000Z",
        "2026-09-14T01:00:00.000Z",
      ),
    ).toBe(false);
    expect(
      isChronologicalInterval(
        "2026-09-14T01:00:00.000Z",
        "2026-09-14T02:00:00.000Z",
      ),
    ).toBe(true);
  });

  it("lets a customer quote and request an offering without price or court fields", () => {
    document.body.innerHTML = renderBookingWidget("offering-1");
    expect(document.querySelector('[name="startAt"]')).not.toBeNull();
    expect(document.querySelector('[name="endAt"]')).not.toBeNull();
    expect(document.querySelector('[name="price"]')).toBeNull();
    expect(document.querySelector('[name="courtId"]')).toBeNull();
  });

  it("hides internal courts from customers and shows them to owners", () => {
    const booking = {
      id: "booking-1",
      venueName: "Sân Xanh",
      sportName: "Cầu lông",
      status: "CONFIRMED",
      startAt: "2026-09-14T01:00:00.000Z",
      endAt: "2026-09-14T02:00:00.000Z",
      priceAmount: 100000,
      courtId: "court-1",
      courtName: "Sân nội bộ A",
    };
    document.body.innerHTML = renderCustomerBookings([booking]);
    expect(document.body.textContent).not.toContain("Sân nội bộ A");
    document.body.innerHTML = renderOwnerBookings([booking]);
    expect(document.body.textContent).toContain("Sân nội bộ A");
  });
  it("renders filters, Vietnamese status text and detail links", () => {
    const booking = {
      id: "booking-1",
      venueName: "Sân Xanh",
      sportName: "Cầu lông",
      status: "CONFIRMED",
      startAt: "2026-09-14T01:00:00.000Z",
      endAt: "2026-09-14T02:00:00.000Z",
      priceAmount: 100000,
    };
    document.body.innerHTML = renderCustomerBookings([booking]);

    expect(document.querySelector("[data-booking-filters]")).not.toBeNull();
    expect(document.body.textContent).toContain("Đã xác nhận");
    expect(
      document.querySelector('a[href="/bookings/booking-1"]'),
    ).not.toBeNull();
  });

  it("hides cancellation for terminal bookings on the detail view", () => {
    document.body.innerHTML = renderCustomerBookingDetail({
      id: "booking-1",
      venueName: "Sân Xanh",
      sportName: "Cầu lông",
      status: "COMPLETED",
      startAt: "2026-09-10T01:00:00.000Z",
      endAt: "2026-09-10T02:00:00.000Z",
      priceAmount: 100000,
    });
    expect(document.body.textContent).toContain("Đã hoàn tất");
    expect(document.querySelector('[data-action="cancel"]')).toBeNull();
  });
});
