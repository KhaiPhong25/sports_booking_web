import { describe, expect, it } from "vitest";
import {
  canAccessRoute,
  effectiveRole,
  requiresSession,
  workspaceHome,
} from "./route-access.js";

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
    "/profile",
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

describe("role workspace policy", () => {
  it.each([
    { roles: ["CUSTOMER", "OWNER", "ADMIN"], role: "ADMIN", home: "/admin" },
    { roles: ["CUSTOMER", "OWNER"], role: "OWNER", home: "/owner" },
    { roles: ["CUSTOMER"], role: "CUSTOMER", home: "/" },
    { roles: [], role: null, home: null },
  ])("resolves $roles to the $role workspace", ({ roles, role, home }) => {
    expect(effectiveRole(roles)).toBe(role);
    expect(workspaceHome(roles)).toBe(home);
  });

  it.each([
    ["/", [], true],
    ["/venues/venue-1", [], true],
    ["/login", [], true],
    ["/register", [], true],
    ["/bookings", ["CUSTOMER"], true],
    ["/bookings/booking-1", ["CUSTOMER"], true],
    ["/notifications", ["CUSTOMER"], true],
    ["/owner/apply", ["CUSTOMER"], true],
    ["/profile", ["CUSTOMER"], true],
    ["/owner", ["CUSTOMER", "OWNER"], true],
    ["/owner/calendar", ["CUSTOMER", "OWNER"], true],
    ["/profile", ["CUSTOMER", "OWNER"], true],
    ["/admin", ["CUSTOMER", "ADMIN"], true],
    ["/admin/users", ["CUSTOMER", "ADMIN"], true],
    ["/profile", ["CUSTOMER", "ADMIN"], true],
  ])("allows %s for roles %j", (pathname, roles, allowed) => {
    expect(canAccessRoute(pathname, roles)).toBe(allowed);
  });

  it.each([
    ["/bookings", []],
    ["/admin", ["CUSTOMER"]],
    ["/owner", ["CUSTOMER"]],
    ["/owner/apply", ["CUSTOMER", "OWNER"]],
    ["/bookings", ["CUSTOMER", "OWNER"]],
    ["/admin", ["CUSTOMER", "OWNER"]],
    ["/", ["CUSTOMER", "OWNER"]],
    ["/bookings", ["CUSTOMER", "ADMIN"]],
    ["/owner", ["CUSTOMER", "ADMIN"]],
    ["/", ["CUSTOMER", "ADMIN"]],
    ["/login", ["CUSTOMER", "ADMIN"]],
  ])("denies %s for roles %j", (pathname, roles) => {
    expect(canAccessRoute(pathname, roles)).toBe(false);
  });
});
