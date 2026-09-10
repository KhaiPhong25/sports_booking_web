// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderOwnerDashboard } from "./owner-dashboard.js";

describe("owner dashboard", () => {
  it("summarizes owned venues and actionable bookings with navigation", () => {
    document.body.innerHTML = renderOwnerDashboard({
      venues: [
        { id: "venue-1", name: "Sân Xanh", status: "APPROVED" },
        { id: "venue-2", name: "Sân Mới", status: "PENDING_APPROVAL" },
      ],
      bookings: [
        { id: "booking-1", status: "PENDING" },
        { id: "booking-2", status: "CONFIRMED" },
      ],
    });

    expect(
      document.querySelector('[data-metric="venues"]')?.textContent,
    ).toContain("2");
    expect(
      document.querySelector('[data-metric="pending"]')?.textContent,
    ).toContain("1");
    expect(
      document.querySelector('a[href="/owner/calendar"]')?.textContent,
    ).toContain("Lịch booking");
    expect(document.querySelector('a[href="/owner/venues"]')).not.toBeNull();
  });
});
