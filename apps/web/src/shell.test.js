// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderShell } from "./shell.js";

describe("application shell", () => {
  it("renders a labelled primary navigation for keyboard and screen-reader users", () => {
    document.body.innerHTML = renderShell();
    const navigation = document.querySelector(
      'nav[aria-label="Điều hướng chính"]',
    );

    expect(navigation).not.toBeNull();
    expect(navigation.querySelector('a[href="/"]').textContent).toContain(
      "Tìm sân",
    );
  });

  it("shows privileged navigation only for the matching authenticated role", () => {
    document.body.innerHTML = renderShell(undefined, {
      roles: ["CUSTOMER", "OWNER"],
    });
    expect(
      document.querySelector('nav[aria-label="Điều hướng chủ sân"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('nav[aria-label="Điều hướng quản trị"]'),
    ).toBeNull();

    document.body.innerHTML = renderShell();
    expect(
      document.querySelector('nav[aria-label="Điều hướng chủ sân"]'),
    ).toBeNull();
    expect(
      document.querySelector('nav[aria-label="Điều hướng quản trị"]'),
    ).toBeNull();
  });
});
