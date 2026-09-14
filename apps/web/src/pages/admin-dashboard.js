import { escapeHtml } from "../components/html.js";
import { icon } from "../components/icons.js";
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
  const pendingTotal = pendingApplications + pendingVenues;
  return `<section class="catalog admin-dashboard" aria-labelledby="admin-dashboard-title">
    <header class="workspace-hero workspace-hero--admin"><div><p class="eyebrow">System control</p><h1 id="admin-dashboard-title">Tổng quan<br />hệ thống.</h1><p>Theo dõi sức khỏe vận hành, xử lý hàng đợi kiểm duyệt và truy vết thay đổi quan trọng.</p></div><div class="workspace-hero__signal"><span>Awaiting review</span><strong>${pendingTotal}</strong><small>mục cần quyết định</small></div></header>
    <div class="metric-grid">
      ${metric("Tài khoản", users, "users")}
      ${metric("Hồ sơ owner chờ duyệt", pendingApplications, "applications")}
      ${metric("Địa điểm chờ duyệt", pendingVenues, "venues")}
      ${metric("Bản ghi audit gần đây", recentAudits, "audits")}
    </div>
    <div class="section-heading"><div><p class="section-kicker">Control center</p><h2>Khu vực quản trị</h2></div></div><nav class="owner-actions" aria-label="Tác vụ quản trị">
      <a class="action-card" href="/admin/users">${icon("users", "action-card__icon")}<strong>Quản lý người dùng</strong><span>Tìm, lọc, khóa hoặc mở khóa tài khoản</span><b>Mở danh sách →</b></a>
      <a class="action-card" href="/admin/owner-applications">${icon("booking", "action-card__icon")}<strong>Duyệt hồ sơ owner</strong><span>Xét quyền vận hành địa điểm</span><b>Xem hàng đợi →</b></a>
      <a class="action-card" href="/admin/venues">${icon("venue", "action-card__icon")}<strong>Kiểm duyệt địa điểm</strong><span>Duyệt, từ chối hoặc ẩn nội dung</span><b>Kiểm duyệt →</b></a>
      <a class="action-card" href="/admin/audit-logs">${icon("shield", "action-card__icon")}<strong>Lịch sử audit</strong><span>Truy vết các thao tác quản trị quan trọng</span><b>Mở nhật ký →</b></a>
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
