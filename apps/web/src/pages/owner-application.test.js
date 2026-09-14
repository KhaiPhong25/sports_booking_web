// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderOwnerApplication } from "./owner-application.js";

describe("owner application pages", () => {
  it("renders an accessible application form", () => {
    document.body.innerHTML = renderOwnerApplication();
    expect(document.querySelector('label[for="business-name"]')).not.toBeNull();
    expect(
      document.querySelector('textarea[name="experience"]'),
    ).not.toBeNull();
    expect(
      document.querySelector(".application-process")?.textContent,
    ).toContain("Xét duyệt");
  });
});
