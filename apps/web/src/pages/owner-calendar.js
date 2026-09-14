import { escapeHtml } from "../components/html.js";
import { apiRequest } from "../services/api.js";
import { fetchAllOwnerBookings } from "./owner-bookings.js";

const statusLabels = Object.freeze({
  PENDING: "Chờ duyệt",
  CONFIRMED: "Đã xác nhận",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã hủy",
  EXPIRED: "Đã hết hạn",
  COMPLETED: "Đã hoàn tất",
});

const dateLabel = new Intl.DateTimeFormat("vi-VN", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});
const timeLabel = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

function dateString(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value, amount) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return dateString(date);
}

function currentBusinessDate() {
  const parts = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

function bookingBusinessDate(iso) {
  const parts = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).formatToParts(new Date(iso));
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

export function weekRange(referenceDate = currentBusinessDate()) {
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)
    ? referenceDate
    : currentBusinessDate();
  const reference = new Date(`${safeDate}T12:00:00.000Z`);
  const daysSinceMonday = (reference.getUTCDay() + 6) % 7;
  reference.setUTCDate(reference.getUTCDate() - daysSinceMonday);
  const startDate = dateString(reference);
  return { startDate, endDate: addDays(startDate, 7) };
}

function calendarBooking(booking) {
  return `<article class="calendar-booking calendar-booking--${escapeHtml(booking.status.toLowerCase())}">
    <time datetime="${escapeHtml(booking.startAt)}">${escapeHtml(timeLabel.format(new Date(booking.startAt)))}</time>
    <strong>${escapeHtml(booking.sportName)}</strong>
    <span>${escapeHtml(booking.venueName)}</span>
    <span class="status-pill">${escapeHtml(statusLabels[booking.status] ?? booking.status)}</span>
    <a href="/owner/bookings/${escapeHtml(booking.id)}">Xem booking</a>
  </article>`;
}

export function renderOwnerCalendar({
  bookings = [],
  venues = [],
  weekStart = weekRange().startDate,
  venueId = "",
} = {}) {
  const range = weekRange(weekStart);
  const venueOptions = venues
    .map(
      (venue) =>
        `<option value="${escapeHtml(venue.id)}"${venue.id === venueId ? " selected" : ""}>${escapeHtml(venue.name)}</option>`,
    )
    .join("");
  const venueQuery = venueId ? `&venueId=${encodeURIComponent(venueId)}` : "";
  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(range.startDate, index),
  );
  return `<section class="catalog" aria-labelledby="owner-calendar-title">
    <header class="workspace-header"><div><p class="eyebrow">Điều phối theo tuần</p><h1 id="owner-calendar-title">Lịch booking</h1><p>Quan sát công suất theo ngày và mở nhanh từng booking cần xử lý.</p></div><a class="button secondary" href="/owner">Về tổng quan</a></header>
    <div class="calendar-toolbar"><form class="filter-form" method="get" action="/owner/calendar">
      <label for="calendar-week">Tuần chứa ngày</label><input id="calendar-week" name="week" type="date" value="${escapeHtml(range.startDate)}" />
      <label for="calendar-venue">Địa điểm</label><select id="calendar-venue" name="venueId"><option value="">Tất cả địa điểm</option>${venueOptions}</select>
      <button type="submit">Xem lịch</button>
    </form>
    <div class="calendar-nav"><a data-week-nav="previous" href="/owner/calendar?week=${addDays(range.startDate, -7)}${venueQuery}">← Tuần trước</a><strong>${escapeHtml(range.startDate)} – ${escapeHtml(addDays(range.endDate, -1))}</strong><a data-week-nav="next" href="/owner/calendar?week=${range.endDate}${venueQuery}">Tuần sau →</a></div></div>
    <div class="week-calendar" role="list" aria-label="Booking từ ${escapeHtml(range.startDate)} đến ${escapeHtml(range.endDate)}">
      ${days
        .map((day) => {
          const items = bookings.filter(
            (booking) => bookingBusinessDate(booking.startAt) === day,
          );
          return `<section class="calendar-day" data-date="${day}" role="listitem"><h2>${escapeHtml(dateLabel.format(new Date(`${day}T12:00:00.000Z`)))}</h2>${items.map(calendarBooking).join("") || '<p class="empty-state">Không có booking</p>'}</section>`;
        })
        .join("")}
    </div>
  </section>`;
}

export async function mountOwnerCalendar(container) {
  const main = container.querySelector("main");
  const params = new window.URLSearchParams(window.location.search);
  const range = weekRange(params.get("week") ?? undefined);
  const venueId = params.get("venueId") ?? "";
  const bookingQuery = new window.URLSearchParams({
    sort: "startAtAsc",
    from: `${range.startDate}T00:00:00+07:00`,
    to: `${range.endDate}T00:00:00+07:00`,
  });
  if (venueId) bookingQuery.set("venueId", venueId);
  main.setAttribute("aria-busy", "true");
  try {
    const [venuePage, bookings] = await Promise.all([
      apiRequest("/owner/venues?page=1&pageSize=100"),
      fetchAllOwnerBookings(bookingQuery),
    ]);
    main.innerHTML = renderOwnerCalendar({
      bookings,
      venues: venuePage.items,
      weekStart: range.startDate,
      venueId,
    });
  } catch (error) {
    main.innerHTML = `<section class="page-card"><h1>Lịch booking</h1><p role="alert">${escapeHtml(error instanceof Error ? error.message : "Không tải được lịch booking")}</p></section>`;
  } finally {
    main.removeAttribute("aria-busy");
  }
}
