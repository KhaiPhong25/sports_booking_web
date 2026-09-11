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
