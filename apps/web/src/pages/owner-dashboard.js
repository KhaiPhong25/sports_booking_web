import { escapeHtml } from "../components/html.js";
import { icon } from "../components/icons.js";
import { apiRequest } from "../services/api.js";
import { fetchAllOwnerBookings } from "./owner-bookings.js";

function metric(label, value, name) {
  return `<article class="metric-card" data-metric="${name}"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></article>`;
}

export function renderOwnerDashboard({ venues = [], bookings = [] } = {}) {
  const approved = venues.filter((venue) => venue.status === "APPROVED").length;
  const pending = bookings.filter(
    (booking) => booking.status === "PENDING",
  ).length;
  const confirmed = bookings.filter(
    (booking) => booking.status === "CONFIRMED",
  ).length;
  return `<section class="catalog owner-dashboard" aria-labelledby="owner-dashboard-title">
    <header class="workspace-hero workspace-hero--owner"><div><p class="eyebrow">Trung tâm vận hành</p><h1 id="owner-dashboard-title">Giữ mọi sân<br />đúng nhịp.</h1><p>Từ lượt đặt đang chờ đến lịch hoạt động — toàn bộ tín hiệu quan trọng nằm trong một bảng điều khiển.</p></div><div class="workspace-hero__signal"><span>Live operations</span><strong>${pending}</strong><small>booking cần xử lý</small></div></header>
    <div class="metric-grid">
      ${metric("Địa điểm đang quản lý", venues.length, "venues")}
      ${metric("Địa điểm đã duyệt", approved, "approved")}
      ${metric("Booking chờ duyệt", pending, "pending")}
      ${metric("Booking đã xác nhận", confirmed, "confirmed")}
    </div>
    <div class="section-heading"><div><p class="section-kicker">Điều phối nhanh</p><h2>Chọn khu vực cần xử lý</h2></div></div>
    <nav class="owner-actions" aria-label="Tác vụ chủ sân">
      <a class="action-card" href="/owner/calendar">${icon("calendar", "action-card__icon")}<strong>Lịch booking</strong><span>Xem lịch vận hành theo tuần</span><b>Xem lịch →</b></a>
      <a class="action-card" href="/owner/bookings">${icon("booking", "action-card__icon")}<strong>Quản lý booking</strong><span>Duyệt, từ chối, hủy hoặc chuyển sân</span><b>Mở hàng đợi →</b></a>
      <a class="action-card" href="/owner/venues">${icon("venue", "action-card__icon")}<strong>Địa điểm và sân con</strong><span>Quản lý venue, offering và court</span><b>Quản lý sân →</b></a>
      <a class="action-card" href="/owner/schedule">${icon("calendar", "action-card__icon")}<strong>Lịch hoạt động và giá</strong><span>Quản lý giờ mở cửa, closure và pricing</span><b>Thiết lập →</b></a>
    </nav>
  </section>`;
}

export async function mountOwnerDashboard(container) {
  const main = container.querySelector("main");
  main.setAttribute("aria-busy", "true");
  try {
    const [venuePage, bookingPage] = await Promise.all([
      apiRequest("/owner/venues?page=1&pageSize=100"),
      fetchAllOwnerBookings(
        new window.URLSearchParams({
          sort: "startAtAsc",
          from: new Date().toISOString(),
        }),
      ),
    ]);
    main.innerHTML = renderOwnerDashboard({
      venues: venuePage.items,
      bookings: bookingPage,
    });
  } catch (error) {
    main.innerHTML = `<section class="page-card"><h1>Tổng quan vận hành</h1><p role="alert">${escapeHtml(error instanceof Error ? error.message : "Không tải được dashboard")}</p></section>`;
  } finally {
    main.removeAttribute("aria-busy");
  }
}
