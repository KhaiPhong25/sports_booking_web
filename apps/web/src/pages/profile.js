import { escapeHtml } from "../components/html.js";
import { icon } from "../components/icons.js";
import { profileApi } from "../services/profile-api.js";

const supportedAvatarTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxAvatarBytes = 2 * 1024 * 1024;
const roleLabels = Object.freeze({
  CUSTOMER: "Khách hàng",
  OWNER: "Chủ sân",
  ADMIN: "Quản trị viên",
});

export function validateAvatarFile(file) {
  if (!supportedAvatarTypes.has(file.type)) {
    throw new Error("Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.");
  }
  if (file.size > maxAvatarBytes) {
    throw new Error("Ảnh đại diện không được vượt quá 2 MB.");
  }
}

export function validatePasswordForm(newPassword, confirmPassword) {
  if (newPassword.length < 12 || newPassword.length > 128) {
    throw new Error("Mật khẩu mới phải có từ 12 đến 128 ký tự.");
  }
  if (newPassword !== confirmPassword) {
    throw new Error("Xác nhận mật khẩu chưa khớp.");
  }
}

function renderAvatar(user) {
  if (user.avatarUrl) {
    return `<img src="${escapeHtml(user.avatarUrl)}" alt="Ảnh đại diện của ${escapeHtml(user.displayName)}" />`;
  }
  const initial = (user.displayName || user.email || "U")
    .trim()
    .slice(0, 1)
    .toUpperCase();
  return `<span data-avatar-fallback aria-hidden="true">${escapeHtml(initial)}</span>`;
}

function renderRoles(roles) {
  return roles
    .map(
      (role) =>
        `<span class="profile-role-badge">${escapeHtml(roleLabels[role] ?? role)}</span>`,
    )
    .join("");
}

function passwordField(id, name, label, autocomplete) {
  return `<div class="profile-password-field">
    <label for="${id}">${label}</label>
    <div class="profile-password-control">
      <input id="${id}" name="${name}" type="password" autocomplete="${autocomplete}" required />
      <button class="secondary profile-password-toggle" type="button" data-toggle-password="${id}" aria-controls="${id}" aria-pressed="false">Hiện</button>
    </div>
  </div>`;
}

export function renderProfilePage(user = {}) {
  const safeUser = {
    displayName: user.displayName ?? "Tài khoản",
    email: user.email ?? "",
    phone: user.phone ?? "",
    roles: user.roles ?? [],
    avatarUrl: user.avatarUrl ?? null,
  };

  return `<section class="catalog profile-page" aria-labelledby="profile-title">
    <header class="workspace-header profile-page__header">
      <div>
        <p class="eyebrow">Không gian cá nhân</p>
        <h1 id="profile-title">Thông tin cá nhân</h1>
        <p>Giữ thông tin liên hệ chính xác và bảo vệ tài khoản cho mọi trận đấu.</p>
      </div>
      <span class="profile-security-mark">${icon("shield", "profile-security-mark__icon")} Bảo mật chủ động</span>
    </header>

    <div class="profile-layout">
      <aside class="profile-summary-card" aria-labelledby="profile-summary-title">
        <div class="profile-avatar" data-profile-avatar>${renderAvatar(safeUser)}</div>
        <div class="profile-summary-card__identity">
          <p class="section-kicker">Hồ sơ của bạn</p>
          <h2 id="profile-summary-title">${escapeHtml(safeUser.displayName)}</h2>
          <p>${escapeHtml(safeUser.email)}</p>
        </div>
        <div class="profile-role-list" aria-label="Vai trò tài khoản">
          ${renderRoles(safeUser.roles)}
        </div>
        <div class="profile-avatar-actions">
          <label class="button" for="profile-avatar-input">Chọn ảnh mới</label>
          <input class="visually-hidden" id="profile-avatar-input" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" />
          ${safeUser.avatarUrl ? '<button class="secondary" type="button" data-remove-avatar>Xóa ảnh</button>' : ""}
        </div>
        <p class="profile-field-help" id="avatar-help">JPEG, PNG hoặc WebP · tối đa 2 MB.</p>
        <p class="form-status" data-avatar-status role="status" aria-live="polite"></p>
      </aside>

      <div class="profile-content">
        <article class="profile-panel" aria-labelledby="identity-title">
          <div class="profile-panel__heading">
            <div><p class="section-kicker">Thông tin liên hệ</p><h2 id="identity-title">Hồ sơ cơ bản</h2></div>
            <span>01</span>
          </div>
          <form class="profile-form" data-profile-form>
            <label for="profile-display-name">Họ và tên
              <input id="profile-display-name" name="displayName" type="text" minlength="2" maxlength="100" autocomplete="name" value="${escapeHtml(safeUser.displayName)}" required />
            </label>
            <label for="profile-phone">Số điện thoại
              <input id="profile-phone" name="phone" type="tel" autocomplete="tel" value="${escapeHtml(safeUser.phone)}" required />
            </label>
            <label for="profile-email">Email đăng nhập
              <input id="profile-email" name="email" type="email" autocomplete="email" value="${escapeHtml(safeUser.email)}" aria-describedby="profile-email-help" readonly />
            </label>
            <p class="profile-field-help" id="profile-email-help">Email là định danh đăng nhập và chưa thể thay đổi trong phiên bản này.</p>
            <div class="profile-form__footer">
              <p class="form-status" data-profile-status role="status" aria-live="polite"></p>
              <button type="submit">Lưu thay đổi</button>
            </div>
          </form>
        </article>

        <article class="profile-panel profile-panel--security" aria-labelledby="security-title">
          <div class="profile-panel__heading">
            <div><p class="section-kicker">Bảo vệ tài khoản</p><h2 id="security-title">Đổi mật khẩu</h2></div>
            <span>02</span>
          </div>
          <p class="profile-panel__intro">Sau khi đổi mật khẩu, bạn sẽ đăng xuất khỏi tất cả thiết bị để ngăn phiên cũ tiếp tục truy cập.</p>
          <form class="profile-form" data-password-form>
            ${passwordField("profile-current-password", "currentPassword", "Mật khẩu hiện tại", "current-password")}
            ${passwordField("profile-new-password", "newPassword", "Mật khẩu mới", "new-password")}
            ${passwordField("profile-confirm-password", "confirmPassword", "Xác nhận mật khẩu mới", "new-password")}
            <p class="profile-field-help">Sử dụng từ 12 đến 128 ký tự và không dùng lại mật khẩu hiện tại.</p>
            <div class="profile-form__footer">
              <p class="form-status" data-password-status role="status" aria-live="polite"></p>
              <button type="submit">Đổi mật khẩu</button>
            </div>
          </form>
        </article>
      </div>
    </div>
  </section>`;
}

function messageFrom(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

function syncAccountSummary(container, user) {
  const account = container.querySelector(".account-summary");
  if (!account) return;
  const name = user.displayName ?? "Tài khoản";
  const strong = account.querySelector("strong");
  const small = account.querySelector("small");
  account.setAttribute("aria-label", `Mở menu tài khoản của ${name}`);
  if (strong) strong.textContent = name;
  if (small) small.textContent = user.email ?? "";

  const currentAvatar = account.querySelector(".account-avatar");
  if (!currentAvatar) return;
  let nextAvatar;
  if (user.avatarUrl) {
    nextAvatar = document.createElement("img");
    nextAvatar.src = user.avatarUrl;
    nextAvatar.alt = `Ảnh đại diện của ${name}`;
  } else {
    nextAvatar = document.createElement("span");
    nextAvatar.dataset.accountFallback = "";
    nextAvatar.setAttribute("aria-hidden", "true");
    nextAvatar.textContent = (name || user.email || "U")
      .trim()
      .slice(0, 1)
      .toUpperCase();
  }
  nextAvatar.className = "account-avatar";
  currentAvatar.replaceWith(nextAvatar);
}

export async function mountProfilePage(container, dependencies = {}) {
  const main = container.querySelector("main") ?? container;
  const api = dependencies.api ?? profileApi;
  const navigate =
    dependencies.navigate ?? ((path) => window.location.assign(path));
  const createObjectURL =
    dependencies.createObjectURL ??
    ((file) => window.URL.createObjectURL(file));
  const revokeObjectURL =
    dependencies.revokeObjectURL ?? ((url) => window.URL.revokeObjectURL(url));
  let currentUser = null;
  let previewUrl = null;

  function renderAndSync(user) {
    currentUser = user;
    main.innerHTML = renderProfilePage(user);
    syncAccountSummary(container, user);
  }

  main.addEventListener("submit", async (event) => {
    const profileForm = event.target.closest("[data-profile-form]");
    const passwordForm = event.target.closest("[data-password-form]");
    if (!profileForm && !passwordForm) return;
    event.preventDefault();

    if (profileForm) {
      const button = profileForm.querySelector('button[type="submit"]');
      const status = profileForm.querySelector("[data-profile-status]");
      button.disabled = true;
      status.textContent = "Đang lưu thay đổi…";
      const data = new FormData(profileForm);
      try {
        const updated = await api.update({
          displayName: String(data.get("displayName") ?? ""),
          phone: String(data.get("phone") ?? ""),
        });
        renderAndSync(updated);
        main.querySelector("[data-profile-status]").textContent =
          "Thông tin cá nhân đã được cập nhật.";
      } catch (error) {
        button.disabled = false;
        status.textContent = messageFrom(error, "Không thể lưu hồ sơ");
      }
      return;
    }

    const button = passwordForm.querySelector('button[type="submit"]');
    const status = passwordForm.querySelector("[data-password-status]");
    button.disabled = true;
    status.textContent = "Đang cập nhật mật khẩu…";
    const data = new FormData(passwordForm);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");
    try {
      validatePasswordForm(newPassword, confirmPassword);
      await api.changePassword({ currentPassword, newPassword });
      navigate("/login?reason=password-changed");
    } catch (error) {
      button.disabled = false;
      status.textContent = messageFrom(error, "Không thể đổi mật khẩu");
    }
  });

  main.addEventListener("change", async (event) => {
    const input = event.target.closest("#profile-avatar-input");
    if (!input) return;
    const file = input.files?.[0];
    if (!file) return;
    const status = main.querySelector("[data-avatar-status]");
    try {
      validateAvatarFile(file);
      previewUrl = createObjectURL(file);
      const preview = document.createElement("img");
      preview.src = previewUrl;
      preview.alt = `Ảnh đại diện mới của ${currentUser?.displayName ?? "tài khoản"}`;
      main.querySelector("[data-profile-avatar]").replaceChildren(preview);
      status.textContent = "Đang tải ảnh đại diện…";
      const updated = await api.uploadAvatar(file);
      revokeObjectURL(previewUrl);
      previewUrl = null;
      renderAndSync(updated);
      main.querySelector("[data-avatar-status]").textContent =
        "Ảnh đại diện đã được cập nhật.";
    } catch (error) {
      if (previewUrl) {
        revokeObjectURL(previewUrl);
        previewUrl = null;
      }
      if (currentUser) renderAndSync(currentUser);
      main.querySelector("[data-avatar-status]").textContent = messageFrom(
        error,
        "Không thể cập nhật ảnh đại diện",
      );
    }
  });

  main.addEventListener("click", async (event) => {
    const toggle = event.target.closest("[data-toggle-password]");
    if (toggle) {
      const input = main.querySelector(`#${toggle.dataset.togglePassword}`);
      const shouldShow = input.type === "password";
      input.type = shouldShow ? "text" : "password";
      toggle.setAttribute("aria-pressed", String(shouldShow));
      toggle.textContent = shouldShow ? "Ẩn" : "Hiện";
      return;
    }

    const remove = event.target.closest("[data-remove-avatar]");
    if (!remove) return;
    remove.disabled = true;
    const status = main.querySelector("[data-avatar-status]");
    status.textContent = "Đang xóa ảnh đại diện…";
    try {
      const updated = await api.removeAvatar();
      renderAndSync(updated);
      main.querySelector("[data-avatar-status]").textContent =
        "Ảnh đại diện đã được xóa.";
    } catch (error) {
      remove.disabled = false;
      status.textContent = messageFrom(error, "Không thể xóa ảnh đại diện");
    }
  });

  main.setAttribute("aria-busy", "true");
  try {
    renderAndSync(await api.get());
  } catch (error) {
    main.innerHTML = `<section class="page-card"><h1>Thông tin cá nhân</h1><p role="alert">${escapeHtml(messageFrom(error, "Không thể tải hồ sơ"))}</p><a class="button" href="/profile">Thử lại</a></section>`;
  } finally {
    main.removeAttribute("aria-busy");
  }
}
