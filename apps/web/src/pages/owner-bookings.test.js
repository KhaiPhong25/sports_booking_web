// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAllOwnerBookings,
  renderOwnerBookingDetail,
  renderOwnerBookings,
} from "./owner-bookings.js";

const pendingBooking = {
  id: "booking-1",
  venueId: "venue-1",
  venueName: "Sân Xanh",
  offeringId: "offering-1",
  sportName: "Cầu lông",
  status: "PENDING",
  startAt: "2026-09-14T01:00:00.000Z",
  endAt: "2026-09-14T02:00:00.000Z",
  priceAmount: 100000,
  courtId: "court-1",
  courtName: "Sân A",
  customer: {
    displayName: "Nguyễn An",
    email: "customer@example.com",
    phone: "+84901234567",
  },
};

describe("owner booking pages", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads every API page so operational bookings are not hidden", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: `booking-${index + 1}`,
    }));
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: firstPage, total: 101 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [{ id: "booking-101" }], total: 101 }),
      });
    vi.stubGlobal("fetch", fetch);

    const bookings = await fetchAllOwnerBookings(
      new window.URLSearchParams({ status: "PENDING" }),
    );

    expect(bookings).toHaveLength(101);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toContain("page=2");
  });

  it("renders filters and links each booking to an owned detail route", () => {
    document.body.innerHTML = renderOwnerBookings({
      bookings: [pendingBooking],
      venues: [{ id: "venue-1", name: "Sân Xanh" }],
      filters: { venueId: "venue-1", status: "PENDING" },
    });

    expect(
      document.querySelector("[data-owner-booking-filters]"),
    ).not.toBeNull();
    expect(document.querySelector('[name="venueId"]')?.value).toBe("venue-1");
    expect(
      document.querySelector('a[href="/owner/bookings/booking-1"]'),
    ).not.toBeNull();
  });

  it("shows customer contact, valid pending actions and matching court choices", () => {
    document.body.innerHTML = renderOwnerBookingDetail(pendingBooking, [
      { id: "court-1", internalName: "Sân A", isActive: true },
      { id: "court-2", internalName: "Sân B", isActive: true },
      { id: "court-3", internalName: "Sân bảo trì", isActive: false },
    ]);

    expect(document.body.textContent).toContain("Nguyễn An");
    expect(document.body.textContent).toContain("customer@example.com");
    expect(document.body.textContent).toContain("+84901234567");
    expect(document.querySelector('[data-action="confirm"]')).not.toBeNull();
    expect(document.querySelector('[data-action="reject"]')).not.toBeNull();
    expect(document.querySelector('[data-action="cancel"]')).not.toBeNull();
    expect(document.querySelector('[data-action="reassign"]')).not.toBeNull();
    expect(
      document.querySelector('[name="courtId"] option[value="court-2"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[name="courtId"] option[value="court-3"]'),
    ).toBeNull();
  });

  it("does not render mutation controls for a terminal booking", () => {
    document.body.innerHTML = renderOwnerBookingDetail(
      { ...pendingBooking, status: "COMPLETED" },
      [],
    );
    expect(document.body.textContent).toContain("Đã hoàn tất");
    expect(document.querySelector("button[data-action]")).toBeNull();
  });
});
