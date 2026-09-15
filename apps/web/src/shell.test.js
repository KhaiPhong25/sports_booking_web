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

  it("marks the matching route as current without marking sibling routes", () => {
    document.body.innerHTML = renderShell("<p>Nội dung</p>", null, "/bookings");

    expect(
      document
        .querySelector('a[href="/bookings"]')
        ?.getAttribute("aria-current"),
    ).toBe("page");
    expect(
      document.querySelector('a[href="/"]')?.getAttribute("aria-current"),
    ).toBeNull();
  });

  it("renders the signed-in identity and keeps role navigation route-aware", () => {
    document.body.innerHTML = renderShell(
      "<p>Nội dung</p>",
      {
        displayName: "Minh Anh",
        email: "minh@example.com",
        roles: ["CUSTOMER", "OWNER"],
      },
      "/owner",
    );

    expect(document.querySelector(".account-summary")?.textContent).toContain(
      "Minh Anh",
    );
    expect(
      document
        .querySelector('.owner-nav a[href="/owner"]')
        ?.getAttribute("aria-current"),
    ).toBe("page");
  });

  it("links the signed-in identity to profile and renders its avatar", () => {
    document.body.innerHTML = renderShell(
      "<p>Nội dung</p>",
      {
        displayName: "Nguyễn An",
        email: "an@example.com",
        roles: ["CUSTOMER"],
        avatarUrl: "/api/v1/users/user-1/avatar?v=1",
      },
      "/profile",
    );

    const account = document.querySelector(
      'a.account-summary[href="/profile"]',
    );
    expect(account?.getAttribute("aria-current")).toBe("page");
    expect(account?.querySelector("img")?.getAttribute("src")).toBe(
      "/api/v1/users/user-1/avatar?v=1",
    );
    expect(account?.querySelector("img")?.getAttribute("alt")).toBe(
      "Ảnh đại diện của Nguyễn An",
    );
    expect(document.querySelector("[data-account-fallback]")).toBeNull();
  });

  it("keeps an initials fallback when the account has no avatar", () => {
    document.body.innerHTML = renderShell("<p>Nội dung</p>", {
      displayName: "Minh Anh",
      email: "minh@example.com",
      roles: ["CUSTOMER"],
      avatarUrl: null,
    });

    expect(document.querySelector("[data-account-fallback]")?.textContent).toBe(
      "M",
    );
  });

  it("marks only the specific workspace route as current", () => {
    document.body.innerHTML = renderShell(
      "<p>Nội dung</p>",
      { roles: ["OWNER"] },
      "/owner/calendar",
    );

    const currentLinks = document.querySelectorAll(
      '.owner-nav a[aria-current="page"]',
    );
    expect(currentLinks).toHaveLength(1);
    expect(currentLinks[0]?.getAttribute("href")).toBe("/owner/calendar");
  });
});
