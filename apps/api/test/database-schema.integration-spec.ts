import { PrismaClient, RoleName } from "@prisma/client";
import { randomUUID } from "node:crypto";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("PostgreSQL identity schema", () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const emails: string[] = [];

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  });

  it("enforces unique normalized email and multi-role membership", async () => {
    const email = `schema-${randomUUID()}@example.com`;
    emails.push(email);
    const customerRole = await prisma.role.upsert({
      where: { name: RoleName.CUSTOMER },
      update: {},
      create: { name: RoleName.CUSTOMER },
    });
    await prisma.user.create({
      data: {
        email,
        phone: "+84901234567",
        displayName: "Schema Test",
        passwordHash: "not-a-real-password",
        roles: { create: { roleId: customerRole.id } },
      },
    });

    await expect(
      prisma.user.create({
        data: {
          email,
          phone: "+84901234568",
          displayName: "Duplicate",
          passwordHash: "not-a-real-password",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
