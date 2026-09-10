import { INestApplication } from "@nestjs/common";
import { PrismaClient, RoleName } from "@prisma/client";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../src/bootstrap";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Phase 2-4 with PostgreSQL", () => {
  let app: INestApplication;
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const suffix = randomUUID();
  const adminEmail = `admin-${suffix}@example.com`;
  const ownerEmail = `owner-${suffix}@example.com`;
  const adminPassword = "StrongAdmin123!";
  let areaId: string;
  let sportId: string;

  beforeAll(async () => {
    const [customerRole, adminRole, area, sport] = await Promise.all([
      prisma.role.upsert({
        where: { name: RoleName.CUSTOMER },
        update: {},
        create: { name: RoleName.CUSTOMER },
      }),
      prisma.role.upsert({
        where: { name: RoleName.ADMIN },
        update: {},
        create: { name: RoleName.ADMIN },
      }),
      prisma.area.upsert({
        where: { code: "E2E_Q1" },
        update: {},
        create: { code: "E2E_Q1", name: "Quận 1 E2E", type: "district" },
      }),
      prisma.sport.upsert({
        where: { code: "E2E_BADMINTON" },
        update: {},
        create: { code: "E2E_BADMINTON", name: "Cầu lông E2E" },
      }),
    ]);
    areaId = area.id;
    sportId = sport.id;
    await prisma.user.create({
      data: {
        email: adminEmail,
        phone: "+84911111111",
        displayName: "Database Admin",
        passwordHash: await hash(adminPassword, { type: 2 }),
        roles: {
          create: [{ roleId: customerRole.id }, { roleId: adminRole.id }],
        },
      },
    });
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("persists owner approval, ownership and public visibility through real repositories", async () => {
    const owner = request.agent(app.getHttpServer());
    const registered = await owner.post("/api/v1/auth/register").send({
      email: ownerEmail,
      password: "StrongOwner123!",
      phone: "0901234567",
      displayName: "Database Owner",
    });
    expect(registered.status).toBe(201);
    const ownerToken = registered.body.accessToken as string;
    const application = await owner
      .post("/api/v1/owner-applications")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessName: `Sân ${suffix}`, experience: "Ba năm vận hành" });
    expect(application.status).toBe(201);

    const adminLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: adminEmail,
        password: adminPassword,
      });
    const adminToken = adminLogin.body.accessToken as string;
    await request(app.getHttpServer())
      .post(
        `/api/v1/admin/owner-applications/${application.body.id as string}/approve`,
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(201);

    const venue = await request(app.getHttpServer())
      .post("/api/v1/owner/venues")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        areaId,
        name: `Sân database ${suffix}`,
        address: "12 Nguyễn Huệ, Quận 1",
        description: "Venue kiểm thử repository thật với PostgreSQL",
        latitude: 10.7731,
        longitude: 106.7031,
      });
    expect(venue.status).toBe(201);
    const offering = await request(app.getHttpServer())
      .post(`/api/v1/owner/venues/${venue.body.id as string}/offerings`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        sportId,
        confirmationMode: "INSTANT",
        advanceBookingDays: 14,
        cancellationNoticeMinutes: 120,
      });
    expect(offering.status).toBe(201);
    await request(app.getHttpServer())
      .post(`/api/v1/owner/offerings/${offering.body.id as string}/courts`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ internalName: "Sân nội bộ 1" })
      .expect(201);

    const beforeApproval = await request(app.getHttpServer()).get(
      "/api/v1/venues",
    );
    expect(
      beforeApproval.body.items.some(
        (item: { id: string }) => item.id === venue.body.id,
      ),
    ).toBe(false);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/venues/${venue.body.id as string}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(201);
    const publicPage = await request(app.getHttpServer()).get("/api/v1/venues");
    const publicVenue = publicPage.body.items.find(
      (item: { id: string }) => item.id === venue.body.id,
    );
    expect(publicVenue).toBeDefined();
    expect(publicVenue.ownerId).toBeUndefined();
    expect(publicVenue.offerings[0].courts).toBeUndefined();
  });
});
