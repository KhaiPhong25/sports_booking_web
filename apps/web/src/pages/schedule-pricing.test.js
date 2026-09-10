// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderOwnerSchedulePricing } from "./schedule-pricing.js";

describe("owner schedule and pricing page", () => {
  it("renders current hours, closures and pricing with edit/delete controls", () => {
    document.body.innerHTML = renderOwnerSchedulePricing([
      {
        id: "venue-1",
        name: "Sân Xanh",
        operatingHours: [
          { id: "hours-1", weekday: 1, startMinute: 480, endMinute: 1320 },
        ],
        closures: [
          {
            id: "closure-1",
            courtId: null,
            startAt: "2026-09-20T01:00:00.000Z",
            endAt: "2026-09-20T03:00:00.000Z",
            reason: "Bảo trì định kỳ",
          },
        ],
        offerings: [
          {
            id: "offering-1",
            sportId: "badminton",
            sportName: "Cầu lông",
            courts: [{ id: "court-1", internalName: "Sân A", isActive: true }],
            pricingRules: [
              {
                id: "price-1",
                weekday: 1,
                startMinute: 480,
                endMinute: 1320,
                pricePerSlot: 50000,
              },
            ],
          },
        ],
      },
    ]);

    expect(document.querySelector("[data-hours-form]")).not.toBeNull();
    expect(document.body.textContent).toContain("08:00–22:00");
    expect(
      [...document.querySelectorAll(".schedule-summary")].filter(
        (summary) => summary.textContent === "Thứ hai 08:00–22:00",
      ),
    ).toHaveLength(1);
    expect(document.querySelector("[data-closure-create]")).not.toBeNull();
    expect(document.querySelector("[data-closure-edit]")).not.toBeNull();
    expect(
      document.querySelector('[data-action="delete-closure"]'),
    ).not.toBeNull();
    expect(document.querySelector("[data-pricing-create]")).not.toBeNull();
    expect(document.querySelector("[data-pricing-edit]")).not.toBeNull();
    expect(
      document.querySelector('[data-action="delete-price"]'),
    ).not.toBeNull();
    expect(document.body.textContent).toContain("Cầu lông");
  });

  it("uses unique form control ids when an owner manages multiple venues", () => {
    document.body.innerHTML = renderOwnerSchedulePricing([
      {
        id: "venue-1",
        name: "Sân Một",
        operatingHours: [{ weekday: 1, startMinute: 480, endMinute: 600 }],
        closures: [],
        offerings: [],
      },
      {
        id: "venue-2",
        name: "Sân Hai",
        operatingHours: [{ weekday: 1, startMinute: 480, endMinute: 600 }],
        closures: [],
        offerings: [],
      },
    ]);

    const ids = [...document.querySelectorAll("[id]")].map(
      (element) => element.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});
