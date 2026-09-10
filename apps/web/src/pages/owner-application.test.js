// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  renderAdminOwnerApplications,
  renderOwnerApplication,
} from "./owner-application.js";

describe("owner application pages", () => {
  it("renders an accessible application form", () => {
    document.body.innerHTML = renderOwnerApplication();
    expect(document.querySelector('label[for="business-name"]')).not.toBeNull();
    expect(
      document.querySelector('textarea[name="experience"]'),
    ).not.toBeNull();
  });

  it("renders admin moderation actions with a rejection reason", () => {
    document.body.innerHTML = renderAdminOwnerApplications([
      { id: "application-1", businessName: "Sân Xanh", status: "PENDING" },
    ]);
    expect(document.querySelector('[data-action="approve"]')).not.toBeNull();
    expect(document.querySelector('textarea[name="reason"]')).not.toBeNull();
  });
});
