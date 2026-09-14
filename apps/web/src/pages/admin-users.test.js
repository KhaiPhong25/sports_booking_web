// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderAdminUsers } from "./admin-users.js";

describe("admin user controls", () => {
  it("renders safe identity details, filters and a context-aware lock action", () => {
    document.body.innerHTML = renderAdminUsers(
      {
        items: [
          {
            id: "user-1",
            displayName: "Nguyễn An",
            email: "an@example.com",
            phone: "+84901234567",
            roles: ["CUSTOMER"],
            isLocked: false,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      },
      { query: "An", role: "CUSTOMER", locked: "false" },
    );

    expect(document.querySelector('[name="query"]')?.value).toBe("An");
    expect(
      document.querySelector('[data-user-id="user-1"]')?.textContent,
    ).not.toContain("password");
    expect(
      document.querySelector('[data-action="lock"]')?.textContent,
    ).toContain("Khóa");
    expect(document.querySelector(".data-row")).not.toBeNull();
  });
});
