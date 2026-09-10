import { authApi } from "../services/auth-api.js";

function field(id, label, type, name, autocomplete) {
  return `<label for="${id}">${label}</label><input id="${id}" name="${name}" type="${type}" autocomplete="${autocomplete}" required />`;
}

function page(title, fields, action) {
  return `<section class="page-card auth-card" aria-labelledby="auth-title">
    <h1 id="auth-title">${title}</h1>
    <form class="stack" data-auth-form="${action}">
      ${fields}
      <button type="submit">${title}</button>
      <p class="form-status" role="status" aria-live="polite"></p>
    </form>
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

export function renderLoginPage() {
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
      await authApi[form.dataset.authForm](payload);
      status.textContent = "Thành công. Đang chuyển trang…";
      window.location.assign("/");
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "Có lỗi xảy ra";
    } finally {
      button.disabled = false;
    }
  });
}
