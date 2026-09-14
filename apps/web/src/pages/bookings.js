import { escapeHtml } from "../components/html.js";
import { apiRequest } from "../services/api.js";
import { authApi } from "../services/auth-api.js";

const vnd = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
});
const businessDateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

const statusLabels = Object.freeze({
  PENDING: "Chờ chủ sân duyệt",
  CONFIRMED: "Đã xác nhận",
  REJECTED: "Đã bị từ chối",
  CANCELLED: "Đã hủy",
  EXPIRED: "Đã hết hạn",
  COMPLETED: "Đã hoàn tất",
});

function toBusinessLocal(iso) {
  if (!iso) return "";
  const shifted = new Date(new Date(iso).getTime() + 7 * 60 * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function toUtcIso(localValue) {
  return new Date(`${localValue}:00+07:00`).toISOString();
}

export function isChronologicalInterval(startAt, endAt) {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && start < end;
}

export function bookingIdempotencyKey(
  form,
  bookingInterval,
  createKey = () => window.crypto.randomUUID(),
) {
  const intent = JSON.stringify([
    form.dataset.offeringId,
    bookingInterval.startAt,
    bookingInterval.endAt,
  ]);
  if (form.dataset.bookingIntent !== intent || !form.dataset.idempotencyKey) {
    form.dataset.bookingIntent = intent;
    form.dataset.idempotencyKey = createKey();
  }
  return form.dataset.idempotencyKey;
}

export function renderBookingWidget(offeringId, interval = {}) {
  return `<form class="booking-widget form-grid" data-booking-form data-offering-id="${escapeHtml(offeringId)}">
    <h3>Kiểm tra giá và đặt sân</h3>
    <label>Bắt đầu<input name="startAt" type="datetime-local" step="1800" value="${escapeHtml(toBusinessLocal(interval.startAt))}" required /></label>
    <label>Kết thúc<input name="endAt" type="datetime-local" step="1800" value="${escapeHtml(toBusinessLocal(interval.endAt))}" required /></label>
    <div class="actions"><button type="button" class="secondary" data-quote>Nhận báo giá</button><button type="submit">Đặt sân</button></div>
    <p role="status" aria-live="polite"></p>
  </form>`;
}

function canCustomerCancel(booking) {
  return ["PENDING", "CONFIRMED"].includes(booking.status);
}

function bookingCard(booking, detail = false) {
  const title = `${escapeHtml(booking.venueName)} · ${escapeHtml(booking.sportName)}`;
  return `<article class="booking-card" data-booking-id="${escapeHtml(booking.id)}">
    <div class="booking-card__heading"><div><p class="booking-card__label">${escapeHtml(booking.sportName)}</p><h2>${detail ? title : `<a href="/bookings/${escapeHtml(booking.id)}">${title}</a>`}</h2></div><span class="status-pill status-pill--${escapeHtml(booking.status.toLowerCase())}" data-booking-status>${escapeHtml(statusLabels[booking.status] ?? booking.status)}</span></div>
    <div class="booking-card__facts"><p><span>Thời gian</span><time datetime="${escapeHtml(booking.startAt)}">${escapeHtml(businessDateTime.format(new Date(booking.startAt)))}</time><small>đến ${escapeHtml(businessDateTime.format(new Date(booking.endAt)))}</small></p><p><span>Giá đã chốt</span><strong>${escapeHtml(vnd.format(booking.priceAmount))}</strong></p></div>
    <div class="booking-card__footer">${detail ? '<a href="/">Tìm thêm sân</a>' : `<a href="/bookings/${escapeHtml(booking.id)}">Xem chi tiết</a>`}${canCustomerCancel(booking) ? '<button data-action="cancel" class="secondary">Hủy booking</button>' : ""}</div>
  </article>`;
}

function renderBookingFilters(filters = {}) {
  const statusOptions = Object.entries(statusLabels)
    .map(
      ([value, label]) =>
        `<option value="${value}"${filters.status === value ? " selected" : ""}>${label}</option>`,
    )
    .join("");
  return `<form class="filter-form" data-booking-filters>
    <label for="booking-status">Trạng thái</label><select id="booking-status" name="status"><option value="">Tất cả</option>${statusOptions}</select>
    <label for="booking-from">Từ ngày</label><input id="booking-from" name="from" type="date" value="${escapeHtml(filters.from ?? "")}" />
    <label for="booking-to">Đến trước ngày</label><input id="booking-to" name="to" type="date" value="${escapeHtml(filters.to ?? "")}" />
    <label for="booking-sort">Sắp xếp</label><select id="booking-sort" name="sort"><option value="startAtDesc"${filters.sort !== "startAtAsc" ? " selected" : ""}>Mới nhất trước</option><option value="startAtAsc"${filters.sort === "startAtAsc" ? " selected" : ""}>Sớm nhất trước</option></select>
    <button type="submit">Áp dụng</button>
  </form>`;
}

export function renderCustomerBookings(bookings = [], filters = {}) {
  return `<section class="catalog customer-workspace" aria-labelledby="customer-bookings-title"><header class="workspace-header"><div><p class="eyebrow">Không gian của bạn</p><h1 id="customer-bookings-title">Booking của tôi</h1><p>Theo dõi lịch chơi, trạng thái xác nhận và chi phí trong một nơi.</p></div><div class="actions"><a class="button secondary" href="/notifications">Xem thông báo</a><a class="button" href="/">Tìm sân mới</a></div></header>${renderBookingFilters(filters)}<div class="booking-list" data-booking-results>${bookings.map((item) => bookingCard(item)).join("") || '<div class="empty-state"><strong>Chưa có booking phù hợp.</strong><p>Chọn một khung giờ trống để bắt đầu cuộc chơi tiếp theo.</p><a href="/">Khám phá sân</a></div>'}</div><p class="form-status" role="status" aria-live="polite"></p></section>`;
}

export function renderCustomerBookingDetail(booking) {
  return `<section class="catalog customer-workspace" aria-labelledby="booking-detail-title"><a class="back-link" href="/bookings">← Tất cả booking</a><header class="workspace-header"><div><p class="eyebrow">Thông tin lượt chơi</p><h1 id="booking-detail-title">Chi tiết booking</h1></div></header><div class="booking-detail-layout">${bookingCard(booking, true)}<aside class="support-card"><p class="section-kicker">Cần hỗ trợ?</p><h2>Kiểm tra trước giờ chơi</h2><p>Thông tin trạng thái luôn được đồng bộ tại đây và trong trung tâm thông báo.</p><a href="/notifications">Mở thông báo</a></aside></div><p class="form-status" role="status" aria-live="polite"></p></section>`;
}

function interval(form) {
  const values = new FormData(form);
  return {
    startAt: toUtcIso(String(values.get("startAt"))),
    endAt: toUtcIso(String(values.get("endAt"))),
  };
}

function validatedInterval(form) {
  const status = form.querySelector('[role="status"]');
  if (!form.reportValidity()) return null;
  const value = interval(form);
  if (!isChronologicalInterval(value.startAt, value.endAt)) {
    status.textContent = "Giờ kết thúc phải sau giờ bắt đầu.";
    return null;
  }
  return value;
}

export function mountBookingForms(container) {
  container.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-quote]");
    if (!button) return;
    const form = button.closest("[data-booking-form]");
    const status = form.querySelector('[role="status"]');
    const bookingInterval = validatedInterval(form);
    if (!bookingInterval) return;
    try {
      const quote = await apiRequest(
        `/offerings/${form.dataset.offeringId}/quotes`,
        { method: "POST", body: JSON.stringify(bookingInterval) },
      );
      status.textContent = `Tổng giá: ${vnd.format(quote.amount)}.`;
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "Không thể báo giá";
    }
  });
  container.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-booking-form]");
    if (!form) return;
    event.preventDefault();
    if (form.dataset.submitting === "true") return;
    const bookingInterval = validatedInterval(form);
    if (!bookingInterval) return;
    const submitButton = form.querySelector('button[type="submit"]');
    form.dataset.submitting = "true";
    submitButton.disabled = true;
    const allowRetry = () => {
      delete form.dataset.submitting;
      submitButton.disabled = false;
    };
    try {
      await authApi.ensureSession();
    } catch {
      allowRetry();
      const returnTo = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    const status = form.querySelector('[role="status"]');
    try {
      const booking = await apiRequest("/bookings", {
        method: "POST",
        headers: {
          "Idempotency-Key": bookingIdempotencyKey(form, bookingInterval),
        },
        body: JSON.stringify({
          offeringId: form.dataset.offeringId,
          ...bookingInterval,
        }),
      });
      status.innerHTML = `Đã tạo booking ${escapeHtml(statusLabels[booking.status] ?? booking.status)}. <a href="/bookings/${escapeHtml(booking.id)}">Xem chi tiết</a>`;
    } catch (error) {
      allowRetry();
      status.textContent =
        error instanceof Error ? error.message : "Không thể đặt sân";
    }
  });
}

export async function mountCustomerBookings(container) {
  const main = container.querySelector("main");
  const load = async (filters = {}) => {
    const query = new window.URLSearchParams({ page: "1", pageSize: "50" });
    if (filters.status) query.set("status", filters.status);
    if (filters.from) query.set("from", `${filters.from}T00:00:00+07:00`);
    if (filters.to) query.set("to", `${filters.to}T00:00:00+07:00`);
    if (filters.sort) query.set("sort", filters.sort);
    main.setAttribute("aria-busy", "true");
    try {
      const page = await apiRequest(`/bookings?${query.toString()}`);
      main.innerHTML = renderCustomerBookings(page.items, filters);
    } finally {
      main.removeAttribute("aria-busy");
    }
  };
  try {
    await load();
  } catch (error) {
    main.innerHTML = `<section class="page-card"><p role="alert">${escapeHtml(error instanceof Error ? error.message : "Không tải được booking")}</p></section>`;
    return;
  }
  main.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-booking-filters]");
    if (!form) return;
    event.preventDefault();
    const filters = Object.fromEntries(new FormData(form));
    try {
      await load(filters);
    } catch (error) {
      main.querySelector('[role="status"]').textContent =
        error instanceof Error ? error.message : "Không thể lọc booking";
    }
  });
  main.addEventListener("click", async (event) => {
    const button = event.target.closest('[data-action="cancel"]');
    const card = button?.closest("[data-booking-id]");
    if (!card) return;
    try {
      await apiRequest(`/bookings/${card.dataset.bookingId}/cancel`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      button.remove();
      card.querySelector("[data-booking-status]").textContent = "Đã hủy";
      main.querySelector('[role="status"]').textContent =
        "Booking đã được hủy.";
    } catch (error) {
      main.querySelector('[role="status"]').textContent =
        error instanceof Error ? error.message : "Không thể hủy";
    }
  });
}

export async function mountCustomerBookingDetail(container, id) {
  const main = container.querySelector("main");
  try {
    const booking = await apiRequest(`/bookings/${id}`);
    main.innerHTML = renderCustomerBookingDetail(booking);
  } catch (error) {
    main.innerHTML = `<section class="page-card"><h1>Chi tiết booking</h1><p role="alert">${escapeHtml(error instanceof Error ? error.message : "Không tải được booking")}</p><a href="/bookings">Quay lại danh sách</a></section>`;
    return;
  }
  main.addEventListener("click", async (event) => {
    const button = event.target.closest('[data-action="cancel"]');
    const card = button?.closest("[data-booking-id]");
    if (!button || !card) return;
    button.disabled = true;
    try {
      await apiRequest(`/bookings/${card.dataset.bookingId}/cancel`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      button.remove();
      card.querySelector("[data-booking-status]").textContent = "Đã hủy";
      main.querySelector('[role="status"]').textContent =
        "Booking đã được hủy.";
    } catch (error) {
      button.disabled = false;
      main.querySelector('[role="status"]').textContent =
        error instanceof Error ? error.message : "Không thể hủy";
    }
  });
}
