// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  renderBookingWidget,
  renderCustomerBookings,
  renderOwnerBookings,
} from "./bookings.js";

describe("booking pages", () => {
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
});
