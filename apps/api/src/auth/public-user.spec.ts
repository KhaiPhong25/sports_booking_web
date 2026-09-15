import { toPublicUser } from "./public-user";

describe("public user projection", () => {
  const baseUser = {
    id: "11111111-1111-1111-1111-111111111111",
    email: "learner@example.com",
    phone: "+84901234567",
    displayName: "Nguyễn An",
    passwordHash: "argon-hash",
    isLocked: false,
    securityVersion: 1,
    roles: ["CUSTOMER" as const],
  };

  it("projects avatar metadata into a cache-busted public URL", () => {
    const result = toPublicUser({
      ...baseUser,
      avatarObjectKey:
        "user-avatars/11111111-1111-1111-1111-111111111111/avatar",
      avatarUpdatedAt: new Date("2026-09-15T01:02:03.000Z"),
    });

    expect(result.avatarUrl).toBe(
      "/api/v1/users/11111111-1111-1111-1111-111111111111/avatar?v=1789434123000",
    );
    expect(result).not.toHaveProperty("avatarObjectKey");
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("securityVersion");
  });

  it.each([
    { avatarObjectKey: null, avatarUpdatedAt: null },
    {
      avatarObjectKey: "user-avatars/11111111/avatar",
      avatarUpdatedAt: null,
    },
  ])("returns no avatar URL for incomplete metadata", (avatar) => {
    expect(toPublicUser({ ...baseUser, ...avatar }).avatarUrl).toBeNull();
  });
});
