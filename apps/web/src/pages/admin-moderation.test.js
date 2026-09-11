// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  renderAdminOwnerApplications,
  renderAdminVenues,
} from "./admin-moderation.js";

describe("admin moderation", () => {
  it("shows decision controls only for pending owner applications", () => {
    document.body.innerHTML = renderAdminOwnerApplications({
      items: [
        {
          id: "application-1",
          businessName: "Sân Xanh",
          experience: "Ba năm vận hành",
          status: "PENDING",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    expect(document.querySelector('[data-action="approve"]')).not.toBeNull();
    expect(document.querySelector('textarea[minlength="10"]')).not.toBeNull();
    expect(
      document.querySelector('label[for="application-status"]'),
    ).not.toBeNull();
  });

  it("allows an approved venue to be hidden with a reason", () => {
    document.body.innerHTML = renderAdminVenues({
      items: [
        {
          id: "venue-1",
          name: "Sân Trung Tâm",
          address: "Quận 1",
          status: "APPROVED",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    expect(document.querySelector('[data-action="hide"]')).not.toBeNull();
    expect(document.querySelector('[data-action="approve"]')).toBeNull();
    expect(document.querySelector('textarea[minlength="10"]')).not.toBeNull();
  });
});
