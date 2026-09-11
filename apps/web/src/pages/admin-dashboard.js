import { escapeHtml } from "../components/html.js";
import { apiRequest } from "../services/api.js";
import { errorMarkup } from "./admin-ui.js";

function metric(label, value, name) {
  return `<article class="metric-card" data-metric="${name}"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></article>`;
}

export function renderAdminDashboard({
  users = 0,
  pendingApplications = 0,
  pendingVenues = 0,
  recentAudits = 0,
} = {}) {
  return `<section class="catalog admin-dashboard" aria-labelledby="admin-dashboard-title">
    <div class="page-heading"><div><p class="eyebrow">Khu vực quản trị</p><h1 id="admin-dashboard-title">Tổng quan hệ thống</h1></div></div>
    <div class="metric-grid">
      ${metric("Tài khoản", users, "users")}
      ${metric("Hồ sơ owner chờ duyệt", pendingApplications, "applications")}
      ${metric("Địa điểm chờ duyệt", pendingVenues, "venues")}
      ${metric("Bản ghi audit gần đây", recentAudits, "audits")}
    </div>
    <nav class="owner-actions" aria-label="Tác vụ quản trị">
      <a class="action-card" href="/admin/users"><strong>Quản lý người dùng</strong><span>Tìm, lọc, khóa hoặc mở khóa tài khoản</span></a>
      <a class="action-card" href="/admin/owner-applications"><strong>Duyệt hồ sơ owner</strong><span>Xét quyền vận hành địa điểm</span></a>
      <a class="action-card" href="/admin/venues"><strong>Kiểm duyệt địa điểm</strong><span>Duyệt, từ chối hoặc ẩn nội dung</span></a>
      <a class="action-card" href="/admin/audit-logs"><strong>Lịch sử audit</strong><span>Truy vết các thao tác quản trị quan trọng</span></a>
    </nav>
  </section>`;
}

export async function mountAdminDashboard(container) {
  const main = container.querySelector("main");
  main.setAttribute("aria-busy", "true");
  try {
    const [users, applications, venues, audits] = await Promise.all([
      apiRequest("/admin/users?page=1&pageSize=1"),
      apiRequest("/admin/owner-applications?status=PENDING&page=1&pageSize=1"),
      apiRequest("/admin/venues?status=PENDING_APPROVAL&page=1&pageSize=1"),
      apiRequest("/admin/audit-logs?page=1&pageSize=5"),
    ]);
    main.innerHTML = renderAdminDashboard({
      users: users.total,
      pendingApplications: applications.total,
      pendingVenues: venues.total,
      recentAudits: audits.items.length,
    });
  } catch (error) {
    main.innerHTML = errorMarkup("Tổng quan hệ thống", error);
  } finally {
    main.removeAttribute("aria-busy");
  }
}
