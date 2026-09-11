import { INestApplication } from "@nestjs/common";
import {
  PrismaClient,
  ReviewStatus,
  RoleName,
  VenueStatus,
} from "@prisma/client";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../src/bootstrap";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Phase 10 admin API with PostgreSQL", () => {
  let app: INestApplication;
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const suffix = randomUUID();
  const password = "StrongAdmin123!";
  const ids = {
    admin: "",
    customer: "",
    owner: "",
    area: "",
    pendingVenue: "",
    approvedVenue: "",
  };
  let adminToken = "";
  let customerToken = "";
  let pendingApplicationId = "";
  let approvedApplicationId = "";

  beforeAll(async () => {
    const [customerRole, ownerRole, adminRole] = await Promise.all([
      prisma.role.upsert({
        where: { name: RoleName.CUSTOMER },
        update: {},
        create: { name: RoleName.CUSTOMER },
      }),
      prisma.role.upsert({
        where: { name: RoleName.OWNER },
        update: {},
        create: { name: RoleName.OWNER },
      }),
      prisma.role.upsert({
        where: { name: RoleName.ADMIN },
        update: {},
        create: { name: RoleName.ADMIN },
      }),
    ]);
    const passwordHash = await hash(password, { type: 2 });
    const [admin, customer, owner, area] = await Promise.all([
      prisma.user.create({
        data: {
          email: `admin-${suffix}@example.com`,
          phone: uniquePhone(1),
          displayName: "Admin Phase 10",
          passwordHash,
          roles: {
            create: [{ roleId: customerRole.id }, { roleId: adminRole.id }],
          },
        },
      }),
      prisma.user.create({
        data: {
          email: `customer-${suffix}@example.com`,
          phone: uniquePhone(2),
          displayName: "Customer Phase 10",
          passwordHash,
          roles: { create: { roleId: customerRole.id } },
        },
      }),
      prisma.user.create({
        data: {
          email: `owner-${suffix}@example.com`,
          phone: uniquePhone(3),
          displayName: "Owner Phase 10",
          passwordHash,
          roles: {
            create: [{ roleId: customerRole.id }, { roleId: ownerRole.id }],
          },
        },
      }),
      prisma.area.create({
        data: {
          code: `ADMIN_${suffix}`,
          name: "Khu vực admin test",
          type: "district",
        },
      }),
    ]);
    Object.assign(ids, {
      admin: admin.id,
      customer: customer.id,
      owner: owner.id,
      area: area.id,
    });
    const [
      pendingApplication,
      approvedApplication,
      pendingVenue,
      approvedVenue,
    ] = await Promise.all([
      prisma.ownerApplication.create({
        data: {
          userId: customer.id,
          businessName: `Pending ${suffix}`,
          experience: "Ba năm vận hành",
        },
      }),
      prisma.ownerApplication.create({
        data: {
          userId: customer.id,
          businessName: `Approved ${suffix}`,
          status: ReviewStatus.APPROVED,
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      }),
      prisma.venue.create({
        data: venueData(owner.id, area.id, `Pending venue ${suffix}`),
      }),
      prisma.venue.create({
        data: {
          ...venueData(owner.id, area.id, `Approved venue ${suffix}`),
          status: VenueStatus.APPROVED,
        },
      }),
    ]);
    pendingApplicationId = pendingApplication.id;
    approvedApplicationId = approvedApplication.id;
    ids.pendingVenue = pendingVenue.id;
    ids.approvedVenue = approvedVenue.id;

    app = await createApp();
    await app.init();
    adminToken = await login(`admin-${suffix}@example.com`);
    customerToken = await login(`customer-${suffix}@example.com`);
  });

  afterAll(async () => {
    if (app) await app.close();
    if (ids.admin) {
      await prisma.auditLog.deleteMany({ where: { actorId: ids.admin } });
      await prisma.ownerApplication.deleteMany({
        where: { id: { in: [pendingApplicationId, approvedApplicationId] } },
      });
      await prisma.venue.deleteMany({
        where: { id: { in: [ids.pendingVenue, ids.approvedVenue] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [ids.admin, ids.customer, ids.owner] } },
      });
      await prisma.area.delete({ where: { id: ids.area } });
    }
    await prisma.$disconnect();
  });

  it("enforces ADMIN role and validates list filters", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get("/api/v1/admin/users?locked=maybe")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .get("/api/v1/admin/venues?status=UNLISTED")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .get("/api/v1/admin/audit-logs?actorId=not-a-uuid")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .get("/api/v1/admin/users?unexpected=true")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);
  });

  it("lists safe user summaries and prevents self-lock", async () => {
    const response = await request(app.getHttpServer())
      .get(
        `/api/v1/admin/users?query=${encodeURIComponent(`customer-${suffix}`)}&role=CUSTOMER&locked=false`,
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.items[0]).toEqual(
      expect.objectContaining({ id: ids.customer, isLocked: false }),
    );
    expect(response.body.items[0].passwordHash).toBeUndefined();
    expect(response.body.items[0].securityVersion).toBeUndefined();
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${ids.admin}/lock`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);
  });

  it("filters owner applications and venues across moderation states", async () => {
    const applications = await request(app.getHttpServer())
      .get("/api/v1/admin/owner-applications?status=APPROVED")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(
      applications.body.items.map((item: { id: string }) => item.id),
    ).toContain(approvedApplicationId);
    expect(
      applications.body.items.map((item: { id: string }) => item.id),
    ).not.toContain(pendingApplicationId);

    const venues = await request(app.getHttpServer())
      .get("/api/v1/admin/venues?status=APPROVED")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(venues.body.items.map((item: { id: string }) => item.id)).toContain(
      ids.approvedVenue,
    );
    expect(
      venues.body.items.map((item: { id: string }) => item.id),
    ).not.toContain(ids.pendingVenue);
  });

  it("lets only one concurrent venue moderation decision commit", async () => {
    const results = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/admin/venues/${ids.pendingVenue}/approve`)
        .set("Authorization", `Bearer ${adminToken}`),
      request(app.getHttpServer())
        .post(`/api/v1/admin/venues/${ids.pendingVenue}/reject`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ reason: "Thông tin địa điểm chưa thể xác minh" }),
    ]);

    expect(results.filter((result) => result.status === 201)).toHaveLength(1);
    expect(
      results.filter((result) => [400, 409].includes(result.status)),
    ).toHaveLength(1);
    expect(
      await prisma.auditLog.count({
        where: { actorId: ids.admin, resourceId: ids.pendingVenue },
      }),
    ).toBe(1);
  });

  it("locks a user atomically and exposes the filtered audit record", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${ids.customer}/lock`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200, { id: ids.customer, isLocked: true });
    await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(401);

    const audit = await request(app.getHttpServer())
      .get(
        `/api/v1/admin/audit-logs?action=USER_LOCKED&actorId=${ids.admin}&resourceId=${ids.customer}`,
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(audit.body.total).toBe(1);
    expect(audit.body.items[0]).toEqual(
      expect.objectContaining({
        action: "USER_LOCKED",
        resourceType: "User",
        resourceId: ids.customer,
        actor: expect.objectContaining({ id: ids.admin }),
      }),
    );
  });

  async function login(email: string) {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(200);
    return response.body.accessToken as string;
  }

  function uniquePhone(offset: number) {
    const numeric = BigInt(`0x${suffix.replaceAll("-", "").slice(0, 12)}`);
    return `+84${((numeric + BigInt(offset)) % 1_000_000_000n)
      .toString()
      .padStart(9, "0")}`;
  }

  function venueData(ownerId: string, areaId: string, name: string) {
    return {
      ownerId,
      areaId,
      name,
      address: "12 Nguyễn Huệ, Quận 1",
      description: "Venue dùng cho integration test admin",
      latitude: 10.7731,
      longitude: 106.7031,
      status: VenueStatus.PENDING_APPROVAL,
    };
  }
});
