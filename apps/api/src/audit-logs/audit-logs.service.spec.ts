import { AuditLogsService } from "./audit-logs.service";

describe("AuditLogsService", () => {
  it("returns a filtered, paginated audit history with safe actor details", async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: "audit-1",
        action: "USER_LOCKED",
        resourceType: "User",
        resourceId: "11111111-1111-4111-8111-111111111111",
        beforeData: { isLocked: false },
        afterData: { isLocked: true },
        createdAt: new Date("2026-09-11T01:00:00.000Z"),
        actor: {
          id: "22222222-2222-4222-8222-222222222222",
          email: "admin@example.com",
          displayName: "Quản trị viên",
        },
      },
    ]);
    const count = jest.fn().mockResolvedValue(1);
    const prisma = {
      auditLog: { findMany, count },
      $transaction: jest
        .fn()
        .mockResolvedValue(await Promise.all([findMany(), count()])),
    };
    findMany.mockClear();
    count.mockClear();
    const service = new AuditLogsService(prisma as never);

    const result = await service.list({
      action: " USER_LOCKED ",
      resourceType: "User",
      sort: "oldest",
      page: 2,
      pageSize: 10,
    });

    expect(result).toEqual(
      expect.objectContaining({ total: 1, page: 2, pageSize: 10 }),
    );
    expect(result.items[0]?.actor).toEqual({
      id: "22222222-2222-4222-8222-222222222222",
      email: "admin@example.com",
      displayName: "Quản trị viên",
    });
    expect(prisma.$transaction).toHaveBeenCalledWith([
      expect.anything(),
      expect.anything(),
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          action: "USER_LOCKED",
          resourceType: "User",
        }),
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: 10,
        take: 10,
      }),
    );
  });
});
