import { escapeHtml } from "../components/html.js";
import { apiRequest } from "../services/api.js";

const typeLabels = Object.freeze({
  BOOKING_CREATED: "Có booking mới",
  BOOKING_PENDING: "Booking đang chờ duyệt",
  BOOKING_CONFIRMED: "Booking đã được xác nhận",
  BOOKING_REJECTED: "Booking đã bị từ chối",
  BOOKING_CANCELLED: "Booking đã bị hủy",
  BOOKING_EXPIRED: "Yêu cầu booking đã hết hạn",
  BOOKING_COMPLETED: "Booking đã hoàn tất",
});
const businessDateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

function notificationCard(notification) {
  const unread = !notification.readAt;
  const payload = notification.payload ?? {};
  const bookingLink = payload.bookingId
    ? `<a href="/bookings/${escapeHtml(payload.bookingId)}">Xem booking</a>`
    : "";
  return `<article class="notification-card${unread ? " is-unread" : ""}" data-notification-id="${escapeHtml(notification.id)}">
    <div>
      <p class="notification-state">${unread ? "Chưa đọc" : "Đã đọc"}</p>
      <h2>${escapeHtml(typeLabels[notification.type] ?? "Cập nhật booking")}</h2>
      <p>${escapeHtml(payload.venueName ?? "Địa điểm thể thao")}</p>
      <time datetime="${escapeHtml(notification.createdAt)}">${escapeHtml(businessDateTime.format(new Date(notification.createdAt)))}</time>
    </div>
    <div class="actions">${bookingLink}${unread ? '<button type="button" class="secondary" data-mark-read>Đánh dấu đã đọc</button>' : ""}</div>
  </article>`;
}

export function renderNotifications(items = [], filter = "all") {
  const cards = items.length
    ? items.map(notificationCard).join("")
    : '<div class="empty-state"><strong>Bạn chưa có thông báo phù hợp.</strong><p>Các cập nhật booking sẽ xuất hiện ở đây.</p><a href="/">Tìm sân để bắt đầu</a></div>';
  return `<section class="catalog" aria-labelledby="notifications-title">
    <header class="workspace-header"><div><p class="eyebrow">Trung tâm hoạt động</p><h1 id="notifications-title">Thông báo</h1><p>Không bỏ lỡ thay đổi trạng thái nào trong hành trình booking.</p></div><a class="button secondary" href="/bookings">Booking của tôi</a></header>
    <form class="filter-form" data-notification-filters>
      <label for="notification-filter">Hiển thị</label>
      <select id="notification-filter" name="filter">
        <option value="all"${filter === "all" ? " selected" : ""}>Tất cả</option>
        <option value="unread"${filter === "unread" ? " selected" : ""}>Chưa đọc</option>
        <option value="read"${filter === "read" ? " selected" : ""}>Đã đọc</option>
      </select>
      <button type="submit">Lọc thông báo</button>
    </form>
    <div class="notification-list activity-feed">${cards}</div>
    <p class="form-status" role="status" aria-live="polite"></p>
  </section>`;
}

async function loadNotifications(main, filter) {
  const query = new window.URLSearchParams({ page: "1", pageSize: "50" });
  if (filter === "unread") query.set("unread", "true");
  if (filter === "read") query.set("unread", "false");
  main.setAttribute("aria-busy", "true");
  try {
    const page = await apiRequest(`/notifications?${query.toString()}`);
    main.innerHTML = renderNotifications(page.items, filter);
  } finally {
    main.removeAttribute("aria-busy");
  }
}

export async function mountNotifications(container) {
  const main = container.querySelector("main");
  try {
    await loadNotifications(main, "all");
  } catch (error) {
    main.innerHTML = `<section class="page-card"><h1>Thông báo</h1><p role="alert">${escapeHtml(error instanceof Error ? error.message : "Không tải được thông báo")}</p><button type="button" data-retry-notifications>Thử lại</button></section>`;
  }
  main.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-notification-filters]");
    if (!form) return;
    event.preventDefault();
    const filter = String(new FormData(form).get("filter") ?? "all");
    try {
      await loadNotifications(main, filter);
    } catch (error) {
      form.querySelector("button").disabled = false;
      main.querySelector('[role="status"]').textContent =
        error instanceof Error ? error.message : "Không thể lọc thông báo";
    }
  });
  main.addEventListener("click", async (event) => {
    const retry = event.target.closest("[data-retry-notifications]");
    if (retry) {
      retry.disabled = true;
      try {
        await loadNotifications(main, "all");
      } catch (error) {
        retry.disabled = false;
        main.querySelector('[role="alert"]').textContent =
          error instanceof Error ? error.message : "Không tải được thông báo";
      }
      return;
    }
    const button = event.target.closest("[data-mark-read]");
    const card = button?.closest("[data-notification-id]");
    if (!button || !card) return;
    button.disabled = true;
    try {
      await apiRequest(`/notifications/${card.dataset.notificationId}/read`, {
        method: "POST",
      });
      card.classList.remove("is-unread");
      card.querySelector(".notification-state").textContent = "Đã đọc";
      button.remove();
      main.querySelector('[role="status"]').textContent =
        "Đã đánh dấu thông báo là đã đọc.";
    } catch (error) {
      button.disabled = false;
      main.querySelector('[role="status"]').textContent =
        error instanceof Error ? error.message : "Không thể cập nhật thông báo";
    }
  });
}
