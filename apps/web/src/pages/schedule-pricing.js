import { escapeHtml } from "../components/html.js";
import { apiRequest } from "../services/api.js";

const weekdayOptions = [
  "Thứ hai",
  "Thứ ba",
  "Thứ tư",
  "Thứ năm",
  "Thứ sáu",
  "Thứ bảy",
  "Chủ nhật",
]
  .map((name, index) => `<option value="${index + 1}">${name}</option>`)
  .join("");

export function renderOwnerSchedulePricing(venues = []) {
  const content = venues
    .map(
      (
        venue,
      ) => `<article class="venue-card" data-venue-id="${escapeHtml(venue.id)}">
        <h2>${escapeHtml(venue.name)}</h2>
        <section><h3>Giờ hoạt động hằng tuần</h3>
          <form class="form-grid" data-hours-form>
            <label for="hours-weekday-${escapeHtml(venue.id)}">Ngày</label><select id="hours-weekday-${escapeHtml(venue.id)}" name="weekday">${weekdayOptions}</select>
            <label>Phút bắt đầu<input name="startMinute" type="number" min="0" max="1410" step="30" value="360" required /></label>
            <label>Phút kết thúc<input name="endMinute" type="number" min="30" max="1440" step="30" value="1320" required /></label>
            <button>Lưu một khung giờ</button>
          </form>
        </section>
        <section><h3>Đóng sân đặc biệt</h3>
          <form class="form-grid" data-closure-form>
            <label>Bắt đầu<input name="startAt" type="datetime-local" required /></label>
            <label>Kết thúc<input name="endAt" type="datetime-local" required /></label>
            <label>Court ID (để trống nếu đóng toàn venue)<input name="courtId" /></label>
            <label>Lý do<input name="reason" minlength="3" required /></label>
            <button>Thêm thời gian đóng</button>
          </form>
        </section>
        ${(venue.offerings ?? [])
          .map(
            (
              offering,
            ) => `<section data-offering-id="${escapeHtml(offering.id)}"><h3>Giá offering ${escapeHtml(offering.sportId)}</h3>
              <form class="form-grid" data-pricing-form>
                <label>Ngày<select name="weekday">${weekdayOptions}</select></label>
                <label>Phút bắt đầu<input name="startMinute" type="number" min="0" max="1410" step="30" value="360" required /></label>
                <label>Phút kết thúc<input name="endMinute" type="number" min="30" max="1440" step="30" value="1320" required /></label>
                <label>Giá mỗi 30 phút (VND)<input name="pricePerSlot" type="number" min="1" step="1000" required /></label>
                <button>Thêm quy tắc giá</button>
              </form>
            </section>`,
          )
          .join("")}
        <p role="status" aria-live="polite"></p>
      </article>`,
    )
    .join("");
  return `<section class="catalog"><h1>Lịch hoạt động và bảng giá</h1>${content || '<p class="empty-state">Bạn chưa có địa điểm.</p>'}</section>`;
}

function toIso(value) {
  return new Date(value).toISOString();
}

export async function mountOwnerSchedulePricing(container) {
  const main = container.querySelector("main");
  try {
    const page = await apiRequest("/owner/venues");
    main.innerHTML = renderOwnerSchedulePricing(page.items);
  } catch (error) {
    main.innerHTML = `<section class="page-card"><p role="alert">${escapeHtml(error instanceof Error ? error.message : "Không tải được lịch")}</p></section>`;
    return;
  }
  main.addEventListener("submit", async (event) => {
    const form = event.target;
    const venue = form.closest("[data-venue-id]");
    if (!venue) return;
    event.preventDefault();
    const status = venue.querySelector('[role="status"]');
    const values = Object.fromEntries(new FormData(form));
    try {
      if (form.matches("[data-hours-form]")) {
        await apiRequest(
          `/owner/venues/${venue.dataset.venueId}/operating-hours`,
          {
            method: "PUT",
            body: JSON.stringify({
              windows: [
                {
                  weekday: Number(values.weekday),
                  startMinute: Number(values.startMinute),
                  endMinute: Number(values.endMinute),
                },
              ],
            }),
          },
        );
      } else if (form.matches("[data-closure-form]")) {
        await apiRequest(`/owner/venues/${venue.dataset.venueId}/closures`, {
          method: "POST",
          body: JSON.stringify({
            startAt: toIso(values.startAt),
            endAt: toIso(values.endAt),
            reason: values.reason,
            ...(values.courtId ? { courtId: values.courtId } : {}),
          }),
        });
      } else if (form.matches("[data-pricing-form]")) {
        const offering = form.closest("[data-offering-id]");
        await apiRequest(
          `/owner/offerings/${offering.dataset.offeringId}/pricing-rules`,
          {
            method: "POST",
            body: JSON.stringify({
              weekday: Number(values.weekday),
              startMinute: Number(values.startMinute),
              endMinute: Number(values.endMinute),
              pricePerSlot: Number(values.pricePerSlot),
            }),
          },
        );
      }
      status.textContent = "Đã lưu thay đổi.";
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "Không thể lưu thay đổi";
    }
  });
}
