import {
  BookingStatus,
  ConfirmationMode,
  PrismaClient,
  VenueStatus,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { BookingsService } from "../src/bookings/bookings.service";
import { PrismaService } from "../src/database/prisma.service";
import { PricingEngine } from "../src/pricing/pricing-engine";
import { toBusinessDateTime } from "../src/scheduling/business-time";
import { PrismaVenueRepository } from "../src/venues/prisma-venue.repository";
import { VenuesService } from "../src/venues/venues.service";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("concurrency-safe bookings with PostgreSQL", () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const servicePrisma = new PrismaService({ datasourceUrl: databaseUrl });
  const service = new BookingsService(servicePrisma, new PricingEngine());
  const venues = new VenuesService(new PrismaVenueRepository(servicePrisma));
  const suffix = randomUUID();
  const ids = {
    owner: randomUUID(),
    customerOne: randomUUID(),
    customerTwo: randomUUID(),
    customerThree: randomUUID(),
    venue: randomUUID(),
    sport: randomUUID(),
    offering: randomUUID(),
  };
  const now = new Date();
  now.setUTCMinutes(0, 0, 0);
  const startAt = new Date(now);
  startAt.setUTCDate(startAt.getUTCDate() + 3);
  startAt.setUTCHours(3, 0, 0, 0);
  const endAt = new Date(startAt.getTime() + 60 * 60_000);

  beforeAll(async () => {
    await servicePrisma.$connect();
    const area = await prisma.area.upsert({
      where: { code: `BOOKING_${suffix}` },
      update: {},
      create: {
        code: `BOOKING_${suffix}`,
        name: "Booking Test",
        type: "district",
      },
    });
    for (const [id, email] of [
      [ids.owner, `owner-${suffix}@example.com`],
      [ids.customerOne, `customer-1-${suffix}@example.com`],
      [ids.customerTwo, `customer-2-${suffix}@example.com`],
      [ids.customerThree, `customer-3-${suffix}@example.com`],
    ] as const) {
      await prisma.user.create({
        data: {
          id,
          email,
          phone: "+84901234567",
          displayName: email,
          passwordHash: "test-only-hash",
        },
      });
    }
    await prisma.sport.create({
      data: { id: ids.sport, code: `SPORT_${suffix}`, name: "Sport Test" },
    });
    await prisma.venue.create({
      data: {
        id: ids.venue,
        ownerId: ids.owner,
        areaId: area.id,
        name: `Venue ${suffix}`,
        address: "12 Test Street",
        description: "Venue used for booking concurrency tests",
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
        confirmationMode: ConfirmationMode.INSTANT,
        advanceBookingDays: 30,
        cancellationNoticeMinutes: 120,
      },
    });
    await prisma.court.createMany({
      data: [
        { offeringId: ids.offering, internalName: "Court A" },
        { offeringId: ids.offering, internalName: "Court B" },
      ],
    });
    await prisma.operatingHour.create({
      data: {
        venueId: ids.venue,
        weekday: toBusinessDateTime(startAt).weekday,
        startMinute: 0,
        endMinute: 1440,
      },
    });
    await prisma.pricingRule.create({
      data: {
        offeringId: ids.offering,
        weekday: toBusinessDateTime(startAt).weekday,
        startMinute: 0,
        endMinute: 1440,
        pricePerSlot: 50_000,
      },
    });
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { offeringId: ids.offering } });
    await prisma.idempotencyRecord.deleteMany({
      where: {
        actorId: { in: [ids.customerOne, ids.customerTwo, ids.customerThree] },
      },
    });
    await prisma.pricingRule.deleteMany({
      where: { offeringId: ids.offering },
    });
    await prisma.operatingHour.deleteMany({ where: { venueId: ids.venue } });
    await prisma.court.deleteMany({ where: { offeringId: ids.offering } });
    await prisma.venueSportOffering.deleteMany({ where: { id: ids.offering } });
    await prisma.venue.deleteMany({ where: { id: ids.venue } });
    await prisma.sport.deleteMany({ where: { id: ids.sport } });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [ids.owner, ids.customerOne, ids.customerTwo, ids.customerThree],
        },
      },
    });
    await prisma.area.deleteMany({ where: { code: `BOOKING_${suffix}` } });
    await servicePrisma.$disconnect();
    await prisma.$disconnect();
  });

  it("allocates exactly the two physical courts under three simultaneous requests", async () => {
    const results = await Promise.allSettled([
      service.create(
        ids.customerOne,
        `race-${suffix}-1`,
        { offeringId: ids.offering, startAt, endAt },
        now,
      ),
      service.create(
        ids.customerTwo,
        `race-${suffix}-2`,
        { offeringId: ids.offering, startAt, endAt },
        now,
      ),
      service.create(
        ids.customerThree,
        `race-${suffix}-3`,
        { offeringId: ids.offering, startAt, endAt },
        now,
      ),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(2);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    const persisted = await prisma.booking.findMany({
      where: { offeringId: ids.offering, startAt, endAt },
      select: { courtId: true },
    });
    expect(new Set(persisted.map((booking) => booking.courtId)).size).toBe(2);
    expect(
      await service.availability(ids.offering, startAt, endAt, now),
    ).toEqual(expect.objectContaining({ available: false, capacity: 0 }));
  });

  it("rejects reassignment onto an overlapping booking", async () => {
    const bookings = await prisma.booking.findMany({
      where: { offeringId: ids.offering, startAt, endAt },
      orderBy: { courtId: "asc" },
    });
    expect(bookings).toHaveLength(2);
    await expect(
      service.reassignOwner(ids.owner, bookings[0]!.id, bookings[1]!.courtId),
    ).rejects.toMatchObject({ response: { code: "BOOKING_NO_CAPACITY" } });
  });

  it("does not let an owner cancel a booking after it has started", async () => {
    const booking = await prisma.booking.findFirstOrThrow({
      where: { offeringId: ids.offering, startAt, endAt },
    });

    await expect(
      service.cancelOwner(
        ids.owner,
        ids.owner,
        booking.id,
        "Sân không thể phục vụ",
        endAt,
      ),
    ).rejects.toMatchObject({
      response: { code: "BOOKING_CANCELLATION_WINDOW_CLOSED" },
    });
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }))
        .status,
    ).toBe(BookingStatus.CONFIRMED);
  });

  it("uses a database exclusion constraint as the final overlap defense", async () => {
    const existing = await prisma.booking.findFirstOrThrow({
      where: { offeringId: ids.offering, startAt, endAt },
    });

    await expect(
      prisma.booking.create({
        data: {
          customerId: ids.customerThree,
          offeringId: ids.offering,
          courtId: existing.courtId,
          startAt,
          endAt,
          status: BookingStatus.CONFIRMED,
          occupiesCourt: true,
          priceAmount: 100_000,
          cancellationNoticeMinutes: 120,
          confirmationModeSnapshot: ConfirmationMode.INSTANT,
          pricingBreakdown: [],
        },
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.booking.update({
        where: { id: existing.id },
        data: { status: BookingStatus.PENDING, expiresAt: null },
      }),
    ).rejects.toBeDefined();
  });

  it("allows an adjacent half-open interval and replays the same idempotency key", async () => {
    const adjacentEnd = new Date(endAt.getTime() + 60 * 60_000);
    const first = await service.create(
      ids.customerOne,
      `adjacent-${suffix}`,
      { offeringId: ids.offering, startAt: endAt, endAt: adjacentEnd },
      now,
    );
    const replay = await service.create(
      ids.customerOne,
      `adjacent-${suffix}`,
      { offeringId: ids.offering, startAt: endAt, endAt: adjacentEnd },
      now,
    );
    expect(replay.id).toBe(first.id);
    await expect(
      service.create(
        ids.customerOne,
        `adjacent-${suffix}`,
        {
          offeringId: ids.offering,
          startAt: endAt,
          endAt: new Date(adjacentEnd.getTime() + 30 * 60_000),
        },
        now,
      ),
    ).rejects.toMatchObject({
      response: { code: "IDEMPOTENCY_KEY_REUSED" },
    });
  });

  it("keeps the booking price snapshot after the pricing rule changes", async () => {
    const booking = await prisma.booking.findFirstOrThrow({
      where: { offeringId: ids.offering },
    });
    expect(booking.priceAmount).toBe(100_000n);
    await prisma.pricingRule.updateMany({
      where: { offeringId: ids.offering },
      data: { pricePerSlot: 90_000 },
    });
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }))
        .priceAmount,
    ).toBe(100_000n);
  });

  it("expires stale holds safely under reassignment and concurrent availability", async () => {
    await prisma.booking.deleteMany({ where: { offeringId: ids.offering } });
    await prisma.idempotencyRecord.deleteMany({
      where: {
        actorId: { in: [ids.customerOne, ids.customerTwo, ids.customerThree] },
      },
    });
    await prisma.venueSportOffering.update({
      where: { id: ids.offering },
      data: { confirmationMode: ConfirmationMode.OWNER_APPROVAL },
    });
    const pending = await service.create(
      ids.customerOne,
      `pending-${suffix}`,
      { offeringId: ids.offering, startAt, endAt },
      now,
    );
    await prisma.booking.update({
      where: { id: pending.id },
      data: { expiresAt: new Date(now.getTime() - 1) },
    });

    const targetCourt = await prisma.court.findFirstOrThrow({
      where: { offeringId: ids.offering, id: { not: pending.courtId } },
    });
    await expect(
      service.reassignOwner(ids.owner, pending.id, targetCourt.id, now),
    ).rejects.toMatchObject({
      response: { code: "BOOKING_HOLD_EXPIRED" },
    });

    const secondPending = await service.create(
      ids.customerTwo,
      `pending-concurrent-${suffix}`,
      { offeringId: ids.offering, startAt, endAt },
      now,
    );
    await prisma.booking.update({
      where: { id: secondPending.id },
      data: { expiresAt: new Date(now.getTime() - 1) },
    });

    const availabilityResults = await Promise.all([
      service.availability(ids.offering, startAt, endAt, now),
      service.availability(ids.offering, startAt, endAt, now),
    ]);

    expect(availabilityResults[0].capacity).toBe(2);
    expect(availabilityResults[1].capacity).toBe(2);
    expect(
      (
        await prisma.booking.findUniqueOrThrow({
          where: { id: secondPending.id },
        })
      ).status,
    ).toBe(BookingStatus.EXPIRED);
    expect(
      await prisma.bookingStatusHistory.count({
        where: { bookingId: secondPending.id, toStatus: BookingStatus.EXPIRED },
      }),
    ).toBe(1);
    expect(
      await service.availability(ids.offering, startAt, endAt, now),
    ).toEqual(expect.objectContaining({ capacity: 2 }));
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: pending.id } }))
        .status,
    ).toBe(BookingStatus.EXPIRED);
  });

  it("serializes booking creation against court deactivation", async () => {
    await prisma.booking.deleteMany({ where: { offeringId: ids.offering } });
    await prisma.idempotencyRecord.deleteMany({
      where: {
        actorId: { in: [ids.customerOne, ids.customerTwo, ids.customerThree] },
      },
    });
    await prisma.venueSportOffering.update({
      where: { id: ids.offering },
      data: { confirmationMode: ConfirmationMode.INSTANT },
    });
    const courts = await prisma.court.findMany({
      where: { offeringId: ids.offering },
      orderBy: { id: "asc" },
    });
    const target = courts[0]!;
    await prisma.court.updateMany({
      where: { offeringId: ids.offering },
      data: { isActive: false },
    });
    await prisma.court.update({
      where: { id: target.id },
      data: { isActive: true },
    });
    const raceStart = new Date(endAt.getTime() + 60 * 60_000);
    const raceEnd = new Date(raceStart.getTime() + 60 * 60_000);

    const results = await Promise.allSettled([
      service.create(
        ids.customerTwo,
        `disable-race-${suffix}`,
        { offeringId: ids.offering, startAt: raceStart, endAt: raceEnd },
        now,
      ),
      venues.setCourtActive(ids.owner, target.id, false),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const booking = await prisma.booking.findFirst({
      where: { offeringId: ids.offering, startAt: raceStart },
    });
    const court = await prisma.court.findUniqueOrThrow({
      where: { id: target.id },
    });
    expect(booking ? court.isActive : !court.isActive).toBe(true);
  });
});
