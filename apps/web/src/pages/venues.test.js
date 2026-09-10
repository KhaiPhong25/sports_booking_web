// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  renderOwnerVenueForm,
  renderPublicVenues,
  renderVenueSearchForm,
  renderVenueInventory,
} from "./venues.js";

describe("venue pages", () => {
  it("renders an empty public catalog without requiring authentication", () => {
    document.body.innerHTML = renderPublicVenues([]);
    expect(document.querySelector(".empty-state")?.textContent).toContain(
      "chưa có sân",
    );
  });

  it("never asks the browser to submit an authoritative owner id", () => {
    document.body.innerHTML = renderOwnerVenueForm({ areas: [] });
    expect(document.querySelector('[name="ownerId"]')).toBeNull();
    expect(document.querySelector('label[for="venue-name"]')).not.toBeNull();
  });

  it("shows physical courts only in owner inventory controls", () => {
    document.body.innerHTML = renderVenueInventory({
      offerings: [
        {
          id: "offer-1",
          sportId: "badminton",
          courts: [{ id: "court-1", internalName: "Sân 1", isActive: false }],
        },
      ],
    });
    expect(document.body.textContent).toContain("Sân 1");
    expect(document.body.textContent).toContain("Bảo trì / tạm ngừng");
  });

  it("renders anonymous search fields for sport, area, date and interval", () => {
    document.body.innerHTML = renderVenueSearchForm({
      sports: [{ id: "sport-1", name: "Cầu lông" }],
      areas: [{ id: "area-1", name: "Quận 1" }],
    });
    for (const name of ["sportId", "areaId", "date", "startTime", "endTime"]) {
      expect(document.querySelector(`[name="${name}"]`)).not.toBeNull();
    }
    expect(
      document.querySelector('[name="sportId"] option[value="sport-1"]')
        ?.textContent,
    ).toContain("Cầu lông");
  });
});
