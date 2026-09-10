// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderLoginPage, renderRegisterPage } from "./auth.js";

describe("authentication pages", () => {
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
  });
});
