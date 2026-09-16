// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { authApi } from "./services/auth-api.js";
import { mountShell, renderShell } from "./shell.js";

describe("application shell", () => {
  it("identifies the product as Sports Center in the site header", () => {
    document.body.innerHTML = renderShell();

    const brand = document.querySelector('a.brand[href="/"]');
    expect(brand?.getAttribute("aria-label")).toBe("Sports Center - Trang chủ");
    expect(brand?.textContent).toBe("SPORTS CENTER");
  });

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

  it("shows only Owner navigation for an Owner session", () => {
    document.body.innerHTML = renderShell(undefined, {
      roles: ["CUSTOMER", "OWNER"],
    });
    expect(
      document.querySelector('nav[aria-label="Điều hướng chủ sân"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('nav[aria-label="Điều hướng quản trị"]'),
    ).toBeNull();
    expect(
      document.querySelector('nav[aria-label="Điều hướng chính"]'),
    ).toBeNull();
    expect(document.querySelector("a.brand")?.getAttribute("href")).toBe(
      "/owner",
    );
  });

  it("shows only Admin navigation for an Admin session", () => {
    document.body.innerHTML = renderShell(undefined, {
      roles: ["CUSTOMER", "OWNER", "ADMIN"],
    });
    expect(
      document.querySelector('nav[aria-label="Điều hướng quản trị"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('nav[aria-label="Điều hướng chủ sân"]'),
    ).toBeNull();
    expect(
      document.querySelector('nav[aria-label="Điều hướng chính"]'),
    ).toBeNull();
    expect(document.querySelector("a.brand")?.getAttribute("href")).toBe(
      "/admin",
    );
  });

  it("keeps public navigation when no user is signed in", () => {
    document.body.innerHTML = renderShell();
    expect(
      document.querySelector('nav[aria-label="Điều hướng chủ sân"]'),
    ).toBeNull();
    expect(
      document.querySelector('nav[aria-label="Điều hướng quản trị"]'),
    ).toBeNull();
    expect(
      document.querySelector('nav[aria-label="Điều hướng chính"]'),
    ).not.toBeNull();
    expect(document.querySelector("a.brand")?.getAttribute("href")).toBe("/");
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

  it("renders the signed-in identity as an accessible account menu", () => {
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
      'button.account-summary[aria-controls="account-menu"]',
    );
    expect(account?.getAttribute("aria-expanded")).toBe("false");
    expect(account?.getAttribute("aria-label")).toBe(
      "Mở menu tài khoản của Nguyễn An",
    );
    expect(account?.querySelector("img")?.getAttribute("src")).toBe(
      "/api/v1/users/user-1/avatar?v=1",
    );
    expect(account?.querySelector("img")?.getAttribute("alt")).toBe(
      "Ảnh đại diện của Nguyễn An",
    );
    expect(document.querySelector("#account-menu")?.hidden).toBe(true);
    expect(
      document.querySelector('#account-menu a[href="/profile"]')?.textContent,
    ).toContain("Thông tin cá nhân");
    expect(
      document.querySelector("#account-menu [data-account-logout]")
        ?.textContent,
    ).toContain("Đăng xuất");
    expect(document.querySelector("[data-account-fallback]")).toBeNull();
  });

  it("opens and closes the account menu from its trigger", () => {
    document.body.innerHTML = renderShell("<p>Nội dung</p>", {
      displayName: "Nguyễn An",
      email: "an@example.com",
      roles: ["CUSTOMER"],
    });
    mountShell(document.body);

    const trigger = document.querySelector(".account-summary");
    const menu = document.querySelector("#account-menu");
    trigger.click();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(menu.hidden).toBe(false);

    trigger.click();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(menu.hidden).toBe(true);
  });

  it("closes the account menu when the user clicks outside it", () => {
    document.body.innerHTML = `<div id="app">${renderShell("<p>Nội dung</p>", {
      displayName: "Nguyễn An",
      email: "an@example.com",
      roles: ["CUSTOMER"],
    })}</div><button id="outside" type="button">Ngoài ứng dụng</button>`;
    mountShell(document.querySelector("#app"));

    const trigger = document.querySelector(".account-summary");
    const menu = document.querySelector("#account-menu");
    trigger.click();
    document.querySelector("#outside").click();

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(menu.hidden).toBe(true);
  });

  it("closes the account menu with Escape and returns focus to its trigger", () => {
    document.body.innerHTML = renderShell("<p>Nội dung</p>", {
      displayName: "Nguyễn An",
      email: "an@example.com",
      roles: ["CUSTOMER"],
    });
    mountShell(document.body);

    const trigger = document.querySelector(".account-summary");
    const menu = document.querySelector("#account-menu");
    const profileLink = menu.querySelector('a[href="/profile"]');
    trigger.click();
    profileLink.focus();
    profileLink.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it("logs out the active session before returning to the public home page", async () => {
    const user = {
      displayName: "Nguyễn An",
      email: "an@example.com",
      roles: ["CUSTOMER"],
    };
    document.body.innerHTML = renderShell("<p>Nội dung</p>", user);
    authApi.replaceUser(user);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new globalThis.Response(null, {
        status: 204,
      }),
    );
    let destination = null;

    try {
      mountShell(document.body, {
        navigate: (path) => {
          destination = path;
        },
      });
      document.querySelector(".account-summary").click();
      document.querySelector("[data-account-logout]").click();

      await vi.waitFor(() => expect(destination).toBe("/"));
      expect(authApi.user()).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
      authApi.clearSession();
    }
  });

  it("keeps the session and offers a retry when logout fails", async () => {
    const user = {
      displayName: "Nguyễn An",
      email: "an@example.com",
      roles: ["CUSTOMER"],
    };
    document.body.innerHTML = renderShell("<p>Nội dung</p>", user);
    authApi.replaceUser(user);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new globalThis.Response(
        JSON.stringify({ message: "Dịch vụ đăng xuất đang bận" }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    let destination = null;

    try {
      mountShell(document.body, {
        navigate: (path) => {
          destination = path;
        },
      });
      document.querySelector(".account-summary").click();
      const logoutButton = document.querySelector("[data-account-logout]");
      logoutButton.click();

      await vi.waitFor(() =>
        expect(
          document.querySelector("[data-account-menu-status]").textContent,
        ).toBe("Dịch vụ đăng xuất đang bận"),
      );
      expect(logoutButton.disabled).toBe(false);
      expect(authApi.user()).toEqual(user);
      expect(destination).toBeNull();
      expect(document.querySelector("#account-menu").hidden).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
      authApi.clearSession();
    }
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
