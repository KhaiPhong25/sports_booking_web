import { escapeHtml } from "../components/html.js";
import { apiRequest } from "../services/api.js";
import { authApi } from "../services/auth-api.js";

const vnd = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
});

export function renderBookingWidget(offeringId) {
  return `<form class="booking-widget form-grid" data-booking-form data-offering-id="${escapeHtml(offeringId)}">
    <h3>Kiểm tra giá và đặt sân</h3>
    <label>Bắt đầu<input name="startAt" type="datetime-local" step="1800" required /></label>
    <label>Kết thúc<input name="endAt" type="datetime-local" step="1800" required /></label>
    <div class="actions"><button type="button" class="secondary" data-quote>Nhận báo giá</button><button type="submit">Đặt sân</button></div>
    <p role="status" aria-live="polite"></p>
  </form>`;
}

function bookingCard(booking, owner) {
  return `<article class="booking-card" data-booking-id="${escapeHtml(booking.id)}">
    <h2>${escapeHtml(booking.venueName)} · ${escapeHtml(booking.sportName)}</h2>
    <p><strong>Trạng thái:</strong> ${escapeHtml(booking.status)}</p>
    <p><time datetime="${escapeHtml(booking.startAt)}">${escapeHtml(new Date(booking.startAt).toLocaleString("vi-VN"))}</time> – <time datetime="${escapeHtml(booking.endAt)}">${escapeHtml(new Date(booking.endAt).toLocaleString("vi-VN"))}</time></p>
    <p><strong>Giá đã chốt:</strong> ${escapeHtml(vnd.format(booking.priceAmount))}</p>
    ${owner ? `<p><strong>Sân vật lý:</strong> ${escapeHtml(booking.courtName ?? booking.courtId ?? "Chưa phân")}</p><label>Lý do thao tác<input name="reason" /></label><label>Court ID mới<input name="courtId" /></label><div class="actions"><button data-action="confirm">Duyệt</button><button data-action="reject" class="secondary">Từ chối</button><button data-action="cancel" class="secondary">Hủy</button><button data-action="reassign" class="secondary">Chuyển sân</button></div>` : `<button data-action="cancel" class="secondary">Hủy booking</button>`}
  </article>`;
}

export function renderCustomerBookings(bookings = []) {
  return `<section class="catalog"><h1>Booking của tôi</h1>${bookings.map((item) => bookingCard(item, false)).join("") || '<p class="empty-state">Bạn chưa có booking.</p>'}<p role="status" aria-live="polite"></p></section>`;
}

export function renderOwnerBookings(bookings = []) {
  return `<section class="catalog"><h1>Booking tại các sân của tôi</h1>${bookings.map((item) => bookingCard(item, true)).join("") || '<p class="empty-state">Chưa có booking.</p>'}<p role="status" aria-live="polite"></p></section>`;
}

function interval(form) {
  const values = new FormData(form);
  return {
    startAt: new Date(String(values.get("startAt"))).toISOString(),
    endAt: new Date(String(values.get("endAt"))).toISOString(),
  };
}

export function mountBookingForms(container) {
  container.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-quote]");
    if (!button) return;
    const form = button.closest("[data-booking-form]");
    const status = form.querySelector('[role="status"]');
    try {
      const quote = await apiRequest(
        `/offerings/${form.dataset.offeringId}/quotes`,
        { method: "POST", body: JSON.stringify(interval(form)) },
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
    if (!authApi.token()) {
      window.location.assign("/login");
      return;
    }
    const status = form.querySelector('[role="status"]');
    try {
      const booking = await apiRequest("/bookings", {
        method: "POST",
        headers: { "Idempotency-Key": window.crypto.randomUUID() },
        body: JSON.stringify({
          offeringId: form.dataset.offeringId,
          ...interval(form),
        }),
      });
      status.textContent = `Đã tạo booking ${booking.status}.`;
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "Không thể đặt sân";
    }
  });
}

export async function mountCustomerBookings(container) {
  const main = container.querySelector("main");
  try {
    const page = await apiRequest("/bookings");
    main.innerHTML = renderCustomerBookings(page.items);
  } catch (error) {
    main.innerHTML = `<section class="page-card"><p role="alert">${escapeHtml(error instanceof Error ? error.message : "Không tải được booking")}</p></section>`;
    return;
  }
  main.addEventListener("click", async (event) => {
    const button = event.target.closest('[data-action="cancel"]');
    const card = button?.closest("[data-booking-id]");
    if (!card) return;
    try {
      await apiRequest(`/bookings/${card.dataset.bookingId}/cancel`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      button.disabled = true;
      main.querySelector('[role="status"]').textContent =
        "Booking đã được hủy.";
    } catch (error) {
      main.querySelector('[role="status"]').textContent =
        error instanceof Error ? error.message : "Không thể hủy";
    }
  });
}

export async function mountOwnerBookings(container) {
  const main = container.querySelector("main");
  try {
    const page = await apiRequest("/owner/bookings");
    main.innerHTML = renderOwnerBookings(page.items);
  } catch (error) {
    main.innerHTML = `<section class="page-card"><p role="alert">${escapeHtml(error instanceof Error ? error.message : "Không tải được booking")}</p></section>`;
    return;
  }
  main.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    const card = button?.closest("[data-booking-id]");
    if (!card) return;
    const action = button.dataset.action;
    const reason = card.querySelector('[name="reason"]')?.value ?? "";
    const courtId = card.querySelector('[name="courtId"]')?.value ?? "";
    try {
      await apiRequest(`/owner/bookings/${card.dataset.bookingId}/${action}`, {
        method: "POST",
        ...(action === "confirm"
          ? {}
          : {
              body: JSON.stringify(
                action === "reassign" ? { courtId } : { reason },
              ),
            }),
      });
      main.querySelector('[role="status"]').textContent =
        "Đã cập nhật booking.";
    } catch (error) {
      main.querySelector('[role="status"]').textContent =
        error instanceof Error ? error.message : "Không thể cập nhật";
    }
  });
}
