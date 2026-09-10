import { escapeHtml } from "../components/html.js";
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
    <div class="page-heading"><div><p class="eyebrow">Khu vực chủ sân</p><h1 id="owner-dashboard-title">Tổng quan vận hành</h1></div></div>
    <div class="metric-grid">
      ${metric("Địa điểm đang quản lý", venues.length, "venues")}
      ${metric("Địa điểm đã duyệt", approved, "approved")}
      ${metric("Booking chờ duyệt", pending, "pending")}
      ${metric("Booking đã xác nhận", confirmed, "confirmed")}
    </div>
    <nav class="owner-actions" aria-label="Tác vụ chủ sân">
      <a class="action-card" href="/owner/calendar"><strong>Lịch booking</strong><span>Xem lịch vận hành theo tuần</span></a>
      <a class="action-card" href="/owner/bookings"><strong>Quản lý booking</strong><span>Duyệt, từ chối, hủy hoặc chuyển sân</span></a>
      <a class="action-card" href="/owner/venues"><strong>Địa điểm và sân con</strong><span>Quản lý venue, offering và court</span></a>
      <a class="action-card" href="/owner/schedule"><strong>Lịch hoạt động và giá</strong><span>Quản lý giờ mở cửa, closure và pricing</span></a>
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
