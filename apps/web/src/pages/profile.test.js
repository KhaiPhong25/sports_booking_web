// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  mountProfilePage,
  renderProfilePage,
  validateAvatarFile,
  validatePasswordForm,
} from "./profile.js";

const profile = {
  id: "user-1",
  displayName: "Nguyễn An",
  email: "an@example.com",
  phone: "+84901234567",
  roles: ["CUSTOMER", "OWNER"],
  avatarUrl: null,
};

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushEvents() {
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

async function mountSubject(overrides = {}) {
  document.body.innerHTML = `<header><button class="account-summary" type="button" aria-label="Mở menu tài khoản của Minh Anh"><span class="account-avatar" data-account-fallback>M</span><span><strong>Minh Anh</strong><small>old@example.com</small></span></button></header><main>${renderProfilePage(profile)}</main>`;
  const api = {
    get: vi.fn().mockResolvedValue(profile),
    update: vi.fn().mockResolvedValue(profile),
    uploadAvatar: vi.fn().mockResolvedValue(profile),
    removeAvatar: vi.fn().mockResolvedValue({ ...profile, avatarUrl: null }),
    changePassword: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const navigate = vi.fn();
  const createObjectURL = vi.fn().mockReturnValue("blob:avatar-preview");
  const revokeObjectURL = vi.fn();
  await mountProfilePage(document.body, {
    api,
    navigate,
    createObjectURL,
    revokeObjectURL,
  });
  return { api, navigate, createObjectURL, revokeObjectURL };
}

describe("profile page", () => {
  it("renders editable identity fields, read-only account data and role labels", () => {
    document.body.innerHTML = renderProfilePage(profile);

    expect(document.querySelector("#profile-display-name")?.value).toBe(
      "Nguyễn An",
    );
    expect(document.querySelector("#profile-phone")?.value).toBe(
      "+84901234567",
    );
    expect(document.querySelector("#profile-email")?.readOnly).toBe(true);
    expect(document.querySelectorAll(".profile-role-badge")).toHaveLength(2);
    expect(document.querySelector(".profile-role-list")?.textContent).toContain(
      "Khách hàng",
    );
    expect(document.querySelector(".profile-role-list")?.textContent).toContain(
      "Chủ sân",
    );
    expect(document.querySelector("[data-avatar-fallback]")?.textContent).toBe(
      "N",
    );
  });

  it("renders an uploaded avatar with descriptive alternative text", () => {
    document.body.innerHTML = renderProfilePage({
      ...profile,
      avatarUrl: "/api/v1/users/user-1/avatar?v=2",
    });

    const image = document.querySelector("[data-profile-avatar] img");
    expect(image?.getAttribute("src")).toBe("/api/v1/users/user-1/avatar?v=2");
    expect(image?.getAttribute("alt")).toBe("Ảnh đại diện của Nguyễn An");
    expect(document.querySelector("[data-remove-avatar]")).not.toBeNull();
  });

  it("rejects non-image and oversized avatar files before upload", () => {
    const text = new window.File(["hello"], "avatar.txt", {
      type: "text/plain",
    });
    const oversized = new window.File(["x"], "avatar.png", {
      type: "image/png",
    });
    Object.defineProperty(oversized, "size", { value: 2 * 1024 * 1024 + 1 });

    expect(() => validateAvatarFile(text)).toThrow(
      "Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.",
    );
    expect(() => validateAvatarFile(oversized)).toThrow(
      "Ảnh đại diện không được vượt quá 2 MB.",
    );
  });

  it("rejects weak and mismatched password confirmation", () => {
    expect(() => validatePasswordForm("short", "short")).toThrow(
      "Mật khẩu mới phải có từ 12 đến 128 ký tự.",
    );
    expect(() =>
      validatePasswordForm("NewStrongPass123!", "DifferentPass123!"),
    ).toThrow("Xác nhận mật khẩu chưa khớp.");
    expect(() =>
      validatePasswordForm("NewStrongPass123!", "NewStrongPass123!"),
    ).not.toThrow();
  });

  it("submits only editable identity fields and updates the header", async () => {
    const updated = {
      ...profile,
      displayName: "Nguyễn Minh An",
      phone: "+84909876543",
    };
    const { api } = await mountSubject({
      update: vi.fn().mockResolvedValue(updated),
    });
    const form = document.querySelector("[data-profile-form]");
    form.elements.displayName.value = "Nguyễn Minh An";
    form.elements.phone.value = "0909876543";

    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await flushEvents();

    expect(api.update).toHaveBeenCalledWith({
      displayName: "Nguyễn Minh An",
      phone: "0909876543",
    });
    expect(document.querySelector(".account-summary strong")?.textContent).toBe(
      "Nguyễn Minh An",
    );
    expect(
      document.querySelector(".account-summary")?.getAttribute("aria-label"),
    ).toBe("Mở menu tài khoản của Nguyễn Minh An");
    expect(document.querySelector("[data-profile-status]")?.textContent).toBe(
      "Thông tin cá nhân đã được cập nhật.",
    );
  });

  it("previews and uploads a valid avatar, then can remove it", async () => {
    const uploaded = {
      ...profile,
      avatarUrl: "/api/v1/users/user-1/avatar?v=2",
    };
    const { api, createObjectURL, revokeObjectURL } = await mountSubject({
      uploadAvatar: vi.fn().mockResolvedValue(uploaded),
    });
    const input = document.querySelector("#profile-avatar-input");
    const file = new window.File(["avatar"], "avatar.png", {
      type: "image/png",
    });
    Object.defineProperty(input, "files", { value: [file] });

    input.dispatchEvent(new window.Event("change", { bubbles: true }));
    await flushEvents();

    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(api.uploadAvatar).toHaveBeenCalledWith(file);
    expect(
      document.querySelector("[data-profile-avatar] img")?.getAttribute("src"),
    ).toBe("/api/v1/users/user-1/avatar?v=2");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:avatar-preview");

    document
      .querySelector("[data-remove-avatar]")
      .dispatchEvent(new window.Event("click", { bubbles: true }));
    await flushEvents();

    expect(api.removeAvatar).toHaveBeenCalledOnce();
    expect(document.querySelector("[data-avatar-fallback]")).not.toBeNull();
  });

  it("does not call the API when password confirmation is mismatched", async () => {
    const { api } = await mountSubject();
    const form = document.querySelector("[data-password-form]");
    form.elements.currentPassword.value = "StrongPass123!";
    form.elements.newPassword.value = "NewStrongPass123!";
    form.elements.confirmPassword.value = "DifferentPass123!";

    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await flushEvents();

    expect(api.changePassword).not.toHaveBeenCalled();
    expect(document.querySelector("[data-password-status]")?.textContent).toBe(
      "Xác nhận mật khẩu chưa khớp.",
    );
  });

  it("sends current and new passwords then returns to login", async () => {
    const { api, navigate } = await mountSubject();
    const form = document.querySelector("[data-password-form]");
    form.elements.currentPassword.value = "StrongPass123!";
    form.elements.newPassword.value = "NewStrongPass123!";
    form.elements.confirmPassword.value = "NewStrongPass123!";

    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await flushEvents();

    expect(api.changePassword).toHaveBeenCalledWith({
      currentPassword: "StrongPass123!",
      newPassword: "NewStrongPass123!",
    });
    expect(navigate).toHaveBeenCalledWith("/login?reason=password-changed");
  });

  it("restores the profile submit button after a request fails", async () => {
    const pending = deferred();
    const { api } = await mountSubject({
      update: vi.fn(() => pending.promise),
    });
    const form = document.querySelector("[data-profile-form]");
    const button = form.querySelector('button[type="submit"]');

    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    expect(button.disabled).toBe(true);
    pending.reject(new Error("Không thể lưu hồ sơ"));
    await flushEvents();

    expect(api.update).toHaveBeenCalledOnce();
    expect(button.disabled).toBe(false);
    expect(document.querySelector("[data-profile-status]")?.textContent).toBe(
      "Không thể lưu hồ sơ",
    );
  });
});
