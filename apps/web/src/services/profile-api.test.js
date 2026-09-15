import { beforeEach, describe, expect, it, vi } from "vitest";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

async function signedInSubject() {
  const { authApi } = await import("./auth-api.js");
  const { profileApi } = await import("./profile-api.js");
  fetch.mockResolvedValueOnce(
    jsonResponse({
      accessToken: "profile-access-token",
      user: {
        id: "user-1",
        displayName: "Tên cũ",
        email: "learner@example.com",
        phone: "+84901234567",
        roles: ["CUSTOMER"],
        avatarUrl: "/api/v1/users/user-1/avatar?v=1",
      },
    }),
  );
  await authApi.login({
    email: "learner@example.com",
    password: "StrongPass123!",
  });
  return { authApi, profileApi };
}

describe("profileApi", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("updates the editable profile fields and synchronizes the session user", async () => {
    const { authApi, profileApi } = await signedInSubject();
    fetch.mockResolvedValueOnce(
      jsonResponse({
        id: "user-1",
        displayName: "Nguyễn An",
        email: "learner@example.com",
        phone: "+84909876543",
        roles: ["CUSTOMER"],
        avatarUrl: null,
      }),
    );

    await profileApi.update({
      displayName: "Nguyễn An",
      phone: "0909876543",
    });

    expect(fetch).toHaveBeenLastCalledWith(
      "/api/v1/me",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          displayName: "Nguyễn An",
          phone: "0909876543",
        }),
        headers: expect.objectContaining({
          Authorization: "Bearer profile-access-token",
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(authApi.user().displayName).toBe("Nguyễn An");
  });

  it("uploads avatar bytes as FormData without forcing a content type", async () => {
    const { authApi, profileApi } = await signedInSubject();
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    fetch.mockResolvedValueOnce(
      jsonResponse({ ...authApi.user(), avatarUrl: "/avatar?v=2" }),
    );

    await profileApi.uploadAvatar(file);

    const [, options] = fetch.mock.calls.at(-1);
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get("avatar")).toBe(file);
    expect(options.headers.Authorization).toBe("Bearer profile-access-token");
    expect(options.headers).not.toHaveProperty("Content-Type");
    expect(authApi.user().avatarUrl).toBe("/avatar?v=2");
  });

  it("removes the current avatar from the synchronized session user", async () => {
    const { authApi, profileApi } = await signedInSubject();
    fetch.mockResolvedValueOnce({ ok: true, status: 204 });

    await profileApi.removeAvatar();

    expect(authApi.user().avatarUrl).toBeNull();
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/v1/me/avatar",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("clears all client session state after a password change", async () => {
    const { authApi, profileApi } = await signedInSubject();
    fetch.mockResolvedValueOnce({ ok: true, status: 204 });

    await profileApi.changePassword({
      currentPassword: "StrongPass123!",
      newPassword: "NewStrongPass123!",
    });

    expect(authApi.token()).toBeNull();
    expect(authApi.user()).toBeNull();
  });
});
