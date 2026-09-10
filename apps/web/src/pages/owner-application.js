import { escapeHtml } from "../components/html.js";
import { apiRequest } from "../services/api.js";

export function renderOwnerApplication() {
  return `<section class="page-card" aria-labelledby="owner-application-title">
    <h1 id="owner-application-title">Đăng ký trở thành chủ sân</h1>
    <form class="stack" data-owner-application-form>
      <label for="business-name">Tên đơn vị hoặc sân dự kiến</label>
      <input id="business-name" name="businessName" required maxlength="160" />
      <label for="experience">Kinh nghiệm vận hành</label>
      <textarea id="experience" name="experience" rows="5" maxlength="2000"></textarea>
      <button type="submit">Gửi hồ sơ</button>
      <p role="status" aria-live="polite"></p>
    </form>
  </section>`;
}

export function renderAdminOwnerApplications(applications = []) {
  const rows = applications.length
    ? applications
        .map(
          (
            item,
          ) => `<article class="review-card" data-application-id="${escapeHtml(item.id)}">
            <h2>${escapeHtml(item.businessName)}</h2>
            <p>Trạng thái: <strong>${escapeHtml(item.status)}</strong></p>
            <label for="reason-${escapeHtml(item.id)}">Lý do từ chối</label>
            <textarea id="reason-${escapeHtml(item.id)}" name="reason" minlength="10"></textarea>
            <div class="actions">
              <button data-action="approve" type="button">Duyệt</button>
              <button data-action="reject" type="button" class="secondary">Từ chối</button>
            </div>
          </article>`,
        )
        .join("")
    : '<p class="empty-state">Không có hồ sơ đang chờ.</p>';
  return `<section class="page-card" aria-labelledby="review-title"><h1 id="review-title">Duyệt hồ sơ chủ sân</h1><div data-review-list>${rows}</div><p role="status" aria-live="polite"></p></section>`;
}

export function mountOwnerApplication(container) {
  const form = container.querySelector("[data-owner-application-form]");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = form.querySelector('[role="status"]');
    try {
      await apiRequest("/owner-applications", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      status.textContent = "Hồ sơ đã được gửi và đang chờ duyệt.";
      form.reset();
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "Có lỗi xảy ra";
    }
  });
}

export async function mountAdminOwnerApplications(container) {
  const section = container.querySelector(".page-card");
  try {
    const page = await apiRequest("/admin/owner-applications");
    section.outerHTML = renderAdminOwnerApplications(page.items);
  } catch (error) {
    section.querySelector('[role="status"]').textContent =
      error instanceof Error ? error.message : "Không tải được hồ sơ";
    return;
  }
  container
    .querySelector("[data-review-list]")
    ?.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const card = button.closest("[data-application-id]");
      const reason = card.querySelector('[name="reason"]').value;
      const action = button.dataset.action;
      try {
        await apiRequest(
          `/admin/owner-applications/${card.dataset.applicationId}/${action}`,
          {
            method: "POST",
            ...(action === "reject"
              ? { body: JSON.stringify({ reason }) }
              : {}),
          },
        );
        card.remove();
      } catch (error) {
        container.querySelector('[role="status"]').textContent =
          error instanceof Error ? error.message : "Không thể duyệt hồ sơ";
      }
    });
}
