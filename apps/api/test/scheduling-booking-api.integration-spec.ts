import { INestApplication } from "@nestjs/common";
import {
  ConfirmationMode,
  PrismaClient,
  RoleName,
  VenueStatus,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { TokenService } from "../src/auth/token.service";
import { createApp } from "../src/bootstrap";
import { toBusinessDateTime } from "../src/scheduling/business-time";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

describeDatabase("Phase 5-6 API with PostgreSQL", () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const suffix = randomUUID();
  const ids = {
    owner: randomUUID(),
    otherOwner: randomUUID(),
    customer: randomUUID(),
    venue: randomUUID(),
    sport: randomUUID(),
    offering: randomUUID(),
  };
  let app: INestApplication;
  let ownerToken: string;
  let otherOwnerToken: string;
  let customerToken: string;
  let targetCourtId: string;
  let bookingId: string;
  const now = new Date();
  now.setUTCMinutes(0, 0, 0);
  const startAt = new Date(now);
  startAt.setUTCDate(startAt.getUTCDate() + 4);
  startAt.setUTCHours(3, 0, 0, 0);
  const endAt = new Date(startAt.getTime() + 60 * 60_000);

  beforeAll(async () => {
    const [customerRole, ownerRole, area] = await Promise.all([
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
      prisma.area.upsert({
        where: { code: `API_${suffix}` },
        update: {},
        create: { code: `API_${suffix}`, name: "API Test", type: "district" },
      }),
    ]);
    for (const [id, email] of [
      [ids.owner, `owner-${suffix}@example.com`],
      [ids.otherOwner, `other-owner-${suffix}@example.com`],
      [ids.customer, `customer-${suffix}@example.com`],
    ] as const) {
      await prisma.user.create({
        data: {
          id,
          email,
          phone: "+84901234567",
          displayName: email,
          passwordHash: "test-only-hash",
          roles: {
            create: [
              { roleId: customerRole.id },
              ...(id !== ids.customer ? [{ roleId: ownerRole.id }] : []),
            ],
          },
        },
      });
    }
    await prisma.sport.create({
      data: { id: ids.sport, code: `API_SPORT_${suffix}`, name: "API Sport" },
    });
    await prisma.venue.create({
      data: {
        id: ids.venue,
        ownerId: ids.owner,
        areaId: area.id,
        name: `API Venue ${suffix}`,
        address: "12 API Street",
        description: "Venue for schedule and booking API tests",
        latitude: 10.7,
        longitude: 106.7,
        status: VenueStatus.APPROVED,
      },
    });
    await prisma.venueSportOffering.create({
      data: {
        id: ids.offering,
        venueId: ids.venue,
        sportId: ids.sport,
        confirmationMode: ConfirmationMode.OWNER_APPROVAL,
        advanceBookingDays: 30,
        cancellationNoticeMinutes: 120,
      },
    });
    const courts = await Promise.all([
      prisma.court.create({
        data: { offeringId: ids.offering, internalName: "Court A" },
      }),
      prisma.court.create({
        data: { offeringId: ids.offering, internalName: "Court B" },
      }),
    ]);
    targetCourtId = courts[1]!.id;
    const tokenService = new TokenService(
      process.env.JWT_ACCESS_SECRET!,
      process.env.JWT_REFRESH_SECRET!,
    );
    const issue = async (userId: string, roles: Array<"CUSTOMER" | "OWNER">) =>
      (await tokenService.issue({ userId, roles, securityVersion: 1 }))
        .accessToken;
    ownerToken = await issue(ids.owner, ["CUSTOMER", "OWNER"]);
    otherOwnerToken = await issue(ids.otherOwner, ["CUSTOMER", "OWNER"]);
    customerToken = await issue(ids.customer, ["CUSTOMER"]);
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    const notificationIds = (
      await prisma.notification.findMany({
        where: { userId: { in: [ids.owner, ids.customer] } },
        select: { id: true },
      })
    ).map(({ id }) => id);
    await prisma.outboxEvent.deleteMany({
      where: {
        OR: [
          ...(bookingId ? [{ aggregateId: bookingId }] : []),
          { aggregateId: { in: notificationIds } },
        ],
      },
    });
    await prisma.notification.deleteMany({
      where: { userId: { in: [ids.owner, ids.customer] } },
    });
    await prisma.booking.deleteMany({ where: { offeringId: ids.offering } });
    await prisma.idempotencyRecord.deleteMany({
      where: { actorId: ids.customer },
    });
    await prisma.venueClosure.deleteMany({ where: { venueId: ids.venue } });
    await prisma.pricingRule.deleteMany({
      where: { offeringId: ids.offering },
    });
    await prisma.operatingHour.deleteMany({ where: { venueId: ids.venue } });
    await prisma.court.deleteMany({ where: { offeringId: ids.offering } });
    await prisma.venueSportOffering.deleteMany({ where: { id: ids.offering } });
    await prisma.venue.deleteMany({ where: { id: ids.venue } });
    await prisma.sport.deleteMany({ where: { id: ids.sport } });
    await prisma.user.deleteMany({
      where: { id: { in: [ids.owner, ids.otherOwner, ids.customer] } },
    });
    await prisma.area.deleteMany({ where: { code: `API_${suffix}` } });
    await prisma.$disconnect();
  });

  it("runs schedule, quote, booking, ownership and state-transition flows", async () => {
    const weekday = toBusinessDateTime(startAt).weekday;
    await request(app.getHttpServer())
      .put(`/api/v1/owner/venues/${ids.venue}/operating-hours`)
      .set("Authorization", `Bearer ${otherOwnerToken}`)
      .send({ windows: [{ weekday, startMinute: 360, endMinute: 1320 }] })
      .expect(403);
    await request(app.getHttpServer())
      .put(`/api/v1/owner/venues/${ids.venue}/operating-hours`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ windows: [{ weekday, startMinute: 360, endMinute: 1320 }] })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/owner/offerings/${ids.offering}/pricing-rules`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        weekday,
        startMinute: 360,
        endMinute: 1320,
        pricePerSlot: 50_000,
      })
      .expect(201);
    const quote = await request(app.getHttpServer())
      .post(`/api/v1/offerings/${ids.offering}/quotes`)
      .send({ startAt: startAt.toISOString(), endAt: endAt.toISOString() })
      .expect(200);
    expect(quote.body.amount).toBe(100_000);

    const correctSearch = await request(app.getHttpServer())
      .get("/api/v1/venues")
      .query({
        sportId: ids.sport,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      })
      .expect(200);
    expect(
      correctSearch.body.items.some(
        (venue: { id: string }) => venue.id === ids.venue,
      ),
    ).toBe(true);
    const wrongSportSearch = await request(app.getHttpServer())
      .get("/api/v1/venues")
      .query({
        sportId: randomUUID(),
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      })
      .expect(200);
    expect(wrongSportSearch.body.items).toEqual([]);

    await request(app.getHttpServer())
      .post("/api/v1/bookings")
      .set("Idempotency-Key", `anonymous-${suffix}`)
      .send({ offeringId: ids.offering, startAt, endAt })
      .expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("Idempotency-Key", `forged-${suffix}`)
      .send({
        offeringId: ids.offering,
        startAt,
        endAt,
        courtId: targetCourtId,
        price: 1,
      })
      .expect(400);
    const created = await request(app.getHttpServer())
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("Idempotency-Key", `booking-${suffix}`)
      .send({ offeringId: ids.offering, startAt, endAt })
      .expect(201);
    expect(created.body).toEqual(
      expect.objectContaining({ status: "PENDING", priceAmount: 100_000 }),
    );
    expect(created.body.courtId).toBeUndefined();
    expect(created.body.customer).toBeUndefined();
    bookingId = created.body.id as string;
    expect(
      await prisma.notification.count({
        where: {
          userId: { in: [ids.owner, ids.customer] },
          type: { in: ["BOOKING_CREATED", "BOOKING_PENDING"] },
        },
      }),
    ).toBe(2);
    expect(
      await prisma.outboxEvent.count({
        where: { eventType: "NOTIFICATION_EMAIL_REQUESTED" },
      }),
    ).toBeGreaterThanOrEqual(2);
    expect(
      await prisma.outboxEvent.count({
        where: {
          aggregateId: bookingId,
          eventType: "BOOKING_EXPIRATION_REQUESTED",
          availableAt: created.body.expiresAt,
        },
      }),
    ).toBe(1);

    await request(app.getHttpServer())
      .post(`/api/v1/owner/venues/${ids.venue}/closures`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ startAt, endAt, reason: "Bảo trì đột xuất" })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/owner/bookings/${created.body.id as string}/confirm`)
      .set("Authorization", `Bearer ${otherOwnerToken}`)
      .expect(404);
    const reassigned = await request(app.getHttpServer())
      .post(`/api/v1/owner/bookings/${created.body.id as string}/reassign`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ courtId: targetCourtId })
      .expect(200);
    expect(reassigned.body.courtId).toBe(targetCourtId);
    const ownerDetail = await request(app.getHttpServer())
      .get(`/api/v1/owner/bookings/${created.body.id as string}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    expect(ownerDetail.body.courtId).toBe(targetCourtId);
    expect(ownerDetail.body.customer).toEqual({
      displayName: `customer-${suffix}@example.com`,
      email: `customer-${suffix}@example.com`,
      phone: "+84901234567",
    });
    await request(app.getHttpServer())
      .get(`/api/v1/owner/bookings/${created.body.id as string}`)
      .set("Authorization", `Bearer ${otherOwnerToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/owner/bookings/${created.body.id as string}/confirm`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/bookings/${created.body.id as string}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ reason: "Thay đổi kế hoạch" })
      .expect(200);
    const invalid = await request(app.getHttpServer())
      .post(`/api/v1/owner/bookings/${created.body.id as string}/confirm`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(invalid.status).toBe(409);
    expect(invalid.body.code).toBe("BOOKING_INVALID_TRANSITION");
    expect(
      await prisma.bookingStatusHistory.count({
        where: { bookingId: created.body.id },
      }),
    ).toBe(3);
    const cancelledPage = await request(app.getHttpServer())
      .get("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .query({ status: "CANCELLED", sort: "startAtAsc" })
      .expect(200);
    expect(cancelledPage.body.items).toHaveLength(1);
    expect(cancelledPage.body.items[0].id).toBe(created.body.id);
    await request(app.getHttpServer())
      .get("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .query({ status: "NOT_A_STATUS" })
      .expect(400);
  });
});
