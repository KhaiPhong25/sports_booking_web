import { escapeHtml } from "../components/html.js";
import { apiRequest } from "../services/api.js";
import {
  errorMarkup,
  paramsFromForm,
  renderAdminPagination,
} from "./admin-ui.js";

function selected(value, expected) {
  return value === expected ? " selected" : "";
}

function json(value) {
  return escapeHtml(JSON.stringify(value ?? null, null, 2));
}

export function renderAdminAuditLogs(
  page = { items: [], total: 0, page: 1, pageSize: 20 },
  filters = {},
) {
  const rows = page.items.length
    ? page.items
        .map(
          (item) =>
            `<article class="audit-card"><div class="booking-card__heading"><div><p class="booking-card__label">${escapeHtml(item.resourceType)}</p><h2>${escapeHtml(item.action)}</h2></div><time datetime="${escapeHtml(item.createdAt)}">${escapeHtml(new Date(item.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }))}</time></div><div class="audit-card__meta"><p><strong>Người thực hiện:</strong> ${escapeHtml(item.actor.displayName)} · ${escapeHtml(item.actor.email)}</p><p><strong>Tài nguyên:</strong> ${escapeHtml(item.resourceType)} · <code>${escapeHtml(item.resourceId)}</code></p></div><details><summary>Dữ liệu trước và sau</summary><div class="audit-data"><div><h3>Trước</h3><pre>${json(item.beforeData)}</pre></div><div><h3>Sau</h3><pre>${json(item.afterData)}</pre></div></div></details></article>`,
        )
        .join("")
    : '<p class="empty-state">Không có bản ghi audit phù hợp.</p>';
  return `<section class="catalog" aria-labelledby="audit-title"><header class="workspace-header workspace-header--admin"><div><p class="eyebrow">System trace</p><h1 id="audit-title">Lịch sử audit</h1><p>Theo dõi ai đã thay đổi tài nguyên nào và dữ liệu biến đổi ra sao.</p></div></header><form class="filter-form" data-admin-filter><label for="audit-action">Hành động<input id="audit-action" name="action" value="${escapeHtml(filters.action ?? "")}" /></label><label for="audit-actor-id">Actor ID<input id="audit-actor-id" name="actorId" value="${escapeHtml(filters.actorId ?? "")}" /></label><label for="audit-resource-type">Loại tài nguyên<input id="audit-resource-type" name="resourceType" value="${escapeHtml(filters.resourceType ?? "")}" /></label><label for="audit-resource-id">Resource ID<input id="audit-resource-id" name="resourceId" value="${escapeHtml(filters.resourceId ?? "")}" /></label><label for="audit-sort">Sắp xếp<select id="audit-sort" name="sort"><option value="newest"${selected(filters.sort ?? "newest", "newest")}>Mới nhất</option><option value="oldest"${selected(filters.sort, "oldest")}>Cũ nhất</option></select></label><button type="submit">Lọc lịch sử</button></form><div class="admin-list audit-timeline">${rows}</div>${renderAdminPagination(page)}<p class="form-status" role="status" aria-live="polite"></p></section>`;
}

export function mountAdminAuditLogs(container) {
  const main = container.querySelector("main");
  let current = new window.URLSearchParams(window.location.search);
  const load = async () => {
    main.setAttribute("aria-busy", "true");
    try {
      const page = await apiRequest(`/admin/audit-logs?${current.toString()}`);
      main.innerHTML = renderAdminAuditLogs(page, Object.fromEntries(current));
    } catch (error) {
      main.innerHTML = errorMarkup("Lịch sử audit", error);
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
  main.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-page]");
    if (!button) return;
    current.set("page", button.dataset.page);
    void load();
  });
  void load();
}
