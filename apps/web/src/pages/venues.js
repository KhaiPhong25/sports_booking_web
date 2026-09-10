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
