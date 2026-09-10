const apiBase = "/api/v1";
let accessToken = null;

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
  const body =
    response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(body?.message ?? "Không thể kết nối máy chủ");
  if (body?.accessToken) accessToken = body.accessToken;
  return body;
}

export const authApi = {
  register: (payload) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  login: (payload) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  refresh: () => request("/auth/refresh", { method: "POST" }),
  ensureSession: async () => {
    if (accessToken) return accessToken;
    const result = await request("/auth/refresh", { method: "POST" });
    return result.accessToken;
  },
  logout: async () => {
    await request("/auth/logout", { method: "POST" });
    accessToken = null;
  },
  token: () => accessToken,
};
