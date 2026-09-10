// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderOwnerVenuesPage } from "./owner-venues.js";

const catalog = {
  areas: [
    { id: "area-1", name: "Quận 1" },
    { id: "area-2", name: "Quận 3" },
  ],
  sports: [{ id: "sport-1", name: "Cầu lông" }],
  amenities: [
    { id: "amenity-1", name: "Bãi giữ xe" },
    { id: "amenity-2", name: "Phòng thay đồ" },
  ],
};
const venue = {
  id: "venue-1",
  areaId: "area-1",
  name: "Sân Xanh",
  address: "12 Nguyễn Huệ",
  description: "Sân thể thao trong nhà",
  latitude: 10.77,
  longitude: 106.7,
  status: "APPROVED",
  moderationReason: null,
  amenities: [{ id: "amenity-1", name: "Bãi giữ xe" }],
  offerings: [
    {
      id: "offering-1",
      sportId: "sport-1",
      sportName: "Cầu lông",
      confirmationMode: "OWNER_APPROVAL",
      advanceBookingDays: 30,
      cancellationNoticeMinutes: 120,
      isActive: true,
      courts: [
        { id: "court-1", internalName: "Sân A", isActive: true },
        { id: "court-2", internalName: "Sân B", isActive: false },
      ],
    },
  ],
};

describe("owner venue and inventory page", () => {
  it("renders safe create/edit/archive controls without an owner authority field", () => {
    document.body.innerHTML = renderOwnerVenuesPage({
      venues: [venue],
      catalog,
    });

    expect(document.querySelector('[name="ownerId"]')).toBeNull();
    expect(document.querySelector("[data-venue-create]")).not.toBeNull();
    expect(document.querySelector("[data-venue-edit]")).not.toBeNull();
    expect(
      document.querySelector('[data-action="archive-venue"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-venue-edit] [name="areaId"]')?.value,
    ).toBe("area-1");
  });

  it("renders readable offering policy and court edit/maintenance controls", () => {
    document.body.innerHTML = renderOwnerVenuesPage({
      venues: [venue],
      catalog,
    });

    expect(document.body.textContent).toContain("Cầu lông");
    expect(document.querySelector("[data-offering-edit]")).not.toBeNull();
    expect(
      document.querySelector('[data-court-id="court-1"] [data-court-edit]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-court-id="court-2"]')?.textContent,
    ).toContain("Tạm ngừng");
    expect(
      document.querySelector('[data-amenities-form] [value="amenity-1"]')
        ?.checked,
    ).toBe(true);
    expect(
      document.querySelector('[data-amenities-form] [value="amenity-2"]')
        ?.checked,
    ).toBe(false);
  });
});
