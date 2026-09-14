import { escapeHtml } from "../components/html.js";
import { icon } from "../components/icons.js";
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
        .map((venue, index) => {
          const image = venue.images?.[0];
          const sports =
            (venue.offerings ?? [])
              .map((offering) => offering.sportName)
              .filter(Boolean)
              .join(", ") || "Đang cập nhật";
          const media = image?.url
            ? `<img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.altText ?? venue.name)}" loading="lazy" />`
            : `<div class="venue-card__fallback venue-card__fallback--${(index % 3) + 1}" aria-hidden="true"><span>${icon("venue")}</span></div>`;
          return `<article class="venue-card">
            <div class="venue-card__media">${media}${criteria.startAt ? '<span class="availability-badge">Còn sân trong khung giờ đã chọn</span>' : ""}</div>
            <div class="venue-card__content">
              <p class="venue-card__sport">${escapeHtml(sports)}</p>
              <h2><a href="/venues/${escapeHtml(venue.id)}${escapeHtml(querySuffix)}">${escapeHtml(venue.name)}</a></h2>
              <p class="venue-card__address">${icon("venue", "inline-icon")}${escapeHtml(venue.address)}</p>
              <p>${escapeHtml(venue.description)}</p>
              <a class="venue-card__link" href="/venues/${escapeHtml(venue.id)}${escapeHtml(querySuffix)}">Xem sân và lịch trống ${icon("arrow", "inline-icon")}</a>
            </div>
          </article>`;
        })
        .join("")
    : '<div class="empty-state"><strong>Hiện chưa có sân phù hợp.</strong><p>Thử đổi khu vực hoặc khung giờ để khám phá thêm lựa chọn đã được duyệt.</p></div>';
  const sportChips = (catalog.sports ?? [])
    .slice(0, 4)
    .map((sport) => `<span class="sport-chip">${escapeHtml(sport.name)}</span>`)
    .join("");
  return `<div class="public-discovery">
    <section class="discovery-hero" aria-labelledby="venues-title">
      <img class="discovery-hero__media" src="/assets/sports-hero.png" alt="Các sân thể thao đô thị dưới ánh đèn buổi tối" />
      <div class="discovery-hero__overlay"></div>
      <div class="discovery-hero__content">
        <p class="eyebrow">Chơi đúng nhịp · TP. Hồ Chí Minh</p>
        <h1 id="venues-title">Sân phù hợp.<br />Giờ chơi của bạn.</h1>
        <p>Khám phá địa điểm đã duyệt, kiểm tra lịch trống và đặt sân trong một luồng rõ ràng.</p>
        ${sportChips ? `<div class="sport-chips" aria-label="Môn thể thao phổ biến">${sportChips}</div>` : ""}
      </div>
      <div class="search-dock">${renderVenueSearchForm(catalog, criteria)}</div>
    </section>
    <section class="value-strip" aria-label="Lợi ích của nền tảng">
      <div><strong>01</strong><span><b>Xem lịch trống</b> theo đúng ngày và khung giờ</span></div>
      <div><strong>02</strong><span><b>Địa điểm rõ ràng</b> với tiện ích và bản đồ</span></div>
      <div><strong>03</strong><span><b>Quản lý tập trung</b> booking và thông báo của bạn</span></div>
    </section>
    <section class="catalog venue-results" aria-labelledby="venue-results-title">
      <div class="page-heading"><div><p class="eyebrow">Địa điểm nổi bật</p><h2 id="venue-results-title">Sẵn sàng cho trận tiếp theo</h2></div><p>${venues.length ? `${venues.length} địa điểm phù hợp` : "Mở rộng tiêu chí tìm kiếm"}</p></div>
      <div class="venue-grid">${cards}</div>
      <p class="form-status" role="status" aria-live="polite"></p>
    </section>
  </div>`;
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
  return `<article class="catalog venue-detail">
    <a class="back-link" href="${escapeHtml(backHref)}">← Kết quả tìm kiếm</a>
    <header class="venue-detail__header"><div><p class="eyebrow">Địa điểm thể thao</p><h1>${escapeHtml(venue.name)}</h1><p class="venue-address">${icon("venue", "inline-icon")}${escapeHtml(venue.address)}</p></div><span class="status-pill">Đã được duyệt</span></header>
    <div class="venue-detail__layout">
      <div class="venue-detail__content">
        ${images ? `<div class="image-grid">${images}</div>` : '<div class="venue-gallery-fallback" aria-hidden="true"><span></span><span></span><span></span></div>'}
        <section class="content-section"><p class="section-kicker">Về địa điểm</p><h2>Không gian cho cuộc chơi trọn vẹn</h2><p>${escapeHtml(venue.description)}</p></section>
        <section class="content-section"><p class="section-kicker">Tiện ích</p><h2>Mọi thứ bạn cần tại sân</h2><ul class="amenity-list">${amenities || "<li>Thông tin tiện ích đang được cập nhật</li>"}</ul></section>
        <section class="content-section"><p class="section-kicker">Vị trí</p><h2>Đường đến sân</h2><div class="venue-map" data-map data-latitude="${escapeHtml(venue.latitude)}" data-longitude="${escapeHtml(venue.longitude)}" role="region" aria-label="Bản đồ vị trí ${escapeHtml(venue.name)}" tabindex="0"><p>Đang tải bản đồ…</p></div></section>
      </div>
      <aside class="venue-detail__booking" aria-labelledby="booking-options-title"><p class="eyebrow">Lịch trống</p><h2 id="booking-options-title">Chọn môn và khung giờ</h2><p class="booking-guidance">Bạn có thể xem lịch khi chưa đăng nhập. Đăng nhập chỉ cần thiết ở bước xác nhận đặt sân.</p><ul class="offering-list">${sports || '<li class="empty-state">Không có offering phù hợp.</li>'}</ul></aside>
    </div>
  </article>`;
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
