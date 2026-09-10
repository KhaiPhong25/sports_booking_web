import { escapeHtml } from "../components/html.js";
import { apiRequest } from "../services/api.js";

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
  PENDING: "Chờ duyệt",
  CONFIRMED: "Đã xác nhận",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã hủy",
  EXPIRED: "Đã hết hạn",
  COMPLETED: "Đã hoàn tất",
});

function statusLabel(status) {
  return statusLabels[status] ?? status;
}

function bookingSummary(booking) {
  return `<article class="booking-card" data-booking-id="${escapeHtml(booking.id)}">
    <div class="booking-card__heading"><h2>${escapeHtml(booking.venueName)} · ${escapeHtml(booking.sportName)}</h2><span class="status-pill status-pill--${escapeHtml(booking.status.toLowerCase())}">${escapeHtml(statusLabel(booking.status))}</span></div>
    <p><time datetime="${escapeHtml(booking.startAt)}">${escapeHtml(businessDateTime.format(new Date(booking.startAt)))}</time> – <time datetime="${escapeHtml(booking.endAt)}">${escapeHtml(businessDateTime.format(new Date(booking.endAt)))}</time></p>
    <p><strong>Sân vật lý:</strong> ${escapeHtml(booking.courtName ?? "Chưa phân")}</p>
    <a href="/owner/bookings/${escapeHtml(booking.id)}">Xem booking</a>
  </article>`;
}

function ownerBookingFilters(venues, filters) {
  const venueOptions = venues
    .map(
      (venue) =>
        `<option value="${escapeHtml(venue.id)}"${filters.venueId === venue.id ? " selected" : ""}>${escapeHtml(venue.name)}</option>`,
    )
    .join("");
  const statusOptions = Object.entries(statusLabels)
    .map(
      ([value, label]) =>
        `<option value="${value}"${filters.status === value ? " selected" : ""}>${label}</option>`,
    )
    .join("");
  return `<form class="filter-form" data-owner-booking-filters>
    <label for="owner-booking-venue">Địa điểm</label><select id="owner-booking-venue" name="venueId"><option value="">Tất cả địa điểm</option>${venueOptions}</select>
    <label for="owner-booking-status">Trạng thái</label><select id="owner-booking-status" name="status"><option value="">Tất cả trạng thái</option>${statusOptions}</select>
    <label for="owner-booking-from">Từ ngày</label><input id="owner-booking-from" name="from" type="date" value="${escapeHtml(filters.from ?? "")}" />
    <label for="owner-booking-to">Đến trước ngày</label><input id="owner-booking-to" name="to" type="date" value="${escapeHtml(filters.to ?? "")}" />
    <label for="owner-booking-sort">Sắp xếp</label><select id="owner-booking-sort" name="sort"><option value="startAtDesc"${filters.sort !== "startAtAsc" ? " selected" : ""}>Mới nhất trước</option><option value="startAtAsc"${filters.sort === "startAtAsc" ? " selected" : ""}>Sớm nhất trước</option></select>
    <button type="submit">Lọc booking</button>
  </form>`;
}

export function renderOwnerBookings({
  bookings = [],
  venues = [],
  filters = {},
} = {}) {
  return `<section class="catalog" aria-labelledby="owner-bookings-title">
    <div class="page-heading"><div><p class="eyebrow">Khu vực chủ sân</p><h1 id="owner-bookings-title">Quản lý booking</h1></div><div class="actions"><a href="/owner/calendar">Xem dạng lịch</a><a href="/owner">Về tổng quan</a></div></div>
    ${ownerBookingFilters(venues, filters)}
    <div data-owner-booking-results>${bookings.map(bookingSummary).join("") || '<p class="empty-state">Không có booking phù hợp.</p>'}</div>
    <p class="form-status" role="status" aria-live="polite"></p>
  </section>`;
}

function actionControls(booking, courts) {
  if (!["PENDING", "CONFIRMED"].includes(booking.status)) return "";
  const alternatives = courts.filter(
    (court) => court.isActive && court.id !== booking.courtId,
  );
  const courtOptions = alternatives
    .map(
      (court) =>
        `<option value="${escapeHtml(court.id)}">${escapeHtml(court.internalName)}</option>`,
    )
    .join("");
  return `<form class="owner-booking-actions" data-owner-booking-actions>
    <label for="owner-action-reason">Lý do từ chối/hủy</label><input id="owner-action-reason" name="reason" minlength="3" maxlength="500" />
    <label for="owner-action-court">Chuyển sang sân</label><select id="owner-action-court" name="courtId"${alternatives.length ? "" : " disabled"}><option value="">${alternatives.length ? "Chọn sân thay thế" : "Không có sân thay thế"}</option>${courtOptions}</select>
    <div class="actions">
      ${booking.status === "PENDING" ? '<button type="button" data-action="confirm">Duyệt booking</button><button type="button" class="secondary" data-action="reject">Từ chối booking</button>' : ""}
      <button type="button" class="secondary" data-action="cancel">Hủy booking</button>
      <button type="button" class="secondary" data-action="reassign"${alternatives.length ? "" : " disabled"}>Chuyển sân</button>
    </div>
  </form>`;
}

export function renderOwnerBookingDetail(booking, courts = []) {
  const customer = booking.customer ?? {};
  return `<section class="catalog" aria-labelledby="owner-booking-detail-title">
    <a class="back-link" href="/owner/bookings">← Danh sách booking</a>
    <article class="page-card booking-detail" data-booking-id="${escapeHtml(booking.id)}">
      <div class="booking-card__heading"><div><p class="eyebrow">Chi tiết booking</p><h1 id="owner-booking-detail-title">${escapeHtml(booking.venueName)} · ${escapeHtml(booking.sportName)}</h1></div><span class="status-pill status-pill--${escapeHtml(booking.status.toLowerCase())}" data-booking-status>${escapeHtml(statusLabel(booking.status))}</span></div>
      <dl class="detail-list">
        <div><dt>Thời gian</dt><dd><time datetime="${escapeHtml(booking.startAt)}">${escapeHtml(businessDateTime.format(new Date(booking.startAt)))}</time> – <time datetime="${escapeHtml(booking.endAt)}">${escapeHtml(businessDateTime.format(new Date(booking.endAt)))}</time></dd></div>
        <div><dt>Sân vật lý</dt><dd>${escapeHtml(booking.courtName ?? "Chưa phân")}</dd></div>
        <div><dt>Giá đã chốt</dt><dd>${escapeHtml(vnd.format(booking.priceAmount))}</dd></div>
        <div><dt>Khách hàng</dt><dd>${escapeHtml(customer.displayName ?? "Chưa có thông tin")}</dd></div>
        <div><dt>Email</dt><dd>${customer.email ? `<a href="mailto:${escapeHtml(customer.email)}">${escapeHtml(customer.email)}</a>` : "Chưa có"}</dd></div>
        <div><dt>Điện thoại</dt><dd>${customer.phone ? `<a href="tel:${escapeHtml(customer.phone)}">${escapeHtml(customer.phone)}</a>` : "Chưa có"}</dd></div>
        ${booking.cancellationReason ? `<div><dt>Lý do hủy</dt><dd>${escapeHtml(booking.cancellationReason)}</dd></div>` : ""}
      </dl>
      ${actionControls(booking, courts)}
      <p class="form-status" role="status" aria-live="polite"></p>
    </article>
  </section>`;
}

function filtersFromForm(form) {
  return Object.fromEntries(
    [...new FormData(form).entries()]
      .map(([key, value]) => [key, String(value)])
      .filter(([, value]) => value),
  );
}

function ownerBookingQuery(filters) {
  const query = new window.URLSearchParams();
  if (filters.venueId) query.set("venueId", filters.venueId);
  if (filters.status) query.set("status", filters.status);
  if (filters.from) query.set("from", `${filters.from}T00:00:00+07:00`);
  if (filters.to) query.set("to", `${filters.to}T00:00:00+07:00`);
  if (filters.sort) query.set("sort", filters.sort);
  return query;
}

export async function fetchAllOwnerBookings(
  baseQuery = new window.URLSearchParams(),
) {
  const pageSize = 100;
  const queryForPage = (page) => {
    const query = new window.URLSearchParams(baseQuery);
    query.set("page", String(page));
    query.set("pageSize", String(pageSize));
    return query;
  };
  const firstPage = await apiRequest(
    `/owner/bookings?${queryForPage(1).toString()}`,
  );
  const pageCount = Math.ceil(firstPage.total / pageSize);
  if (pageCount <= 1) return firstPage.items;
  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      apiRequest(`/owner/bookings?${queryForPage(index + 2).toString()}`),
    ),
  );
  return [firstPage, ...remainingPages].flatMap((page) => page.items);
}

export async function mountOwnerBookings(container) {
  const main = container.querySelector("main");
  const initial = Object.fromEntries(
    new window.URLSearchParams(window.location.search),
  );
  let venues = [];
  const load = async (filters = {}) => {
    main.setAttribute("aria-busy", "true");
    try {
      const [venuePage, bookings] = await Promise.all([
        venues.length
          ? Promise.resolve({ items: venues })
          : apiRequest("/owner/venues?page=1&pageSize=100"),
        fetchAllOwnerBookings(ownerBookingQuery(filters)),
      ]);
      venues = venuePage.items;
      main.innerHTML = renderOwnerBookings({
        bookings,
        venues,
        filters,
      });
    } finally {
      main.removeAttribute("aria-busy");
    }
  };
  try {
    await load(initial);
  } catch (error) {
    main.innerHTML = `<section class="page-card"><h1>Quản lý booking</h1><p role="alert">${escapeHtml(error instanceof Error ? error.message : "Không tải được booking")}</p></section>`;
    return;
  }
  main.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-owner-booking-filters]");
    if (!form) return;
    event.preventDefault();
    const filters = filtersFromForm(form);
    window.history.replaceState(
      null,
      "",
      `/owner/bookings?${new window.URLSearchParams(filters).toString()}`,
    );
    try {
      await load(filters);
    } catch (error) {
      main.querySelector('[role="status"]').textContent =
        error instanceof Error ? error.message : "Không thể lọc booking";
    }
  });
}

async function loadOwnerBooking(id) {
  const booking = await apiRequest(`/owner/bookings/${id}`);
  const venue = await apiRequest(`/owner/venues/${booking.venueId}`);
  const offering = (venue.offerings ?? []).find(
    (item) => item.id === booking.offeringId,
  );
  return { booking, courts: offering?.courts ?? [] };
}

export async function mountOwnerBookingDetail(container, id) {
  const main = container.querySelector("main");
  let current;
  let courts;
  const render = (message = "") => {
    main.innerHTML = renderOwnerBookingDetail(current, courts);
    main.querySelector('[role="status"]').textContent = message;
  };
  try {
    ({ booking: current, courts } = await loadOwnerBooking(id));
    render();
  } catch (error) {
    main.innerHTML = `<section class="page-card"><h1>Chi tiết booking</h1><p role="alert">${escapeHtml(error instanceof Error ? error.message : "Không tải được booking")}</p><a href="/owner/bookings">Quay lại danh sách</a></section>`;
    return;
  }
  main.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    const form = button?.closest("[data-owner-booking-actions]");
    if (!button || !form) return;
    const action = button.dataset.action;
    const values = Object.fromEntries(new FormData(form));
    const reason = String(values.reason ?? "").trim();
    const courtId = String(values.courtId ?? "");
    const status = main.querySelector('[role="status"]');
    if (["reject", "cancel"].includes(action) && reason.length < 3) {
      status.textContent = "Lý do phải có ít nhất 3 ký tự.";
      form.querySelector('[name="reason"]').focus();
      return;
    }
    if (action === "reassign" && !courtId) {
      status.textContent = "Hãy chọn sân thay thế.";
      return;
    }
    if (form.dataset.submitting === "true") return;
    const actionButtons = [
      ...form.querySelectorAll("button[data-action]"),
    ].filter((item) => item instanceof window.HTMLButtonElement);
    const previousDisabled = actionButtons.map((item) => item.disabled);
    form.dataset.submitting = "true";
    actionButtons.forEach((item) => {
      item.disabled = true;
    });
    try {
      current = await apiRequest(`/owner/bookings/${id}/${action}`, {
        method: "POST",
        ...(action === "confirm"
          ? {}
          : {
              body: JSON.stringify(
                action === "reassign" ? { courtId } : { reason },
              ),
            }),
      });
      render(
        action === "reassign"
          ? "Đã chuyển booking sang sân mới."
          : "Đã cập nhật trạng thái booking.",
      );
    } catch (error) {
      delete form.dataset.submitting;
      actionButtons.forEach((item, index) => {
        item.disabled = previousDisabled[index];
      });
      status.textContent =
        error instanceof Error ? error.message : "Không thể cập nhật booking";
    }
  });
}
