import { escapeHtml } from "../components/html.js";
import { apiRequest } from "../services/api.js";

const weekdayNames = Object.freeze([
  "",
  "Thứ hai",
  "Thứ ba",
  "Thứ tư",
  "Thứ năm",
  "Thứ sáu",
  "Thứ bảy",
  "Chủ nhật",
]);
const vnd = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
});

function selected(value, expected) {
  return Number(value) === Number(expected) ? " selected" : "";
}

function weekdayOptions(value = 1) {
  return weekdayNames
    .slice(1)
    .map(
      (name, index) =>
        `<option value="${index + 1}"${selected(value, index + 1)}>${name}</option>`,
    )
    .join("");
}

function minuteLabel(value) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function toBusinessLocal(iso) {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 7 * 60 * 60_000)
    .toISOString()
    .slice(0, 16);
}

function toUtcIso(localValue) {
  return new Date(`${localValue}:00+07:00`).toISOString();
}

function hourRow(window, index, isNew = false, venueId = "") {
  const prefix = `${isNew ? "new" : "hour"}-${venueId}-${index}`;
  const start = window?.startMinute ?? 480;
  const end = window?.endMinute ?? 1320;
  return `<div class="schedule-row" data-hour-row>
    <label class="checkbox-label"><input name="enabled" type="checkbox"${isNew ? "" : " checked"} /> ${isNew ? "Thêm khung giờ này" : "Giữ khung giờ này"}</label>
    <label for="${prefix}-weekday">Ngày</label><select id="${prefix}-weekday" name="weekday">${weekdayOptions(window?.weekday ?? 1)}</select>
    <label for="${prefix}-start">Phút bắt đầu</label><input id="${prefix}-start" name="startMinute" type="number" min="0" max="1410" step="30" value="${start}" required />
    <label for="${prefix}-end">Phút kết thúc</label><input id="${prefix}-end" name="endMinute" type="number" min="30" max="1440" step="30" value="${end}" required />
    <span class="schedule-summary">${isNew ? "Khung giờ mới chưa được thêm" : `${weekdayNames[window.weekday]} ${minuteLabel(start)}–${minuteLabel(end)}`}</span>
  </div>`;
}

function allCourts(venue) {
  return (venue.offerings ?? []).flatMap((offering) =>
    (offering.courts ?? []).map((court) => ({
      ...court,
      sportName: offering.sportName,
    })),
  );
}

function courtOptions(courts, selectedId = "") {
  return `<option value="">Toàn địa điểm</option>${courts
    .map(
      (court) =>
        `<option value="${escapeHtml(court.id)}"${court.id === selectedId ? " selected" : ""}>${escapeHtml(court.sportName ?? "Môn thể thao")} · ${escapeHtml(court.internalName)}</option>`,
    )
    .join("")}`;
}

function closureForm(closure, courts, venueId) {
  const editing = Boolean(closure);
  const id = closure?.id ?? `new-${venueId}`;
  return `<form class="form-grid" ${editing ? "data-closure-edit" : "data-closure-create"} ${editing ? `data-closure-id="${escapeHtml(id)}"` : ""}>
    <label for="closure-start-${escapeHtml(id)}">Bắt đầu</label><input id="closure-start-${escapeHtml(id)}" name="startAt" type="datetime-local" value="${escapeHtml(toBusinessLocal(closure?.startAt))}" required />
    <label for="closure-end-${escapeHtml(id)}">Kết thúc</label><input id="closure-end-${escapeHtml(id)}" name="endAt" type="datetime-local" value="${escapeHtml(toBusinessLocal(closure?.endAt))}" required />
    <label for="closure-court-${escapeHtml(id)}">Phạm vi đóng sân</label><select id="closure-court-${escapeHtml(id)}" name="courtId">${courtOptions(courts, closure?.courtId)}</select>
    <label for="closure-reason-${escapeHtml(id)}">Lý do</label><input id="closure-reason-${escapeHtml(id)}" name="reason" value="${escapeHtml(closure?.reason ?? "")}" minlength="3" maxlength="500" required />
    <div class="actions"><button type="submit">${editing ? "Lưu closure" : "Thêm closure"}</button>${editing ? '<button type="button" class="danger" data-action="delete-closure">Xóa closure</button>' : ""}</div>
  </form>`;
}

function pricingForm(rule, offeringId) {
  const editing = Boolean(rule);
  const id = rule?.id ?? `new-${offeringId}`;
  return `<form class="form-grid" ${editing ? "data-pricing-edit" : "data-pricing-create"} ${editing ? `data-pricing-id="${escapeHtml(id)}"` : ""}>
    <label for="price-weekday-${escapeHtml(id)}">Ngày</label><select id="price-weekday-${escapeHtml(id)}" name="weekday">${weekdayOptions(rule?.weekday ?? 1)}</select>
    <label for="price-start-${escapeHtml(id)}">Phút bắt đầu</label><input id="price-start-${escapeHtml(id)}" name="startMinute" type="number" min="0" max="1410" step="30" value="${rule?.startMinute ?? 480}" required />
    <label for="price-end-${escapeHtml(id)}">Phút kết thúc</label><input id="price-end-${escapeHtml(id)}" name="endMinute" type="number" min="30" max="1440" step="30" value="${rule?.endMinute ?? 1320}" required />
    <label for="price-amount-${escapeHtml(id)}">Giá mỗi 30 phút (VND)</label><input id="price-amount-${escapeHtml(id)}" name="pricePerSlot" type="number" min="1" step="1000" value="${rule?.pricePerSlot ?? ""}" required />
    ${editing ? `<p>${weekdayNames[rule.weekday]} ${minuteLabel(rule.startMinute)}–${minuteLabel(rule.endMinute)} · ${escapeHtml(vnd.format(rule.pricePerSlot))}</p>` : ""}
    <div class="actions"><button type="submit">${editing ? "Lưu quy tắc giá" : "Thêm quy tắc giá"}</button>${editing ? '<button type="button" class="danger" data-action="delete-price">Xóa quy tắc giá</button>' : ""}</div>
  </form>`;
}

function venueSchedule(venue) {
  const id = escapeHtml(venue.id);
  const courts = allCourts(venue);
  return `<article class="venue-management-card resource-card schedule-resource" data-venue-id="${id}">
    <header class="resource-card__header"><div><p class="section-kicker">Cấu hình địa điểm</p><h2>${escapeHtml(venue.name)}</h2></div><span class="status-pill">Đang quản lý</span></header>
    <section class="configuration-panel schedule-panel" aria-labelledby="hours-title-${id}"><div class="configuration-panel__heading"><span>01</span><div><h3 id="hours-title-${id}">Giờ hoạt động hằng tuần</h3><p>Định nghĩa các khung giờ địa điểm sẵn sàng nhận booking.</p></div></div>
      <form class="stack" data-hours-form>${(venue.operatingHours ?? []).map((window, index) => hourRow(window, index, false, venue.id)).join("")}${hourRow(null, (venue.operatingHours ?? []).length, true, venue.id)}<button type="submit">Lưu giờ hoạt động</button></form>
    </section>
    <section class="configuration-panel closure-panel" aria-labelledby="closures-title-${id}"><div class="configuration-panel__heading"><span>02</span><div><h3 id="closures-title-${id}">Đóng sân đặc biệt</h3><p>Chặn toàn địa điểm hoặc một sân con trong khoảng thời gian cụ thể.</p></div></div>
      <div class="management-list">${(venue.closures ?? []).map((closure) => closureForm(closure, courts, venue.id)).join("") || '<p class="empty-state">Chưa có closure.</p>'}</div>
      <details><summary>Thêm closure</summary>${closureForm(null, courts, venue.id)}</details>
    </section>
    <section class="configuration-panel pricing-panel" aria-labelledby="pricing-title-${id}"><div class="configuration-panel__heading"><span>03</span><div><h3 id="pricing-title-${id}">Bảng giá theo offering</h3><p>Thiết lập mức giá mỗi 30 phút theo ngày và khung giờ.</p></div></div>
      ${
        (venue.offerings ?? [])
          .map(
            (offering) =>
              `<article class="inventory-group" data-offering-id="${escapeHtml(offering.id)}"><h4>${escapeHtml(offering.sportName ?? "Môn thể thao")}</h4><div class="management-list">${(offering.pricingRules ?? []).map((rule) => pricingForm(rule, offering.id)).join("") || '<p class="empty-state">Chưa có quy tắc giá.</p>'}</div><details><summary>Thêm quy tắc giá</summary>${pricingForm(null, offering.id)}</details></article>`,
          )
          .join("") ||
        '<p class="empty-state">Hãy tạo offering trước khi cấu hình giá.</p>'
      }
    </section>
  </article>`;
}

export function renderOwnerSchedulePricing(venues = [], message = "") {
  return `<section class="catalog" aria-labelledby="owner-schedule-title"><header class="workspace-header"><div><p class="eyebrow">Quy tắc vận hành</p><h1 id="owner-schedule-title">Lịch hoạt động và bảng giá</h1><p>Xây nhịp mở cửa, thời gian tạm đóng và mức giá cho từng môn thể thao.</p></div><a class="button secondary" href="/owner">Về tổng quan</a></header>${venues.map(venueSchedule).join("") || '<div class="empty-state"><strong>Bạn chưa có địa điểm.</strong><p>Tạo địa điểm trước khi cấu hình lịch và giá.</p><a href="/owner/venues">Quản lý địa điểm</a></div>'}<p class="form-status" role="status" aria-live="polite">${escapeHtml(message)}</p></section>`;
}

async function loadScheduleData() {
  const venuePage = await apiRequest("/owner/venues?page=1&pageSize=100");
  return Promise.all(
    venuePage.items.map(async (venue) => {
      const pricingRequests = (venue.offerings ?? []).map((offering) =>
        apiRequest(`/owner/offerings/${offering.id}/pricing-rules`),
      );
      const [operatingHours, closures, ...pricingRules] = await Promise.all([
        apiRequest(`/owner/venues/${venue.id}/operating-hours`),
        apiRequest(`/owner/venues/${venue.id}/closures`),
        ...pricingRequests,
      ]);
      return {
        ...venue,
        operatingHours,
        closures,
        offerings: (venue.offerings ?? []).map((offering, index) => ({
          ...offering,
          pricingRules: pricingRules[index],
        })),
      };
    }),
  );
}

function pricingPayload(form) {
  const values = Object.fromEntries(new FormData(form));
  return {
    weekday: Number(values.weekday),
    startMinute: Number(values.startMinute),
    endMinute: Number(values.endMinute),
    pricePerSlot: Number(values.pricePerSlot),
  };
}

function closurePayload(form) {
  const values = Object.fromEntries(new FormData(form));
  return {
    startAt: toUtcIso(String(values.startAt)),
    endAt: toUtcIso(String(values.endAt)),
    reason: String(values.reason),
    ...(values.courtId ? { courtId: String(values.courtId) } : {}),
  };
}

export async function mountOwnerSchedulePricing(container) {
  const main = container.querySelector("main");
  const load = async (message = "") => {
    main.setAttribute("aria-busy", "true");
    try {
      main.innerHTML = renderOwnerSchedulePricing(
        await loadScheduleData(),
        message,
      );
    } finally {
      main.removeAttribute("aria-busy");
    }
  };
  try {
    await load();
  } catch (error) {
    main.innerHTML = `<section class="page-card"><h1>Lịch hoạt động và bảng giá</h1><p role="alert">${escapeHtml(error instanceof Error ? error.message : "Không tải được lịch và giá")}</p></section>`;
    return;
  }

  main.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof window.HTMLFormElement)) return;
    const venue = form.closest("[data-venue-id]");
    const offering = form.closest("[data-offering-id]");
    if (
      !form.matches(
        "[data-hours-form], [data-closure-create], [data-closure-edit], [data-pricing-create], [data-pricing-edit]",
      )
    )
      return;
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    if (!(button instanceof window.HTMLButtonElement)) return;
    button.disabled = true;
    try {
      if (form.matches("[data-hours-form]")) {
        const windows = [...form.querySelectorAll("[data-hour-row]")]
          .filter((row) => {
            const enabled = row.querySelector('[name="enabled"]');
            return (
              enabled instanceof window.HTMLInputElement && enabled.checked
            );
          })
          .map((row) => {
            const weekday = row.querySelector('[name="weekday"]');
            const startMinute = row.querySelector('[name="startMinute"]');
            const endMinute = row.querySelector('[name="endMinute"]');
            if (!(
              weekday instanceof window.HTMLSelectElement &&
              startMinute instanceof window.HTMLInputElement &&
              endMinute instanceof window.HTMLInputElement
            )) {
              throw new Error("Khung giờ hoạt động không hợp lệ");
            }
            return {
              weekday: Number(weekday.value),
              startMinute: Number(startMinute.value),
              endMinute: Number(endMinute.value),
            };
          });
        if (!(venue instanceof window.HTMLElement)) return;
        await apiRequest(
          `/owner/venues/${venue.dataset.venueId}/operating-hours`,
          { method: "PUT", body: JSON.stringify({ windows }) },
        );
      } else if (form.matches("[data-closure-create]")) {
        if (!(venue instanceof window.HTMLElement)) return;
        await apiRequest(`/owner/venues/${venue.dataset.venueId}/closures`, {
          method: "POST",
          body: JSON.stringify(closurePayload(form)),
        });
      } else if (form.matches("[data-closure-edit]")) {
        await apiRequest(`/owner/closures/${form.dataset.closureId}`, {
          method: "PATCH",
          body: JSON.stringify(closurePayload(form)),
        });
      } else if (form.matches("[data-pricing-create]")) {
        if (!(offering instanceof window.HTMLElement)) return;
        await apiRequest(
          `/owner/offerings/${offering.dataset.offeringId}/pricing-rules`,
          { method: "POST", body: JSON.stringify(pricingPayload(form)) },
        );
      } else if (form.matches("[data-pricing-edit]")) {
        await apiRequest(`/owner/pricing-rules/${form.dataset.pricingId}`, {
          method: "PATCH",
          body: JSON.stringify(pricingPayload(form)),
        });
      }
      await load("Đã lưu lịch và bảng giá.");
    } catch (error) {
      button.disabled = false;
      main.querySelector('[role="status"]').textContent =
        error instanceof Error ? error.message : "Không thể lưu thay đổi";
    }
  });

  main.addEventListener("click", async (event) => {
    const button = event.target.closest(
      '[data-action="delete-closure"], [data-action="delete-price"]',
    );
    if (
      !(button instanceof window.HTMLButtonElement) ||
      !window.confirm("Xóa cấu hình này?")
    )
      return;
    const form = button.closest("form");
    if (!(form instanceof window.HTMLFormElement)) return;
    button.disabled = true;
    try {
      await apiRequest(
        button.dataset.action === "delete-closure"
          ? `/owner/closures/${form.dataset.closureId}`
          : `/owner/pricing-rules/${form.dataset.pricingId}`,
        { method: "DELETE" },
      );
      await load("Đã xóa cấu hình.");
    } catch (error) {
      button.disabled = false;
      main.querySelector('[role="status"]').textContent =
        error instanceof Error ? error.message : "Không thể xóa cấu hình";
    }
  });
}
