// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderOwnerSchedulePricing } from "./schedule-pricing.js";

describe("owner schedule and pricing page", () => {
  it("renders labelled weekly-hours, closure and pricing forms", () => {
    document.body.innerHTML = renderOwnerSchedulePricing([
      {
        id: "venue-1",
        name: "Sân Xanh",
        offerings: [{ id: "offering-1", sportId: "badminton" }],
      },
    ]);

    expect(document.querySelector("[data-hours-form]")).not.toBeNull();
    expect(
      document.querySelector('label[for="hours-weekday-venue-1"]'),
    ).not.toBeNull();
    expect(document.querySelector("[data-closure-form]")).not.toBeNull();
    expect(document.querySelector("[data-pricing-form]")).not.toBeNull();
  });
});
