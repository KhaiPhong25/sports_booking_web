import { escapeHtml } from "../components/html.js";
import { apiRequest } from "../services/api.js";
import {
  errorMarkup,
  paramsFromForm,
  renderAdminPagination,
  renderStatus,
} from "./admin-ui.js";

function selected(value, expected) {
  return value === expected ? " selected" : "";
}

export function renderAdminOwnerApplications(
  page = { items: [], total: 0, page: 1, pageSize: 20 },
  filters = {},
) {
  const rows = page.items.length
    ? page.items
        .map((item) => {
          const decisions =
            item.status === "PENDING"
              ? `<label for="reason-${escapeHtml(item.id)}">Lý do từ chối</label><textarea id="reason-${escapeHtml(item.id)}" name="reason" minlength="10"></textarea><div class="actions"><button data-action="approve" type="button">Duyệt hồ sơ</button><button data-action="reject" type="button" class="secondary">Từ chối hồ sơ</button></div>`
              : item.reviewReason
                ? `<p><strong>Lý do:</strong> ${escapeHtml(item.reviewReason)}</p>`
                : "";
          return `<article class="review-card moderation-card" data-application-id="${escapeHtml(item.id)}"><div class="booking-card__heading"><div><p class="booking-card__label">Hồ sơ đối tác</p><h2>${escapeHtml(item.businessName)}</h2></div>${renderStatus(item.status)}</div><p>${escapeHtml(item.experience || "Chưa cung cấp kinh nghiệm")}</p>${decisions}</article>`;
        })
        .join("")
    : '<p class="empty-state">Không có hồ sơ phù hợp.</p>';
  return `<section class="catalog" aria-labelledby="review-title"><header class="workspace-header workspace-header--admin"><div><p class="eyebrow">Partner review</p><h1 id="review-title">Hồ sơ chủ sân</h1><p>Đánh giá năng lực vận hành trước khi cấp quyền quản lý địa điểm.</p></div></header><form class="filter-form" data-admin-filter><label for="application-status">Trạng thái<select id="application-status" name="status"><option value="">Tất cả</option><option value="PENDING"${selected(filters.status, "PENDING")}>Đang chờ</option><option value="APPROVED"${selected(filters.status, "APPROVED")}>Đã duyệt</option><option value="REJECTED"${selected(filters.status, "REJECTED")}>Đã từ chối</option></select></label><button type="submit">Lọc hồ sơ</button></form><div class="moderation-queue" data-admin-list>${rows}</div>${renderAdminPagination(page)}<p class="form-status" role="status" aria-live="polite"></p></section>`;
}

export function renderAdminVenues(
  page = { items: [], total: 0, page: 1, pageSize: 20 },
  filters = {},
) {
  const statuses = [
    ["", "Tất cả"],
    ["PENDING_APPROVAL", "Chờ duyệt"],
    ["APPROVED", "Đã duyệt"],
    ["REJECTED", "Đã từ chối"],
    ["HIDDEN", "Đã ẩn"],
    ["DRAFT", "Bản nháp"],
    ["ARCHIVED", "Đã lưu trữ"],
  ];
  const rows = page.items.length
    ? page.items
        .map((venue) => {
          const actions =
            venue.status === "PENDING_APPROVAL"
              ? '<button data-action="approve" type="button">Duyệt địa điểm</button><button class="secondary" data-action="reject" type="button">Từ chối địa điểm</button>'
              : venue.status === "APPROVED"
                ? '<button class="danger" data-action="hide" type="button">Ẩn địa điểm</button>'
                : "";
          const reasonField = actions
            ? `<label for="venue-reason-${escapeHtml(venue.id)}">Lý do từ chối hoặc ẩn</label><textarea id="venue-reason-${escapeHtml(venue.id)}" name="reason" minlength="10"></textarea>`
            : venue.moderationReason
              ? `<p><strong>Lý do:</strong> ${escapeHtml(venue.moderationReason)}</p>`
              : "";
          return `<article class="review-card moderation-card" data-venue-id="${escapeHtml(venue.id)}"><div class="booking-card__heading"><div><p class="booking-card__label">Địa điểm</p><h2>${escapeHtml(venue.name)}</h2></div>${renderStatus(venue.status)}</div><p>${escapeHtml(venue.address)}</p>${reasonField}${actions ? `<div class="actions">${actions}</div>` : ""}</article>`;
        })
        .join("")
    : '<p class="empty-state">Không có địa điểm phù hợp.</p>';
  const options = statuses
    .map(
      ([value, label]) =>
        `<option value="${value}"${selected(filters.status, value)}>${label}</option>`,
    )
    .join("");
  return `<section class="catalog" aria-labelledby="admin-venues-title"><header class="workspace-header workspace-header--admin"><div><p class="eyebrow">Content review</p><h1 id="admin-venues-title">Địa điểm</h1><p>Kiểm tra thông tin hiển thị trước khi đưa địa điểm đến người chơi.</p></div></header><form class="filter-form" data-admin-filter><label for="venue-status">Trạng thái<select id="venue-status" name="status">${options}</select></label><button type="submit">Lọc địa điểm</button></form><div class="moderation-queue" data-admin-list>${rows}</div>${renderAdminPagination(page)}<p class="form-status" role="status" aria-live="polite"></p></section>`;
}

function mountModeration(container, config) {
  const main = container.querySelector("main");
  let current = new window.URLSearchParams(window.location.search);
  const load = async () => {
    main.setAttribute("aria-busy", "true");
    try {
      const page = await apiRequest(`${config.basePath}?${current.toString()}`);
      main.innerHTML = config.render(page, Object.fromEntries(current));
    } catch (error) {
      main.innerHTML = errorMarkup(config.title, error);
    } finally {
      main.removeAttribute("aria-busy");
    }
  };
  main.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-admin-filter]");
    if (!form) return;
    event.preventDefault();
    current = paramsFromForm(form);
    window.history.replaceState(null, "", `?${current.toString()}`);
    void load();
  });
  main.addEventListener("click", async (event) => {
    const pageButton = event.target.closest("button[data-page]");
    if (pageButton) {
      current.set("page", pageButton.dataset.page);
      void load();
      return;
    }
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const card = button.closest(config.cardSelector);
    const reason = card.querySelector('[name="reason"]')?.value.trim() ?? "";
    if (button.dataset.action !== "approve" && reason.length < 10) {
      main.querySelector('[role="status"]').textContent =
        "Vui lòng nhập lý do có ít nhất 10 ký tự.";
      return;
    }
    if (!window.confirm("Xác nhận quyết định kiểm duyệt này?")) return;
    for (const action of card.querySelectorAll("button[data-action]"))
      action.disabled = true;
    try {
      await apiRequest(
        `${config.basePath}/${card.dataset[config.idKey]}/${button.dataset.action}`,
        {
          method: "POST",
          ...(button.dataset.action === "approve"
            ? {}
            : { body: JSON.stringify({ reason }) }),
        },
      );
      await load();
    } catch (error) {
      for (const action of card.querySelectorAll("button[data-action]"))
        action.disabled = false;
      main.querySelector('[role="status"]').textContent =
        error instanceof Error ? error.message : "Không thể lưu quyết định";
    }
  });
  void load();
}

export function mountAdminOwnerApplications(container) {
  mountModeration(container, {
    basePath: "/admin/owner-applications",
    title: "Hồ sơ chủ sân",
    render: renderAdminOwnerApplications,
    cardSelector: "[data-application-id]",
    idKey: "applicationId",
  });
}

export function mountAdminVenues(container) {
  mountModeration(container, {
    basePath: "/admin/venues",
    title: "Địa điểm",
    render: renderAdminVenues,
    cardSelector: "[data-venue-id]",
    idKey: "venueId",
  });
}
