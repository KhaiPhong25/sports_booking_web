import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { InMemoryIdentityRepository } from "./testing/in-memory-identity.repository";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";

const accessSecret = "access-secret-that-is-long-enough-for-tests";
const refreshSecret = "refresh-secret-that-is-long-enough-for-tests";

function createSubject() {
  const repository = new InMemoryIdentityRepository();
  const passwords = new PasswordService();
  const tokens = new TokenService(accessSecret, refreshSecret);
  return {
    repository,
    passwords,
    service: new AuthService(repository, passwords, tokens),
  };
}

describe("AuthService", () => {
  it("normalizes a Vietnamese phone and never stores the plaintext password", async () => {
    const { repository, service } = createSubject();

    const result = await service.register({
      email: "Learner@Example.com ",
      password: "StrongPass123!",
      phone: "090 123 4567",
      displayName: "Người học",
    });

    const stored = repository.users.get(result.user.id);
    expect(stored?.email).toBe("learner@example.com");
    expect(stored?.phone).toBe("+84901234567");
    expect(stored?.passwordHash).not.toContain("StrongPass123!");
    expect(result.user.roles).toEqual(["CUSTOMER"]);
  });

  it("rejects a duplicate email independent of letter casing", async () => {
    const { service } = createSubject();
    const input = {
      email: "owner@example.com",
      password: "StrongPass123!",
      phone: "0901234567",
      displayName: "Owner",
    };
    await service.register(input);

    await expect(
      service.register({ ...input, email: "OWNER@example.com" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rotates refresh tokens and revokes the entire family on token reuse", async () => {
    const { repository, service } = createSubject();
    const registration = await service.register({
      email: "rotate@example.com",
      password: "StrongPass123!",
      phone: "0901234567",
      displayName: "Rotate",
    });
    await service.logout(registration.refreshToken);
    const first = await service.login(
      { email: "rotate@example.com", password: "StrongPass123!" },
      "vitest-agent",
    );
    const second = await service.refresh(first.refreshToken, "vitest-agent");

    await expect(
      service.refresh(first.refreshToken, "reused"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.refresh(second.refreshToken, "revoked-family"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.activeSessions()).toHaveLength(0);
  });

  it("blocks a user immediately after an administrator locks the account", async () => {
    const { repository, service } = createSubject();
    await service.register({
      email: "locked@example.com",
      password: "StrongPass123!",
      phone: "0901234567",
      displayName: "Locked",
    });
    const session = await service.login(
      { email: "locked@example.com", password: "StrongPass123!" },
      "agent",
    );
    const user = [...repository.users.values()][0];
    if (!user) throw new Error("test user missing");
    await repository.setLocked(user.id, true);

    await expect(
      service.authenticateAccessToken(session.accessToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.login(
        { email: "locked@example.com", password: "StrongPass123!" },
        "agent",
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
