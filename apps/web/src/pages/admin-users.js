import { escapeHtml } from "../components/html.js";
import { apiRequest } from "../services/api.js";
import {
  errorMarkup,
  paramsFromForm,
  renderAdminPagination,
  renderStatus,
} from "./admin-ui.js";

const selected = (value, expected) =>
  String(value ?? "") === String(expected) ? " selected" : "";

export function renderAdminUsers(
  page = { items: [], total: 0, page: 1, pageSize: 20 },
  filters = {},
) {
  const rows = page.items.length
    ? page.items
        .map(
          (
            user,
          ) => `<article class="admin-list-card data-row" data-user-id="${escapeHtml(user.id)}">
            <div class="data-row__identity"><span class="data-row__avatar" aria-hidden="true">${escapeHtml(user.displayName.slice(0, 1).toUpperCase())}</span><div><strong>${escapeHtml(user.displayName)}</strong><span>${escapeHtml(user.email)}</span><span>${escapeHtml(user.phone)}</span></div></div>
            <div class="data-row__meta"><span>${escapeHtml(user.roles.join(", "))}</span>${renderStatus(user.isLocked ? "LOCKED" : "ACTIVE")}</div>
            <button type="button" class="${user.isLocked ? "" : "danger"}" data-action="${user.isLocked ? "unlock" : "lock"}">${user.isLocked ? "Mở khóa" : "Khóa tài khoản"}</button>
          </article>`,
        )
        .join("")
    : '<p class="empty-state">Không tìm thấy tài khoản phù hợp.</p>';
  return `<section class="catalog" aria-labelledby="admin-users-title">
    <header class="workspace-header workspace-header--admin"><div><p class="eyebrow">Identity control</p><h1 id="admin-users-title">Tài khoản</h1><p>Tìm kiếm danh tính, kiểm tra vai trò và kiểm soát quyền truy cập hệ thống.</p></div></header>
    <form class="filter-form" data-admin-filter>
      <label for="user-query">Tìm kiếm<input id="user-query" name="query" value="${escapeHtml(filters.query ?? "")}" placeholder="Tên, email hoặc số điện thoại" /></label>
      <label for="user-role">Vai trò<select id="user-role" name="role"><option value="">Tất cả</option><option value="CUSTOMER"${selected(filters.role, "CUSTOMER")}>Customer</option><option value="OWNER"${selected(filters.role, "OWNER")}>Owner</option><option value="ADMIN"${selected(filters.role, "ADMIN")}>Admin</option></select></label>
      <label for="user-locked">Trạng thái<select id="user-locked" name="locked"><option value="">Tất cả</option><option value="false"${selected(filters.locked, "false")}>Đang hoạt động</option><option value="true"${selected(filters.locked, "true")}>Đã khóa</option></select></label>
      <button type="submit">Lọc tài khoản</button>
    </form>
    <div class="admin-list" data-admin-list>${rows}</div>
    ${renderAdminPagination(page)}
    <p class="form-status" role="status" aria-live="polite"></p>
  </section>`;
}

export function mountAdminUsers(container) {
  const main = container.querySelector("main");
  let current = new window.URLSearchParams(window.location.search);
  const load = async () => {
    main.setAttribute("aria-busy", "true");
    try {
      const page = await apiRequest(`/admin/users?${current.toString()}`);
      main.innerHTML = renderAdminUsers(page, Object.fromEntries(current));
    } catch (error) {
      main.innerHTML = errorMarkup("Tài khoản", error);
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
    const card = button.closest("[data-user-id]");
    const action = button.dataset.action;
    if (
      !window.confirm(
        `${action === "lock" ? "Khóa" : "Mở khóa"} tài khoản này?`,
      )
    )
      return;
    button.disabled = true;
    try {
      await apiRequest(`/admin/users/${card.dataset.userId}/${action}`, {
        method: "PATCH",
      });
      await load();
    } catch (error) {
      button.disabled = false;
      main.querySelector('[role="status"]').textContent =
        error instanceof Error
          ? error.message
          : "Không cập nhật được tài khoản";
    }
  });
  void load();
}
