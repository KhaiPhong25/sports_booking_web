import { escapeHtml } from "./components/html.js";
import { icon } from "./components/icons.js";
import { authApi } from "./services/auth-api.js";
import { effectiveRole, workspaceHome } from "./services/route-access.js";

function currentAttribute(href, pathname) {
  const exactRoutes = new Set(["/", "/owner", "/admin"]);
  const isCurrent = exactRoutes.has(href)
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
  return isCurrent ? ' aria-current="page"' : "";
}

function navLink(href, label, pathname, iconName) {
  return `<a href="${href}"${currentAttribute(href, pathname)}>${icon(iconName, "nav-icon")}<span>${label}</span></a>`;
}

export function renderShell(
  content,
  user = null,
  pathname = globalThis.window?.location?.pathname ?? "/",
) {
  const roles = user?.roles ?? [];
  const role = effectiveRole(roles);
  const brandDestination = workspaceHome(roles) ?? "/";
  const customerNavigation =
    !user || role === "CUSTOMER"
      ? `<nav class="primary-nav" aria-label="Điều hướng chính">
          ${navLink("/", "Tìm sân", pathname, "search")}
          ${navLink("/bookings", "Booking của tôi", pathname, "booking")}
          ${navLink("/notifications", "Thông báo", pathname, "bell")}
          ${navLink("/owner/apply", "Trở thành chủ sân", pathname, "venue")}
        </nav>`
      : "";
  const ownerNavigation =
    role === "OWNER"
      ? `<nav class="workspace-nav owner-nav" aria-label="Điều hướng chủ sân">
        ${navLink("/owner", "Tổng quan", pathname, "venue")}
        ${navLink("/owner/calendar", "Lịch booking", pathname, "calendar")}
        ${navLink("/owner/bookings", "Quản lý booking", pathname, "booking")}
        ${navLink("/owner/venues", "Quản lý sân", pathname, "venue")}
        ${navLink("/owner/schedule", "Lịch & giá", pathname, "calendar")}
      </nav>`
      : "";
  const adminNavigation =
    role === "ADMIN"
      ? `<nav class="workspace-nav admin-nav" aria-label="Điều hướng quản trị">
        ${navLink("/admin", "Tổng quan", pathname, "shield")}
        ${navLink("/admin/users", "Người dùng", pathname, "users")}
        ${navLink("/admin/owner-applications", "Hồ sơ owner", pathname, "booking")}
        ${navLink("/admin/venues", "Kiểm duyệt sân", pathname, "venue")}
        ${navLink("/admin/audit-logs", "Audit", pathname, "shield")}
      </nav>`
      : "";
  const account = user
    ? `<div class="account-menu" data-account-menu>
        <button class="account-summary" type="button" aria-label="Mở menu tài khoản của ${escapeHtml(user.displayName ?? "Tài khoản")}" aria-expanded="false" aria-controls="account-menu">
          ${user.avatarUrl ? `<img class="account-avatar" src="${escapeHtml(user.avatarUrl)}" alt="Ảnh đại diện của ${escapeHtml(user.displayName ?? "tài khoản")}" />` : `<span class="account-avatar" data-account-fallback aria-hidden="true">${escapeHtml((user.displayName ?? user.email ?? "U").slice(0, 1).toUpperCase())}</span>`}
          <span class="account-summary__identity"><strong>${escapeHtml(user.displayName ?? "Tài khoản")}</strong><small>${escapeHtml(user.email ?? roles.join(" · "))}</small></span>
        </button>
        <div class="account-menu__popover" id="account-menu" hidden>
          <a href="/profile"${currentAttribute("/profile", pathname)}>${icon("users", "account-menu__icon")}<span>Thông tin cá nhân</span></a>
          <button type="button" data-account-logout>${icon("arrow", "account-menu__icon")}<span>Đăng xuất</span></button>
          <p class="account-menu__status" data-account-menu-status role="status" aria-live="polite"></p>
        </div>
      </div>`
    : `<div class="account-actions"><a href="/login"${currentAttribute("/login", pathname)}>Đăng nhập</a><a class="button button--compact" href="/register"${currentAttribute("/register", pathname)}>Đăng ký</a></div>`;

  return `
    <a class="skip-link" href="#main-content">Bỏ qua điều hướng</a>
    <header class="site-header">
      <div class="header-main">
        <a class="brand" href="${brandDestination}" aria-label="Sports Center - Trang chủ"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span>SPORTS <span>CENTER</span></span></a>
        ${customerNavigation}
        ${account}
      </div>
      ${ownerNavigation}
      ${adminNavigation}
    </header>
    <main id="main-content">${
      content ??
      `
      <section class="hero" aria-labelledby="hero-title">
        <p class="eyebrow">Thành phố Hồ Chí Minh</p>
        <h1 id="hero-title">Tìm sân phù hợp với lịch của bạn</h1>
        <p>Tìm bóng đá, bóng rổ và cầu lông theo khu vực và giờ trống.</p>
      </section>`
    }
    </main>`;
}

export function mountShell(container, dependencies = {}) {
  const trigger = container.querySelector(".account-summary");
  const menu = container.querySelector("#account-menu");
  const accountMenu = trigger?.closest("[data-account-menu]");
  if (!trigger || !menu || !accountMenu) return;
  const logout = dependencies.logout ?? (() => authApi.logout());
  const navigate =
    dependencies.navigate ?? ((path) => window.location.assign(path));
  const logoutButton = menu.querySelector("[data-account-logout]");
  const status = menu.querySelector("[data-account-menu-status]");

  const close = () => {
    trigger.setAttribute("aria-expanded", "false");
    menu.hidden = true;
  };

  trigger.addEventListener("click", () => {
    const willOpen = trigger.getAttribute("aria-expanded") !== "true";
    trigger.setAttribute("aria-expanded", String(willOpen));
    menu.hidden = !willOpen;
  });

  container.ownerDocument.addEventListener("click", (event) => {
    if (!accountMenu.contains(event.target)) close();
  });

  container.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      trigger.getAttribute("aria-expanded") === "true"
    ) {
      close();
      trigger.focus();
    }
  });

  logoutButton?.addEventListener("click", async () => {
    logoutButton.disabled = true;
    status.textContent = "Đang đăng xuất…";
    try {
      await logout();
      navigate("/");
    } catch (error) {
      logoutButton.disabled = false;
      status.textContent =
        error instanceof Error ? error.message : "Không thể đăng xuất";
    }
  });
}
