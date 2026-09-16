// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  loginReturnPath,
  renderLoginPage,
  renderRegisterPage,
} from "./auth.js";

describe("authentication pages", () => {
  it("shows the Sports Center brand on authentication pages", () => {
    document.body.innerHTML = renderLoginPage();

    expect(document.querySelector('a.auth-brand[href="/"]')?.textContent).toBe(
      "SPORTS CENTER",
    );
  });

  it("renders a labelled registration form with a live status region", () => {
    document.body.innerHTML = renderRegisterPage();
    expect(
      document.querySelector('label[for="register-email"]'),
    ).not.toBeNull();
    expect(document.querySelector('input[name="phone"]')).not.toBeNull();
    expect(
      document.querySelector('[role="status"][aria-live="polite"]'),
    ).not.toBeNull();
  });

  it("renders a password field and login action", () => {
    document.body.innerHTML = renderLoginPage();
    expect(document.querySelector('input[type="password"]')).not.toBeNull();
    expect(
      document.querySelector('button[type="submit"]')?.textContent,
    ).toContain("Đăng nhập");
    expect(document.querySelector(".auth-layout")).not.toBeNull();
    expect(document.querySelector(".auth-panel")).not.toBeNull();
  });

  it("confirms that a password change signed the user out safely", () => {
    document.body.innerHTML = renderLoginPage("?reason=password-changed");

    expect(document.querySelector(".auth-notice")?.textContent).toContain(
      "Mật khẩu đã được thay đổi",
    );
    expect(document.querySelector(".auth-notice")?.getAttribute("role")).toBe(
      "status",
    );
  });

  it("accepts only a local return path after login", () => {
    expect(loginReturnPath("?returnTo=%2Fvenues%2Fvenue-1%3FsportId%3D1")).toBe(
      "/venues/venue-1?sportId=1",
    );
    expect(loginReturnPath("?returnTo=https%3A%2F%2Fevil.example")).toBe("/");
    expect(loginReturnPath("?returnTo=%2F%2Fevil.example")).toBe("/");
    expect(loginReturnPath("?returnTo=%2F%5Cevil.example")).toBe("/");
  });

  it.each([
    [["CUSTOMER", "ADMIN"], "/admin"],
    [["CUSTOMER", "OWNER"], "/owner"],
    [["CUSTOMER"], "/"],
  ])("uses the workspace home for roles %j", (roles, expected) => {
    expect(loginReturnPath("", roles)).toBe(expected);
  });

  it("keeps an allowed return path and rejects a route from another role", () => {
    expect(loginReturnPath("?returnTo=%2Fprofile", ["CUSTOMER", "ADMIN"])).toBe(
      "/profile",
    );
    expect(
      loginReturnPath("?returnTo=%2Fadmin%2Fusers", ["CUSTOMER", "OWNER"]),
    ).toBe("/owner");
  });
});
