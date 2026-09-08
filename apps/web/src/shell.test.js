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
});
