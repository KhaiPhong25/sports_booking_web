import { apiRequest } from "../services/api.js";

export function renderOwnerApplication() {
  return `<section class="catalog application-layout" aria-labelledby="owner-application-title">
    <div class="application-intro"><p class="eyebrow">Dành cho đối tác</p><h1 id="owner-application-title">Đưa sân của bạn đến gần người chơi hơn.</h1><p>Gia nhập mạng lưới địa điểm thể thao được quản lý minh bạch, từ lịch vận hành đến booking.</p>
      <aside class="application-process" aria-labelledby="process-title"><p class="section-kicker">Quy trình</p><h2 id="process-title">Xét duyệt trong ba bước</h2><ol><li><strong>Gửi thông tin</strong><span>Chia sẻ đơn vị và kinh nghiệm vận hành.</span></li><li><strong>Đội ngũ kiểm tra</strong><span>Admin đối chiếu thông tin trước khi cấp quyền.</span></li><li><strong>Bắt đầu thiết lập</strong><span>Tạo địa điểm, sân con, lịch và bảng giá.</span></li></ol></aside>
    </div>
    <div class="application-form-card"><p class="eyebrow">Hồ sơ đối tác</p><h2>Thông tin ban đầu</h2><form class="stack" data-owner-application-form>
        <label for="business-name">Tên đơn vị hoặc sân dự kiến</label>
        <input id="business-name" name="businessName" required maxlength="160" />
        <label for="experience">Kinh nghiệm vận hành</label>
        <textarea id="experience" name="experience" rows="5" maxlength="2000" placeholder="Ví dụ: 4 năm vận hành cụm sân cầu lông tại Quận 7"></textarea>
        <button type="submit">Gửi hồ sơ xét duyệt</button>
        <p role="status" aria-live="polite"></p>
      </form></div>
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
