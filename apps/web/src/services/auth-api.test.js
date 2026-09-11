import { beforeEach, describe, expect, it, vi } from "vitest";

describe("authApi.ensureSession", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("restores an access token from the refresh cookie after navigation", async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        accessToken: "restored-access-token",
        user: { id: "admin-1", roles: ["CUSTOMER", "ADMIN"] },
      }),
    });
    const { authApi } = await import("./auth-api.js");

    await authApi.ensureSession();

    expect(authApi.token()).toBe("restored-access-token");
    expect(authApi.user()).toEqual({
      id: "admin-1",
      roles: ["CUSTOMER", "ADMIN"],
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/auth/refresh",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });
});
