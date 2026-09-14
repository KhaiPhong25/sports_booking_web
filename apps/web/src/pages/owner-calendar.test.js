// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderOwnerCalendar, weekRange } from "./owner-calendar.js";

describe("owner weekly booking calendar", () => {
  it("uses a Monday-to-Monday half-open range", () => {
    expect(weekRange("2026-09-16")).toEqual({
      startDate: "2026-09-14",
      endDate: "2026-09-21",
    });
  });

  it("groups bookings by Ho Chi Minh City business date and preserves venue filter", () => {
    document.body.innerHTML = renderOwnerCalendar({
      weekStart: "2026-09-14",
      venueId: "venue-1",
      venues: [
        { id: "venue-1", name: "Sân Xanh" },
        { id: "venue-2", name: "Sân Đỏ" },
      ],
      bookings: [
        {
          id: "booking-1",
          venueName: "Sân Xanh",
          sportName: "Cầu lông",
          status: "PENDING",
          startAt: "2026-09-14T17:30:00.000Z",
          endAt: "2026-09-14T18:30:00.000Z",
        },
      ],
    });

    expect(document.querySelector('[name="venueId"]')?.value).toBe("venue-1");
    expect(
      document.querySelector('[data-date="2026-09-15"]')?.textContent,
    ).toContain("Cầu lông");
    expect(
      document.querySelector('[data-date="2026-09-15"]')?.textContent,
    ).toContain("Chờ duyệt");
    expect(
      document.querySelector('a[href="/owner/bookings/booking-1"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-week-nav="next"]')?.getAttribute("href"),
    ).toContain("week=2026-09-21");
    expect(
      document.querySelector(".week-calendar .calendar-day"),
    ).not.toBeNull();
    expect(document.querySelector(".calendar-toolbar")).not.toBeNull();
  });
});
