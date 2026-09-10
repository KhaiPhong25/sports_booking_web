import { createVenueImageKey, validateVenueImage } from "./venue-image-policy";

describe("venue image policy", () => {
  it("creates an owner-independent object key under the venue prefix", () => {
    expect(createVenueImageKey("venue-123", "image/png")).toMatch(
      /^venues\/venue-123\/[0-9a-f-]+\.png$/,
    );
  });

  it("rejects non-image content and files over five megabytes", () => {
    expect(() => validateVenueImage("text/html", 100)).toThrow(
      "JPEG, PNG or WebP",
    );
    expect(() => validateVenueImage("image/jpeg", 5 * 1024 * 1024 + 1)).toThrow(
      "5 MB",
    );
  });
});
