import { authApi } from "../services/auth-api.js";
import {
  canAccessRoute,
  workspaceHome,
} from "../services/route-access.js";

export function loginReturnPath(
  search = window.location.search,
  roles = [],
) {
  const fallback = workspaceHome(roles) ?? "/";
  const returnTo = new window.URLSearchParams(search).get("returnTo");
  if (!returnTo?.startsWith("/")) return fallback;
  try {
    const origin =
      window.location.origin === "null"
        ? "http://localhost"
        : window.location.origin;
    const target = new window.URL(returnTo, origin);
    return target.origin === origin && canAccessRoute(target.pathname, roles)
      ? `${target.pathname}${target.search}${target.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}

function field(id, label, type, name, autocomplete) {
  return `<label for="${id}">${label}</label><input id="${id}" name="${name}" type="${type}" autocomplete="${autocomplete}" required />`;
}

function page(title, fields, action, notice = "") {
  const login = action === "login";
  return `<section class="auth-layout" aria-labelledby="auth-title">
    <div class="auth-story">
      <a class="auth-brand" href="/">SPORTS <span>CENTER</span></a>
      <div><p class="eyebrow">Urban Performance</p><h2>${login ? "Trở lại đường pitch của bạn." : "Một tài khoản. Mọi cuộc chơi."}</h2><p>Tìm đúng sân, theo dõi booking và nhận cập nhật — tất cả trong một trải nghiệm rõ ràng.</p></div>
      <ul class="auth-benefits"><li>Lịch trống theo thời gian thực</li><li>Giá được xác nhận trước khi đặt</li><li>Thông báo xuyên suốt hành trình</li></ul>
    </div>
    <div class="auth-panel">
      <div class="auth-panel__inner">
        <p class="eyebrow">${login ? "Chào mừng trở lại" : "Bắt đầu ngay"}</p>
        <h1 id="auth-title">${title}</h1>
        <p class="auth-intro">${login ? "Đăng nhập để tiếp tục quản lý các trận đấu của bạn." : "Tạo tài khoản miễn phí để xác nhận booking khi đã chọn được sân."}</p>
        ${notice}
        <form class="stack" data-auth-form="${action}">
          ${fields}
          <button type="submit">${title}</button>
          <p class="form-status" role="status" aria-live="polite"></p>
        </form>
        <p class="auth-switch">${login ? 'Chưa có tài khoản? <a href="/register">Đăng ký ngay</a>' : 'Đã có tài khoản? <a href="/login">Đăng nhập</a>'}</p>
      </div>
    </div>
  </section>`;
}

export function renderRegisterPage() {
  return page(
    "Đăng ký",
    [
      field("register-name", "Họ và tên", "text", "displayName", "name"),
      field("register-email", "Email", "email", "email", "email"),
      field("register-phone", "Số điện thoại", "tel", "phone", "tel"),
      field(
        "register-password",
        "Mật khẩu (ít nhất 12 ký tự)",
        "password",
        "password",
        "new-password",
      ),
    ].join(""),
    "register",
  );
}

export function renderLoginPage(search = window.location.search) {
  const passwordChanged =
    new window.URLSearchParams(search).get("reason") === "password-changed";
  return page(
    "Đăng nhập",
    [
      field("login-email", "Email", "email", "email", "email"),
      field(
        "login-password",
        "Mật khẩu",
        "password",
        "password",
        "current-password",
      ),
    ].join(""),
    "login",
    passwordChanged
      ? '<p class="notice auth-notice" role="status">Mật khẩu đã được thay đổi. Vui lòng đăng nhập lại bằng mật khẩu mới.</p>'
      : "",
  );
}

export function mountAuthPage(container) {
  const form = container.querySelector("[data-auth-form]");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = form.querySelector(".form-status");
    const button = form.querySelector("button");
    button.disabled = true;
    status.textContent = "Đang xử lý…";
    try {
      const payload = Object.fromEntries(new FormData(form));
      const result = await authApi[form.dataset.authForm](payload);
      status.textContent = "Thành công. Đang chuyển trang…";
      window.location.assign(
        form.dataset.authForm === "login"
          ? loginReturnPath(
              window.location.search,
              result?.user?.roles ?? authApi.user()?.roles ?? [],
            )
          : "/",
      );
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "Có lỗi xảy ra";
    } finally {
      button.disabled = false;
    }
  });
}
