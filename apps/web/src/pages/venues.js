import { escapeHtml } from "../components/html.js";
import { apiRequest } from "../services/api.js";
import { mountVenueMap } from "../services/map-provider.js";
import {
  isChronologicalInterval,
  mountBookingForms,
  renderBookingWidget,
} from "./bookings.js";

function selected(value, expected) {
  return value === expected ? " selected" : "";
}

function businessFields(iso) {
  if (!iso) return {};
  const shifted = new Date(new Date(iso).getTime() + 7 * 60 * 60_000)
    .toISOString()
    .slice(0, 16);
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

function criteriaFromSearchParams(params) {
  const startAt = params.get("startAt") ?? "";
  const endAt = params.get("endAt") ?? "";
  const start = businessFields(startAt);
  const end = businessFields(endAt);
  return {
    sportId: params.get("sportId") ?? "",
    areaId: params.get("areaId") ?? "",
    startAt,
    endAt,
    date: start.date ?? "",
    startTime: start.time ?? "",
    endTime: end.time ?? "",
  };
}

export function renderVenueSearchForm(
  catalog = { sports: [], areas: [] },
  criteria = {},
) {
  const sports = (catalog.sports ?? [])
    .map(
      (sport) =>
        `<option value="${escapeHtml(sport.id)}"${selected(criteria.sportId, sport.id)}>${escapeHtml(sport.name)}</option>`,
    )
    .join("");
  const areas = (catalog.areas ?? [])
    .map(
      (area) =>
        `<option value="${escapeHtml(area.id)}"${selected(criteria.areaId, area.id)}>${escapeHtml(area.name)}</option>`,
    )
    .join("");
  return `<form class="search-form" data-venue-search>
    <label>Môn thể thao<select name="sportId" required><option value="">Chọn môn</option>${sports}</select></label>
    <label>Khu vực<select name="areaId"><option value="">Tất cả khu vực</option>${areas}</select></label>
    <label>Ngày<input name="date" type="date" value="${escapeHtml(criteria.date ?? "")}" required /></label>
    <label>Bắt đầu<input name="startTime" type="time" step="1800" value="${escapeHtml(criteria.startTime ?? "")}" required /></label>
    <label>Kết thúc<input name="endTime" type="time" step="1800" value="${escapeHtml(criteria.endTime ?? "")}" required /></label>
    <button>Tìm sân còn trống</button>
  </form>`;
}

export function renderPublicVenues(
  venues = [],
  catalog = { sports: [], areas: [] },
  criteria = {},
) {
  const detailQuery = new window.URLSearchParams();
  for (const name of ["sportId", "areaId", "startAt", "endAt"]) {
    if (criteria[name]) detailQuery.set(name, criteria[name]);
  }
  const querySuffix = detailQuery.size ? `?${detailQuery.toString()}` : "";
  const cards = venues.length
    ? venues
        .map(
          (venue) => `<article class="venue-card">
            <h2><a href="/venues/${escapeHtml(venue.id)}${escapeHtml(querySuffix)}">${escapeHtml(venue.name)}</a></h2>
            <p>${escapeHtml(venue.address)}</p>
            <p>${escapeHtml(venue.description)}</p>
            <p><strong>Môn thể thao:</strong> ${escapeHtml(
              (venue.offerings ?? [])
                .map((offering) => offering.sportName)
                .filter(Boolean)
                .join(", ") || "Đang cập nhật",
            )}</p>
            ${criteria.startAt ? '<p class="availability-badge">Còn sân trong khung giờ đã chọn</p>' : ""}
          </article>`,
        )
        .join("")
    : '<p class="empty-state">Hiện chưa có sân đã được duyệt.</p>';
  return `<section class="catalog" aria-labelledby="venues-title"><div class="page-heading"><div><p class="eyebrow">Thành phố Hồ Chí Minh</p><h1 id="venues-title">Tìm sân thể thao</h1></div></div>${renderVenueSearchForm(catalog, criteria)}<div class="venue-grid">${cards}</div><p class="form-status" role="status" aria-live="polite"></p></section>`;
}

export function renderPublicVenueDetail(venue, criteria = {}) {
  const backQuery = new window.URLSearchParams();
  for (const name of ["sportId", "areaId", "startAt", "endAt"]) {
    if (criteria[name]) backQuery.set(name, criteria[name]);
  }
  const backHref = backQuery.size ? `/?${backQuery.toString()}` : "/";
  const images = (venue.images ?? [])
    .map(
      (image) =>
        `<img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.altText)}" loading="lazy" />`,
    )
    .join("");
  const amenities = (venue.amenities ?? [])
    .map((item) => `<li>${escapeHtml(item.name)}</li>`)
    .join("");
  const offerings = (venue.offerings ?? []).filter(
    (item) => !criteria.sportId || item.sportId === criteria.sportId,
  );
  const sports = offerings
    .map(
      (item) =>
        `<li class="offering-card"><h3>${escapeHtml(item.sportName ?? "Môn thể thao")}</h3><p>${item.confirmationMode === "INSTANT" ? "Xác nhận ngay" : "Chờ chủ sân duyệt"}</p>${renderBookingWidget(item.id, criteria)}</li>`,
    )
    .join("");
  return `<article class="page-card venue-detail"><a class="back-link" href="${escapeHtml(backHref)}">← Kết quả tìm kiếm</a><h1>${escapeHtml(venue.name)}</h1><p class="venue-address">${escapeHtml(venue.address)}</p><p>${escapeHtml(venue.description)}</p><div class="image-grid">${images}</div><h2>Tiện ích</h2><ul>${amenities || "<li>Chưa cập nhật</li>"}</ul><h2>Môn thể thao và đặt sân</h2><ul class="offering-list">${sports || "<li>Không có offering phù hợp.</li>"}</ul><h2>Vị trí</h2><div class="venue-map" data-map data-latitude="${escapeHtml(venue.latitude)}" data-longitude="${escapeHtml(venue.longitude)}" role="region" aria-label="Bản đồ vị trí ${escapeHtml(venue.name)}" tabindex="0"><p>Đang tải bản đồ…</p></div></article>`;
}

export function renderOwnerVenueForm(catalog = { areas: [] }) {
  const areas = (catalog.areas ?? [])
    .map(
      (area) =>
        `<option value="${escapeHtml(area.id)}">${escapeHtml(area.name)}</option>`,
    )
    .join("");
  return `<section class="page-card" aria-labelledby="venue-form-title">
    <h1 id="venue-form-title">Tạo địa điểm</h1>
    <form class="stack" data-venue-form>
      <label for="venue-name">Tên địa điểm</label><input id="venue-name" name="name" required />
      <label for="venue-area">Khu vực</label><select id="venue-area" name="areaId" required>${areas}</select>
      <label for="venue-address">Địa chỉ</label><input id="venue-address" name="address" required />
      <label for="venue-description">Mô tả</label><textarea id="venue-description" name="description" required minlength="10"></textarea>
      <label for="venue-latitude">Vĩ độ</label><input id="venue-latitude" name="latitude" type="number" step="0.000001" required />
      <label for="venue-longitude">Kinh độ</label><input id="venue-longitude" name="longitude" type="number" step="0.000001" required />
      <button type="submit">Gửi địa điểm để duyệt</button><p role="status" aria-live="polite"></p>
    </form>
  </section>`;
}

export function renderVenueInventory(venue, catalog = { sports: [] }) {
  const offerings = (venue.offerings ?? [])
    .map(
      (offering) =>
        `<section class="inventory-group" data-offering-id="${escapeHtml(offering.id)}"><h3>Offering ${escapeHtml(offering.sportId)}</h3>${(
          offering.courts ?? []
        )
          .map(
            (court) =>
              `<div class="court-row"><strong>${escapeHtml(court.internalName)}</strong><span>${
                court.isActive ? "Đang hoạt động" : "Bảo trì / tạm ngừng"
              }</span><button type="button" data-court-id="${escapeHtml(court.id)}" data-active="${String(
                !court.isActive,
              )}">${court.isActive ? "Tạm ngừng" : "Mở lại"}</button></div>`,
          )
          .join(
            "",
          )}<form class="inline-form" data-court-form><label>Tên sân con<input name="internalName" required /></label><button>Thêm sân con</button></form></section>`,
    )
    .join("");
  const sportOptions = (catalog.sports ?? [])
    .map(
      (sport) =>
        `<option value="${escapeHtml(sport.id)}">${escapeHtml(sport.name)}</option>`,
    )
    .join("");
  return `<section class="page-card"><h2>Kho sân vật lý</h2>${offerings || '<p class="empty-state">Chưa có loại sân.</p>'}<form class="stack" data-offering-form><label>Môn thể thao<select name="sportId" required>${sportOptions}</select></label><label>Chế độ xác nhận<select name="confirmationMode"><option value="INSTANT">Xác nhận ngay</option><option value="OWNER_APPROVAL">Chủ sân duyệt</option></select></label><label>Số ngày đặt trước<input name="advanceBookingDays" type="number" value="14" min="1" max="365" /></label><label>Thời gian báo trước khi hủy (phút)<input name="cancellationNoticeMinutes" type="number" value="120" min="0" /></label><button>Thêm loại sân</button></form></section>`;
}

export function renderOwnerVenues(
  venues = [],
  catalog = { sports: [], amenities: [] },
) {
  return `<section class="page-card"><h1>Địa điểm của tôi</h1>${
    venues
      .map(
        (venue) =>
          `<article class="venue-card" data-venue-id="${escapeHtml(venue.id)}"><h2>${escapeHtml(venue.name)}</h2><p>Trạng thái: ${escapeHtml(
            venue.status,
          )}</p><form data-image-form enctype="multipart/form-data"><label>Ảnh địa điểm<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required /></label><label>Mô tả ảnh<input name="altText" required /></label><button>Tải ảnh</button></form><form data-amenities-form>${(catalog.amenities ?? []).map((amenity) => `<label><input type="checkbox" name="amenityIds" value="${escapeHtml(amenity.id)}" />${escapeHtml(amenity.name)}</label>`).join("")}<button>Cập nhật tiện ích</button></form>${renderVenueInventory(venue, catalog)}</article>`,
      )
      .join("") || '<p class="empty-state">Bạn chưa có địa điểm.</p>'
  }</section>`;
}

export function renderAdminVenues(venues = []) {
  return `<section class="page-card"><h1>Duyệt địa điểm</h1>${
    venues
      .map(
        (venue) =>
          `<article class="review-card" data-venue-id="${escapeHtml(venue.id)}"><h2>${escapeHtml(
            venue.name,
          )}</h2><p>${escapeHtml(venue.address)}</p><label>Lý do từ chối hoặc ẩn<textarea name="reason"></textarea></label><div class="actions"><button data-action="approve">Duyệt</button><button class="secondary" data-action="reject">Từ chối</button><button class="secondary" data-action="hide">Ẩn</button></div></article>`,
      )
      .join("") || '<p class="empty-state">Không có địa điểm chờ duyệt.</p>'
  }<p role="status" aria-live="polite"></p></section>`;
}

export async function mountPublicVenues(container) {
  const main = container.querySelector("main");
  const initialCriteria = criteriaFromSearchParams(
    new window.URLSearchParams(window.location.search),
  );
  const hasCompleteSearch = Boolean(
    initialCriteria.sportId && initialCriteria.startAt && initialCriteria.endAt,
  );
  main.setAttribute("aria-busy", "true");
  try {
    const [page, catalog] = await Promise.all([
      apiRequest(
        hasCompleteSearch
          ? `/venues?${new window.URLSearchParams(window.location.search).toString()}`
          : "/venues",
      ),
      apiRequest("/catalog"),
    ]);
    main.innerHTML = renderPublicVenues(page.items, catalog, initialCriteria);
  } catch (error) {
    container.querySelector('[role="status"]').textContent =
      error instanceof Error ? error.message : "Không tải được địa điểm";
    return;
  } finally {
    main.removeAttribute("aria-busy");
  }
  main.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-venue-search]");
    if (!form) return;
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    const query = new window.URLSearchParams({
      sportId: String(values.sportId),
      startAt: new Date(
        `${String(values.date)}T${String(values.startTime)}:00+07:00`,
      ).toISOString(),
      endAt: new Date(
        `${String(values.date)}T${String(values.endTime)}:00+07:00`,
      ).toISOString(),
    });
    if (values.areaId) query.set("areaId", String(values.areaId));
    const status = main.querySelector('[role="status"]');
    if (!isChronologicalInterval(query.get("startAt"), query.get("endAt"))) {
      status.textContent = "Giờ kết thúc phải sau giờ bắt đầu.";
      return;
    }
    window.history.replaceState(null, "", `/?${query.toString()}`);
    status.textContent = "Đang kiểm tra lịch trống…";
    try {
      const page = await apiRequest(`/venues?${query.toString()}`);
      const resultMarkup = renderPublicVenues(page.items, undefined, {
        ...values,
        startAt: query.get("startAt"),
        endAt: query.get("endAt"),
      });
      const template = document.createElement("template");
      template.innerHTML = resultMarkup;
      main
        .querySelector(".venue-grid")
        .replaceWith(template.content.querySelector(".venue-grid"));
      status.textContent = `Tìm thấy ${page.total} địa điểm còn sức chứa.`;
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "Không thể tìm sân";
    }
  });
}

export async function mountPublicVenueDetail(container, id) {
  const main = container.querySelector("main");
  try {
    const venue = await apiRequest(`/venues/${id}`);
    const criteria = criteriaFromSearchParams(
      new window.URLSearchParams(window.location.search),
    );
    main.innerHTML = renderPublicVenueDetail(venue, criteria);
    mountBookingForms(main);
    const mapElement = main.querySelector("[data-map]");
    try {
      await mountVenueMap(mapElement, {
        latitude: Number(venue.latitude),
        longitude: Number(venue.longitude),
        label: venue.name,
      });
    } catch {
      mapElement.innerHTML =
        '<p role="status">Không thể tải bản đồ. Bạn vẫn có thể dùng địa chỉ phía trên.</p>';
    }
  } catch (error) {
    main.innerHTML = `<section class="page-card"><p role="alert">${escapeHtml(error instanceof Error ? error.message : "Không tìm thấy địa điểm")}</p></section>`;
  }
}

export async function mountOwnerVenues(container) {
  const main = container.querySelector("main");
  try {
    const [catalog, venues] = await Promise.all([
      apiRequest("/catalog"),
      apiRequest("/owner/venues"),
    ]);
    main.innerHTML = `${renderOwnerVenueForm(catalog)}${renderOwnerVenues(venues.items, catalog)}`;
  } catch (error) {
    main.innerHTML = `<section class="page-card"><p role="alert">${escapeHtml(error instanceof Error ? error.message : "Không tải được dữ liệu")}</p></section>`;
    return;
  }
  main
    .querySelector("[data-venue-form]")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = Object.fromEntries(new FormData(form));
      const status = form.querySelector('[role="status"]');
      try {
        await apiRequest("/owner/venues", {
          method: "POST",
          body: JSON.stringify({
            ...values,
            latitude: Number(values.latitude),
            longitude: Number(values.longitude),
          }),
        });
        status.textContent = "Địa điểm đã được gửi để quản trị viên duyệt.";
        form.reset();
      } catch (error) {
        status.textContent =
          error instanceof Error ? error.message : "Không thể tạo địa điểm";
      }
    });
  main.addEventListener("submit", async (event) => {
    const form = event.target;
    const venueCard = form.closest("[data-venue-id]");
    const offeringGroup = form.closest("[data-offering-id]");
    if (!venueCard) return;
    if (
      !form.matches(
        "[data-image-form], [data-amenities-form], [data-offering-form], [data-court-form]",
      )
    )
      return;
    event.preventDefault();
    if (form.matches("[data-image-form]")) {
      await apiRequest(`/owner/venues/${venueCard.dataset.venueId}/images`, {
        method: "POST",
        body: new FormData(form),
      });
    } else if (form.matches("[data-amenities-form]")) {
      const amenityIds = [
        ...form.querySelectorAll('[name="amenityIds"]:checked'),
      ].map((input) => input.value);
      await apiRequest(`/owner/venues/${venueCard.dataset.venueId}/amenities`, {
        method: "PUT",
        body: JSON.stringify({ amenityIds }),
      });
    } else if (form.matches("[data-offering-form]")) {
      const values = Object.fromEntries(new FormData(form));
      await apiRequest(`/owner/venues/${venueCard.dataset.venueId}/offerings`, {
        method: "POST",
        body: JSON.stringify({
          ...values,
          advanceBookingDays: Number(values.advanceBookingDays),
          cancellationNoticeMinutes: Number(values.cancellationNoticeMinutes),
        }),
      });
    } else if (offeringGroup) {
      const values = Object.fromEntries(new FormData(form));
      await apiRequest(
        `/owner/offerings/${offeringGroup.dataset.offeringId}/courts`,
        { method: "POST", body: JSON.stringify(values) },
      );
    }
  });
  main.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-court-id]");
    if (!button) return;
    await apiRequest(`/owner/courts/${button.dataset.courtId}/active`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: button.dataset.active === "true" }),
    });
  });
}

export async function mountAdminVenues(container) {
  const main = container.querySelector("main");
  try {
    const page = await apiRequest("/admin/venues");
    main.innerHTML = renderAdminVenues(page.items);
  } catch (error) {
    main.innerHTML = `<section class="page-card"><p role="alert">${escapeHtml(error instanceof Error ? error.message : "Không tải được dữ liệu")}</p></section>`;
    return;
  }
  main.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const card = button.closest("[data-venue-id]");
    const reason = card.querySelector('[name="reason"]').value;
    try {
      await apiRequest(
        `/admin/venues/${card.dataset.venueId}/${button.dataset.action}`,
        {
          method: "POST",
          ...(button.dataset.action === "approve"
            ? {}
            : { body: JSON.stringify({ reason }) }),
        },
      );
      card.remove();
    } catch (error) {
      main.querySelector('[role="status"]').textContent =
        error instanceof Error ? error.message : "Không thể duyệt địa điểm";
    }
  });
}
