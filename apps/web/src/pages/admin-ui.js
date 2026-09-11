import { escapeHtml } from "../components/html.js";

const statusLabels = {
  PENDING: "Đang chờ",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã từ chối",
  DRAFT: "Bản nháp",
  PENDING_APPROVAL: "Chờ duyệt",
  HIDDEN: "Đã ẩn",
  ARCHIVED: "Đã lưu trữ",
  ACTIVE: "Đang hoạt động",
  LOCKED: "Đã khóa",
};

export function renderStatus(status) {
  const modifier = String(status).toLowerCase().replaceAll("_", "-");
  return `<span class="status-pill status-pill--${escapeHtml(modifier)}">${escapeHtml(statusLabels[status] ?? status)}</span>`;
}

export function renderAdminPagination(page = {}) {
  const current = Number(page.page ?? 1);
  const pageSize = Number(page.pageSize ?? 20);
  const pages = Math.max(1, Math.ceil(Number(page.total ?? 0) / pageSize));
  return `<nav class="pagination" aria-label="Phân trang">
    <button type="button" data-page="${current - 1}"${current <= 1 ? " disabled" : ""}>Trang trước</button>
    <span>Trang ${current}/${pages} · ${Number(page.total ?? 0)} kết quả</span>
    <button type="button" data-page="${current + 1}"${current >= pages ? " disabled" : ""}>Trang sau</button>
  </nav>`;
}

export function paramsFromForm(form, page = 1) {
  const params = new window.URLSearchParams();
  for (const [key, value] of new FormData(form)) {
    if (String(value).trim()) params.set(key, String(value).trim());
  }
  params.set("page", String(page));
  params.set("pageSize", "20");
  return params;
}

export function errorMarkup(title, error) {
  return `<section class="page-card"><h1>${escapeHtml(title)}</h1><p role="alert">${escapeHtml(error instanceof Error ? error.message : "Không tải được dữ liệu")}</p></section>`;
}
