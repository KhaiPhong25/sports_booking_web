// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  renderPublicVenueDetail,
  renderPublicVenues,
  renderVenueSearchForm,
} from "./venues.js";

describe("venue pages", () => {
  it("renders an empty public catalog without requiring authentication", () => {
    document.body.innerHTML = renderPublicVenues([]);
    expect(document.querySelector(".empty-state")?.textContent).toContain(
      "chưa có sân",
    );
  });

  it("presents public discovery as a sports-first hero with a usable search dock", () => {
    document.body.innerHTML = renderPublicVenues(
      [
        {
          id: "venue-1",
          name: "Arena Thảo Điền",
          address: "12 Đường số 8, Thủ Đức",
          description: "Cụm sân tiêu chuẩn với khu thay đồ và bãi xe.",
          offerings: [{ sportName: "Bóng đá" }],
        },
      ],
      {
        sports: [{ id: "sport-1", name: "Bóng đá" }],
        areas: [{ id: "area-1", name: "Thủ Đức" }],
      },
    );

    expect(document.querySelector(".discovery-hero")).not.toBeNull();
    expect(
      document.querySelector(".discovery-hero__media")?.getAttribute("src"),
    ).toBe("/assets/sports-hero.png");
    expect(
      document.querySelector(".search-dock [data-venue-search]"),
    ).not.toBeNull();
    expect(document.querySelector(".value-strip")?.textContent).toContain(
      "Xem lịch trống",
    );
    expect(
      document.querySelector(".venue-card__content")?.textContent,
    ).toContain("Arena Thảo Điền");
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

  it("shows readable sports, preserves search criteria and provides a map region", () => {
    document.body.innerHTML = renderPublicVenueDetail(
      {
        id: "venue-1",
        name: "Sân Xanh",
        address: "Quận 1",
        description: "Sân trung tâm",
        latitude: 10.7731,
        longitude: 106.7031,
        offerings: [
          {
            id: "offering-1",
            sportId: "sport-1",
            sportName: "Cầu lông",
            confirmationMode: "INSTANT",
          },
        ],
      },
      {
        sportId: "sport-1",
        startAt: "2026-09-14T01:00:00.000Z",
        endAt: "2026-09-14T02:00:00.000Z",
      },
    );

    expect(document.body.textContent).toContain("Cầu lông");
    expect(document.body.textContent).not.toContain("sport-1");
    expect(document.querySelector('[data-map][role="region"]')).not.toBeNull();
    expect(document.querySelector('[name="startAt"]')?.value).toBe(
      "2026-09-14T08:00",
    );
    expect(
      document.querySelector(".back-link")?.getAttribute("href"),
    ).toContain("sportId=sport-1");
    expect(document.querySelector(".venue-detail__booking")).not.toBeNull();
  });
});
