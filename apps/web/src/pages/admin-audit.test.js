// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderAdminAuditLogs } from "./admin-audit.js";

describe("admin audit history", () => {
  it("renders actor, resource and expandable before/after data safely", () => {
    document.body.innerHTML = renderAdminAuditLogs({
      items: [
        {
          id: "audit-1",
          action: "USER_LOCKED",
          resourceType: "User",
          resourceId: "user-1",
          beforeData: { isLocked: false },
          afterData: { isLocked: true, note: "<script>alert(1)</script>" },
          createdAt: "2026-09-11T01:00:00.000Z",
          actor: { displayName: "Quản trị viên", email: "admin@example.com" },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    expect(document.querySelector("details")).not.toBeNull();
    expect(document.body.textContent).toContain("Quản trị viên");
    expect(document.body.textContent).toContain("USER_LOCKED");
    expect(document.querySelector('label[for="audit-action"]')).not.toBeNull();
    expect(
      document.querySelector('label[for="audit-actor-id"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('label[for="audit-resource-id"]'),
    ).not.toBeNull();
    expect(
      document.querySelector(".audit-timeline .audit-card"),
    ).not.toBeNull();
    expect(document.querySelector("script")).toBeNull();
  });
});
