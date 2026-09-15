import { apiRequest } from "./api.js";
import { authApi } from "./auth-api.js";

export const profileApi = {
  get: async () => authApi.replaceUser(await apiRequest("/me")),
  update: async (payload) =>
    authApi.replaceUser(
      await apiRequest("/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    ),
  uploadAvatar: async (file) => {
    const body = new FormData();
    body.set("avatar", file);
    return authApi.replaceUser(
      await apiRequest("/me/avatar", { method: "POST", body }),
    );
  },
  removeAvatar: async () => {
    await apiRequest("/me/avatar", { method: "DELETE" });
    const user = authApi.user();
    return authApi.replaceUser(user ? { ...user, avatarUrl: null } : null);
  },
  changePassword: async (payload) => {
    await apiRequest("/me/password", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    authApi.clearSession();
  },
};
