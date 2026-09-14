import { escapeHtml } from "./components/html.js";
import { icon } from "./components/icons.js";

function currentAttribute(href, pathname) {
  const isCurrent =
    href === "/"
      ? pathname === "/"
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
  const ownerNavigation = roles.includes("OWNER")
    ? `<nav class="workspace-nav owner-nav" aria-label="Điều hướng chủ sân">
        ${navLink("/owner", "Tổng quan", pathname, "venue")}
        ${navLink("/owner/calendar", "Lịch booking", pathname, "calendar")}
        ${navLink("/owner/bookings", "Quản lý booking", pathname, "booking")}
        ${navLink("/owner/venues", "Quản lý sân", pathname, "venue")}
        ${navLink("/owner/schedule", "Lịch & giá", pathname, "calendar")}
      </nav>`
    : "";
  const adminNavigation = roles.includes("ADMIN")
    ? `<nav class="workspace-nav admin-nav" aria-label="Điều hướng quản trị">
        ${navLink("/admin", "Tổng quan", pathname, "shield")}
        ${navLink("/admin/users", "Người dùng", pathname, "users")}
        ${navLink("/admin/owner-applications", "Hồ sơ owner", pathname, "booking")}
        ${navLink("/admin/venues", "Kiểm duyệt sân", pathname, "venue")}
        ${navLink("/admin/audit-logs", "Audit", pathname, "shield")}
      </nav>`
    : "";
  const account = user
    ? `<div class="account-summary"><span class="account-avatar" aria-hidden="true">${escapeHtml((user.displayName ?? user.email ?? "U").slice(0, 1).toUpperCase())}</span><span><strong>${escapeHtml(user.displayName ?? "Tài khoản")}</strong><small>${escapeHtml(user.email ?? roles.join(" · "))}</small></span></div>`
    : `<div class="account-actions"><a href="/login"${currentAttribute("/login", pathname)}>Đăng nhập</a><a class="button button--compact" href="/register"${currentAttribute("/register", pathname)}>Đăng ký</a></div>`;

  return `
    <a class="skip-link" href="#main-content">Bỏ qua điều hướng</a>
    <header class="site-header">
      <div class="header-main">
        <a class="brand" href="/" aria-label="Đặt Sân - Trang chủ"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span>ĐẶT<span>SÂN</span></span></a>
        <nav class="primary-nav" aria-label="Điều hướng chính">
          ${navLink("/", "Tìm sân", pathname, "search")}
          ${navLink("/bookings", "Booking của tôi", pathname, "booking")}
          ${navLink("/notifications", "Thông báo", pathname, "bell")}
          ${navLink("/owner/apply", "Trở thành chủ sân", pathname, "venue")}
        </nav>
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
