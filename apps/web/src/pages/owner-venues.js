import { escapeHtml } from "../components/html.js";
import { apiRequest } from "../services/api.js";

const venueStatusLabels = Object.freeze({
  DRAFT: "Bản nháp",
  PENDING_APPROVAL: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã từ chối",
  HIDDEN: "Đã ẩn",
  ARCHIVED: "Đã lưu trữ",
});

function selected(value, expected) {
  return value === expected ? " selected" : "";
}

function areaOptions(areas, selectedId = "") {
  return areas
    .map(
      (area) =>
        `<option value="${escapeHtml(area.id)}"${selected(selectedId, area.id)}>${escapeHtml(area.name)}</option>`,
    )
    .join("");
}

function venueFields(prefix, areas, venue = {}) {
  return `<label for="${prefix}-name">Tên địa điểm</label><input id="${prefix}-name" name="name" value="${escapeHtml(venue.name ?? "")}" required />
    <label for="${prefix}-area">Khu vực</label><select id="${prefix}-area" name="areaId" required>${areaOptions(areas, venue.areaId)}</select>
    <label for="${prefix}-address">Địa chỉ</label><input id="${prefix}-address" name="address" value="${escapeHtml(venue.address ?? "")}" required />
    <label for="${prefix}-description">Mô tả</label><textarea id="${prefix}-description" name="description" required minlength="10">${escapeHtml(venue.description ?? "")}</textarea>
    <label for="${prefix}-latitude">Vĩ độ</label><input id="${prefix}-latitude" name="latitude" type="number" step="0.000001" min="-90" max="90" value="${escapeHtml(venue.latitude ?? "")}" required />
    <label for="${prefix}-longitude">Kinh độ</label><input id="${prefix}-longitude" name="longitude" type="number" step="0.000001" min="-180" max="180" value="${escapeHtml(venue.longitude ?? "")}" required />`;
}

function offeringPolicy(offering) {
  const id = escapeHtml(offering.id);
  return `<form class="form-grid" data-offering-edit data-offering-id="${id}">
    <label for="offering-mode-${id}">Chế độ xác nhận</label><select id="offering-mode-${id}" name="confirmationMode"><option value="INSTANT"${selected(offering.confirmationMode, "INSTANT")}>Xác nhận ngay</option><option value="OWNER_APPROVAL"${selected(offering.confirmationMode, "OWNER_APPROVAL")}>Chủ sân duyệt</option></select>
    <label for="offering-advance-${id}">Số ngày đặt trước</label><input id="offering-advance-${id}" name="advanceBookingDays" type="number" min="1" max="365" value="${escapeHtml(offering.advanceBookingDays)}" required />
    <label for="offering-cancel-${id}">Báo trước khi hủy (phút)</label><input id="offering-cancel-${id}" name="cancellationNoticeMinutes" type="number" min="0" max="10080" value="${escapeHtml(offering.cancellationNoticeMinutes)}" required />
    <label class="checkbox-label"><input name="isActive" type="checkbox"${offering.isActive ? " checked" : ""} /> Đang nhận booking</label>
    <button type="submit">Lưu chính sách offering</button>
  </form>`;
}

function courtRow(court, offeringId) {
  const id = escapeHtml(court.id);
  return `<div class="court-row" data-court-id="${id}">
    <form class="inline-form" data-court-edit data-offering-id="${escapeHtml(offeringId)}"><label for="court-name-${id}">Tên sân con</label><input id="court-name-${id}" name="internalName" value="${escapeHtml(court.internalName)}" required /><button type="submit">Đổi tên</button></form>
    <span class="resource-state resource-state--${court.isActive ? "active" : "paused"}">${court.isActive ? "Đang hoạt động" : "Tạm ngừng"}</span>
    <button type="button" class="secondary" data-action="toggle-court" data-active="${String(!court.isActive)}">${court.isActive ? "Tạm ngừng sân" : "Mở lại sân"}</button>
  </div>`;
}

function offeringCard(offering) {
  const id = escapeHtml(offering.id);
  return `<details class="inventory-group resource-subsection" data-offering-id="${id}">
    <summary class="booking-card__heading"><strong>${escapeHtml(offering.sportName ?? "Môn thể thao")}</strong><span class="status-pill">${offering.isActive ? "Đang hoạt động" : "Tạm ngừng"}</span></summary>
    ${offeringPolicy(offering)}
    <h4>Sân vật lý</h4>
    <div class="court-list">${(offering.courts ?? []).map((court) => courtRow(court, offering.id)).join("") || '<p class="empty-state">Chưa có sân con.</p>'}</div>
    <form class="inline-form" data-court-create><label for="new-court-${id}">Tên sân con mới</label><input id="new-court-${id}" name="internalName" required /><button type="submit">Thêm sân con</button></form>
  </details>`;
}

function venueCard(venue, catalog) {
  const id = escapeHtml(venue.id);
  const selectedAmenityIds = new Set(
    (venue.amenities ?? []).map((amenity) => amenity.id),
  );
  const amenities = (catalog.amenities ?? [])
    .map(
      (amenity) =>
        `<label class="checkbox-label"><input type="checkbox" name="amenityIds" value="${escapeHtml(amenity.id)}"${selectedAmenityIds.has(amenity.id) ? " checked" : ""} /> ${escapeHtml(amenity.name)}</label>`,
    )
    .join("");
  const sports = (catalog.sports ?? [])
    .map(
      (sport) =>
        `<option value="${escapeHtml(sport.id)}">${escapeHtml(sport.name)}</option>`,
    )
    .join("");
  return `<article class="venue-management-card resource-card" data-venue-id="${id}">
    <div class="booking-card__heading"><div><h2>${escapeHtml(venue.name)}</h2><p>${escapeHtml(venue.address)}</p></div><span class="status-pill">${escapeHtml(venueStatusLabels[venue.status] ?? venue.status)}</span></div>
    ${venue.moderationReason ? `<p class="notice"><strong>Phản hồi kiểm duyệt:</strong> ${escapeHtml(venue.moderationReason)}</p>` : ""}
    <div class="resource-card__tools"><details class="resource-subsection"><summary>Chỉnh sửa thông tin địa điểm</summary><form class="form-grid" data-venue-edit>${venueFields(`edit-${id}`, catalog.areas ?? [], venue)}<button type="submit">Lưu thông tin địa điểm</button></form></details>
    <details class="resource-subsection"><summary>Ảnh và tiện ích</summary>
      <form class="form-grid" data-image-form enctype="multipart/form-data"><label for="venue-image-${id}">Ảnh địa điểm</label><input id="venue-image-${id}" name="image" type="file" accept="image/jpeg,image/png,image/webp" required /><label for="venue-alt-${id}">Mô tả ảnh</label><input id="venue-alt-${id}" name="altText" minlength="2" maxlength="300" required /><button type="submit">Tải ảnh</button></form>
      <form class="checkbox-grid" data-amenities-form><fieldset><legend>Tiện ích</legend>${amenities || "<p>Chưa có tiện ích trong catalog.</p>"}</fieldset><button type="submit">Cập nhật tiện ích</button></form>
    </details></div>
    <section class="resource-inventory" aria-labelledby="inventory-${id}"><div class="section-heading"><div><p class="section-kicker">Năng lực phục vụ</p><h3 id="inventory-${id}">Offering và sân vật lý</h3></div></div>${(venue.offerings ?? []).map(offeringCard).join("") || '<p class="empty-state">Chưa có offering.</p>'}
      <details class="resource-add"><summary>Thêm offering mới</summary><form class="form-grid" data-offering-create><label for="new-sport-${id}">Môn thể thao</label><select id="new-sport-${id}" name="sportId" required>${sports}</select><label for="new-mode-${id}">Chế độ xác nhận</label><select id="new-mode-${id}" name="confirmationMode"><option value="INSTANT">Xác nhận ngay</option><option value="OWNER_APPROVAL">Chủ sân duyệt</option></select><label for="new-advance-${id}">Số ngày đặt trước</label><input id="new-advance-${id}" name="advanceBookingDays" type="number" value="14" min="1" max="365" required /><label for="new-cancel-${id}">Báo trước khi hủy (phút)</label><input id="new-cancel-${id}" name="cancellationNoticeMinutes" type="number" value="120" min="0" max="10080" required /><button type="submit">Thêm offering</button></form></details>
    </section>
    <div class="danger-zone"><div><strong>Lưu trữ địa điểm</strong><p>Địa điểm sẽ không còn xuất hiện trong khu vực vận hành.</p></div><button type="button" class="danger" data-action="archive-venue">Lưu trữ địa điểm</button></div>
  </article>`;
}

export function renderOwnerVenuesPage({
  venues = [],
  catalog = { areas: [], sports: [], amenities: [] },
  message = "",
} = {}) {
  return `<section class="catalog" aria-labelledby="owner-venues-title">
    <header class="workspace-header"><div><p class="eyebrow">Hệ thống tài nguyên</p><h1 id="owner-venues-title">Địa điểm và sân con</h1><p>Quản lý hồ sơ địa điểm, môn thể thao cung cấp và trạng thái từng sân vật lý.</p></div><a class="button secondary" href="/owner">Về tổng quan</a></header>
    <details class="resource-create"><summary>Tạo địa điểm mới</summary><form class="form-grid" data-venue-create>${venueFields("create-venue", catalog.areas ?? [])}<button type="submit">Gửi địa điểm để duyệt</button></form></details>
    <div class="management-list">${venues.map((venue) => venueCard(venue, catalog)).join("") || '<p class="empty-state">Bạn chưa có địa điểm.</p>'}</div>
    <p class="form-status" role="status" aria-live="polite">${escapeHtml(message)}</p>
  </section>`;
}

function venuePayload(form) {
  const values = Object.fromEntries(new FormData(form));
  return {
    areaId: String(values.areaId),
    name: String(values.name),
    address: String(values.address),
    description: String(values.description),
    latitude: Number(values.latitude),
    longitude: Number(values.longitude),
  };
}

function offeringPayload(form, includeActive = false) {
  const values = Object.fromEntries(new FormData(form));
  return {
    ...(values.sportId ? { sportId: String(values.sportId) } : {}),
    confirmationMode: String(values.confirmationMode),
    advanceBookingDays: Number(values.advanceBookingDays),
    cancellationNoticeMinutes: Number(values.cancellationNoticeMinutes),
    ...(includeActive ? { isActive: values.isActive === "on" } : {}),
  };
}

export async function mountOwnerVenuesPage(container) {
  const main = container.querySelector("main");
  let catalog;
  const load = async (message = "") => {
    main.setAttribute("aria-busy", "true");
    try {
      const [nextCatalog, venuePage] = await Promise.all([
        catalog ? Promise.resolve(catalog) : apiRequest("/catalog"),
        apiRequest("/owner/venues?page=1&pageSize=100"),
      ]);
      catalog = nextCatalog;
      main.innerHTML = renderOwnerVenuesPage({
        venues: venuePage.items,
        catalog,
        message,
      });
    } finally {
      main.removeAttribute("aria-busy");
    }
  };
  try {
    await load();
  } catch (error) {
    main.innerHTML = `<section class="page-card"><h1>Địa điểm và sân con</h1><p role="alert">${escapeHtml(error instanceof Error ? error.message : "Không tải được địa điểm")}</p></section>`;
    return;
  }

  main.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof window.HTMLFormElement)) return;
    const venue = form.closest("[data-venue-id]");
    const offering = form.closest("[data-offering-id]");
    if (
      !form.matches(
        "[data-venue-create], [data-venue-edit], [data-image-form], [data-amenities-form], [data-offering-create], [data-offering-edit], [data-court-create], [data-court-edit]",
      )
    )
      return;
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    if (!(button instanceof window.HTMLButtonElement)) return;
    button.disabled = true;
    try {
      if (form.matches("[data-venue-create]")) {
        await apiRequest("/owner/venues", {
          method: "POST",
          body: JSON.stringify(venuePayload(form)),
        });
      } else if (form.matches("[data-venue-edit]")) {
        if (!(venue instanceof window.HTMLElement)) return;
        await apiRequest(`/owner/venues/${venue.dataset.venueId}`, {
          method: "PATCH",
          body: JSON.stringify(venuePayload(form)),
        });
      } else if (form.matches("[data-image-form]")) {
        if (!(venue instanceof window.HTMLElement)) return;
        await apiRequest(`/owner/venues/${venue.dataset.venueId}/images`, {
          method: "POST",
          body: new FormData(form),
        });
      } else if (form.matches("[data-amenities-form]")) {
        const amenityIds = [
          ...form.querySelectorAll('[name="amenityIds"]:checked'),
        ]
          .filter((input) => input instanceof window.HTMLInputElement)
          .map((input) => input.value);
        if (!(venue instanceof window.HTMLElement)) return;
        await apiRequest(`/owner/venues/${venue.dataset.venueId}/amenities`, {
          method: "PUT",
          body: JSON.stringify({ amenityIds }),
        });
      } else if (form.matches("[data-offering-create]")) {
        if (!(venue instanceof window.HTMLElement)) return;
        await apiRequest(`/owner/venues/${venue.dataset.venueId}/offerings`, {
          method: "POST",
          body: JSON.stringify(offeringPayload(form)),
        });
      } else if (form.matches("[data-offering-edit]")) {
        if (!(offering instanceof window.HTMLElement)) return;
        await apiRequest(`/owner/offerings/${offering.dataset.offeringId}`, {
          method: "PATCH",
          body: JSON.stringify(offeringPayload(form, true)),
        });
      } else if (form.matches("[data-court-create]")) {
        if (!(offering instanceof window.HTMLElement)) return;
        const values = Object.fromEntries(new FormData(form));
        await apiRequest(
          `/owner/offerings/${offering.dataset.offeringId}/courts`,
          {
            method: "POST",
            body: JSON.stringify({ internalName: String(values.internalName) }),
          },
        );
      } else if (form.matches("[data-court-edit]")) {
        const court = form.closest("[data-court-id]");
        if (!(court instanceof window.HTMLElement)) return;
        const values = Object.fromEntries(new FormData(form));
        await apiRequest(`/owner/courts/${court.dataset.courtId}`, {
          method: "PATCH",
          body: JSON.stringify({ internalName: String(values.internalName) }),
        });
      }
      await load("Đã lưu thay đổi.");
    } catch (error) {
      button.disabled = false;
      main.querySelector('[role="status"]').textContent =
        error instanceof Error ? error.message : "Không thể lưu thay đổi";
    }
  });

  main.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!(button instanceof window.HTMLButtonElement)) return;
    const venue = button.closest("[data-venue-id]");
    const court = button.closest("[data-court-id]");
    if (
      button.dataset.action === "archive-venue" &&
      !window.confirm("Lưu trữ địa điểm này?")
    )
      return;
    button.disabled = true;
    try {
      if (button.dataset.action === "archive-venue") {
        if (!(venue instanceof window.HTMLElement)) return;
        await apiRequest(`/owner/venues/${venue.dataset.venueId}`, {
          method: "DELETE",
        });
      } else if (button.dataset.action === "toggle-court") {
        if (!(court instanceof window.HTMLElement)) return;
        await apiRequest(`/owner/courts/${court.dataset.courtId}/active`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: button.dataset.active === "true" }),
        });
      }
      await load("Đã cập nhật trạng thái tài nguyên.");
    } catch (error) {
      button.disabled = false;
      main.querySelector('[role="status"]').textContent =
        error instanceof Error
          ? error.message
          : "Không thể cập nhật tài nguyên";
    }
  });
}
