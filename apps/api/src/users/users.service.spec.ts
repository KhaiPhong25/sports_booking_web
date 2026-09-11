import { BadRequestException } from "@nestjs/common";
import { InMemoryIdentityRepository } from "../auth/testing/in-memory-identity.repository";
import { UsersService } from "./users.service";

describe("UsersService admin controls", () => {
  it("filters users without exposing authentication fields", async () => {
    const repository = new InMemoryIdentityRepository();
    const service = new UsersService(repository);
    const admin = await repository.createUser({
      email: "admin@example.com",
      phone: "+84900000001",
      displayName: "Quản trị viên",
      passwordHash: "secret-admin-hash",
    });
    await repository.addRole(admin.id, "ADMIN");
    const owner = await repository.createUser({
      email: "owner@example.com",
      phone: "+84900000002",
      displayName: "Chủ sân Xanh",
      passwordHash: "secret-owner-hash",
    });
    await repository.addRole(owner.id, "OWNER");

    const result = await service.adminList({
      query: "xanh",
      role: "OWNER",
      locked: false,
      page: 1,
      pageSize: 20,
    });

    expect(result.total).toBe(1);
    expect(result.items).toEqual([
      expect.objectContaining({
        id: owner.id,
        email: "owner@example.com",
        roles: expect.arrayContaining(["OWNER"]),
        isLocked: false,
      }),
    ]);
    expect(result.items[0]).not.toHaveProperty("passwordHash");
    expect(result.items[0]).not.toHaveProperty("securityVersion");
  });

  it("prevents an administrator from locking their own active session", async () => {
    const repository = new InMemoryIdentityRepository();
    const service = new UsersService(repository);
    const admin = await repository.createUser({
      email: "admin@example.com",
      phone: "+84900000001",
      displayName: "Quản trị viên",
      passwordHash: "hash",
    });
    await repository.addRole(admin.id, "ADMIN");

    await expect(
      service.setLocked(admin.id, true, admin.id),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((await repository.findUserById(admin.id))?.isLocked).toBe(false);
  });
});
