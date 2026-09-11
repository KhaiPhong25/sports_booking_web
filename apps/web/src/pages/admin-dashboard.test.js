// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderAdminDashboard } from "./admin-dashboard.js";

describe("admin dashboard", () => {
  it("summarizes moderation queues and exposes all admin tasks", () => {
    document.body.innerHTML = renderAdminDashboard({
      users: 12,
      pendingApplications: 2,
      pendingVenues: 3,
      recentAudits: 5,
    });

    expect(
      document.querySelector('[data-metric="users"]')?.textContent,
    ).toContain("12");
    for (const href of [
      "/admin/users",
      "/admin/owner-applications",
      "/admin/venues",
      "/admin/audit-logs",
    ]) {
      expect(document.querySelector(`a[href="${href}"]`)).not.toBeNull();
    }
  });
});
