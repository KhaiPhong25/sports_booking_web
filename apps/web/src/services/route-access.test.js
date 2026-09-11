import { describe, expect, it } from "vitest";
import { requiresSession } from "./route-access.js";

describe("protected web routes", () => {
  it.each([
    "/admin",
    "/admin/users",
    "/owner",
    "/owner/apply",
    "/owner/bookings",
    "/bookings",
    "/bookings/booking-1",
    "/notifications",
  ])("requires a session for %s", (pathname) => {
    expect(requiresSession(pathname)).toBe(true);
  });

  it.each(["/", "/login", "/register", "/venues/venue-1"])(
    "keeps %s public",
    (pathname) => {
      expect(requiresSession(pathname)).toBe(false);
    },
  );
});
