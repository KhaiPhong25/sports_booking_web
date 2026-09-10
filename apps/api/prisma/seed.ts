import {
  BookingStatus,
  ConfirmationMode,
  PrismaClient,
  ReviewStatus,
  RoleName,
  VenueStatus,
} from "@prisma/client";
import { hash } from "argon2";

const prisma = new PrismaClient();
const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  ownerOne: "00000000-0000-4000-8000-000000000002",
  ownerTwo: "00000000-0000-4000-8000-000000000003",
  customer: "00000000-0000-4000-8000-000000000004",
  districtOne: "10000000-0000-4000-8000-000000000001",
  thuDuc: "10000000-0000-4000-8000-000000000002",
  football: "20000000-0000-4000-8000-000000000001",
  basketball: "20000000-0000-4000-8000-000000000002",
  badminton: "20000000-0000-4000-8000-000000000003",
  venueOne: "30000000-0000-4000-8000-000000000001",
  venueTwo: "30000000-0000-4000-8000-000000000002",
  offeringOne: "40000000-0000-4000-8000-000000000001",
  offeringTwo: "40000000-0000-4000-8000-000000000002",
  courtOne: "50000000-0000-4000-8000-000000000001",
  courtTwo: "50000000-0000-4000-8000-000000000002",
  courtOneB: "50000000-0000-4000-8000-000000000003",
  courtTwoB: "50000000-0000-4000-8000-000000000004",
  booking: "60000000-0000-4000-8000-000000000001",
  pendingBooking: "60000000-0000-4000-8000-000000000002",
  cancelledBooking: "60000000-0000-4000-8000-000000000003",
  completionEvent: "90000000-0000-4000-8000-000000000001",
  expirationEvent: "90000000-0000-4000-8000-000000000002",
};

async function upsertUser(
  id: string,
  email: string,
  displayName: string,
  phone: string,
  passwordHash: string,
) {
  return prisma.user.upsert({
    where: { id },
    update: { email, displayName, phone, passwordHash, isLocked: false },
    create: { id, email, displayName, phone, passwordHash },
  });
}

async function main() {
  const passwordHash = await hash("LocalDemo123!", { type: 2 });
  const roleEntries = await Promise.all(
    Object.values(RoleName).map((name) =>
      prisma.role.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );
  const roleIds = Object.fromEntries(
    roleEntries.map((role) => [role.name, role.id]),
  );

  await Promise.all([
    upsertUser(
      ids.admin,
      "admin@sports.local",
      "Quản trị demo",
      "+84900000001",
      passwordHash,
    ),
    upsertUser(
      ids.ownerOne,
      "owner1@sports.local",
      "Chủ sân Quận 1",
      "+84900000002",
      passwordHash,
    ),
    upsertUser(
      ids.ownerTwo,
      "owner2@sports.local",
      "Chủ sân Thủ Đức",
      "+84900000003",
      passwordHash,
    ),
    upsertUser(
      ids.customer,
      "customer@sports.local",
      "Khách hàng demo",
      "+84900000004",
      passwordHash,
    ),
  ]);
  for (const [userId, roles] of [
    [ids.admin, [RoleName.CUSTOMER, RoleName.ADMIN]],
    [ids.ownerOne, [RoleName.CUSTOMER, RoleName.OWNER]],
    [ids.ownerTwo, [RoleName.CUSTOMER, RoleName.OWNER]],
    [ids.customer, [RoleName.CUSTOMER]],
  ] as const) {
    for (const role of roles) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId, roleId: roleIds[role] as string } },
        update: {},
        create: { userId, roleId: roleIds[role] as string },
      });
    }
  }

  await Promise.all([
    prisma.ownerApplication.upsert({
      where: { id: "70000000-0000-4000-8000-000000000001" },
      update: {},
      create: {
        id: "70000000-0000-4000-8000-000000000001",
        userId: ids.ownerOne,
        businessName: "Sân Xanh Sài Gòn",
        status: ReviewStatus.APPROVED,
        reviewedById: ids.admin,
        reviewedAt: new Date(),
      },
    }),
    prisma.area.upsert({
      where: { code: "Q1" },
      update: { name: "Quận 1", type: "district" },
      create: {
        id: ids.districtOne,
        code: "Q1",
        name: "Quận 1",
        type: "district",
      },
    }),
    prisma.area.upsert({
      where: { code: "THU_DUC" },
      update: { name: "Thành phố Thủ Đức", type: "city" },
      create: {
        id: ids.thuDuc,
        code: "THU_DUC",
        name: "Thành phố Thủ Đức",
        type: "city",
      },
    }),
  ]);
  for (const [id, code, name] of [
    [ids.football, "FOOTBALL", "Bóng đá"],
    [ids.basketball, "BASKETBALL", "Bóng rổ"],
    [ids.badminton, "BADMINTON", "Cầu lông"],
  ] as const) {
    await prisma.sport.upsert({
      where: { code },
      update: { name },
      create: { id, code, name },
    });
  }
  for (const [code, name] of [
    ["PARKING", "Bãi đỗ xe"],
    ["SHOWER", "Phòng tắm"],
    ["WIFI", "Wi-Fi"],
  ] as const) {
    await prisma.amenity.upsert({
      where: { code },
      update: { name },
      create: { code, name },
    });
  }

  await prisma.venue.upsert({
    where: { id: ids.venueOne },
    update: {},
    create: {
      id: ids.venueOne,
      ownerId: ids.ownerOne,
      areaId: ids.districtOne,
      name: "Sân Xanh Trung Tâm",
      address: "12 Nguyễn Huệ, Quận 1",
      description: "Cụm sân demo gần trung tâm thành phố.",
      latitude: 10.7731,
      longitude: 106.7031,
      status: VenueStatus.APPROVED,
    },
  });
  await prisma.venue.upsert({
    where: { id: ids.venueTwo },
    update: {},
    create: {
      id: ids.venueTwo,
      ownerId: ids.ownerTwo,
      areaId: ids.thuDuc,
      name: "Nhà Thi Đấu Thủ Đức",
      address: "45 Võ Văn Ngân, Thủ Đức",
      description: "Sân cầu lông trong nhà.",
      latitude: 10.8506,
      longitude: 106.7719,
      status: VenueStatus.APPROVED,
    },
  });
  await prisma.venueSportOffering.upsert({
    where: { id: ids.offeringOne },
    update: {},
    create: {
      id: ids.offeringOne,
      venueId: ids.venueOne,
      sportId: ids.football,
      confirmationMode: ConfirmationMode.INSTANT,
    },
  });
  await prisma.venueSportOffering.upsert({
    where: { id: ids.offeringTwo },
    update: {},
    create: {
      id: ids.offeringTwo,
      venueId: ids.venueTwo,
      sportId: ids.badminton,
      confirmationMode: ConfirmationMode.OWNER_APPROVAL,
    },
  });
  await Promise.all([
    prisma.court.upsert({
      where: { id: ids.courtOne },
      update: {},
      create: {
        id: ids.courtOne,
        offeringId: ids.offeringOne,
        internalName: "Sân A",
      },
    }),
    prisma.court.upsert({
      where: { id: ids.courtOneB },
      update: { isActive: true },
      create: {
        id: ids.courtOneB,
        offeringId: ids.offeringOne,
        internalName: "Sân B",
      },
    }),
    prisma.court.upsert({
      where: { id: ids.courtTwoB },
      update: { isActive: true },
      create: {
        id: ids.courtTwoB,
        offeringId: ids.offeringTwo,
        internalName: "Sân 2",
      },
    }),
    prisma.court.upsert({
      where: { id: ids.courtTwo },
      update: {},
      create: {
        id: ids.courtTwo,
        offeringId: ids.offeringTwo,
        internalName: "Sân 1",
      },
    }),
  ]);
  for (const venueId of [ids.venueOne, ids.venueTwo]) {
    for (let weekday = 1; weekday <= 7; weekday += 1) {
      const existing = await prisma.operatingHour.findFirst({
        where: { venueId, weekday },
      });
      if (!existing)
        await prisma.operatingHour.create({
          data: { venueId, weekday, startMinute: 360, endMinute: 1320 },
        });
    }
  }
  for (const offeringId of [ids.offeringOne, ids.offeringTwo]) {
    for (let weekday = 1; weekday <= 7; weekday += 1) {
      const existing = await prisma.pricingRule.findFirst({
        where: { offeringId, weekday },
      });
      if (!existing)
        await prisma.pricingRule.create({
          data: {
            offeringId,
            weekday,
            startMinute: 360,
            endMinute: 1320,
            pricePerSlot: offeringId === ids.offeringOne ? 150000 : 60000,
          },
        });
    }
  }
  // 03:00 UTC is 10:00 in Asia/Ho_Chi_Minh, safely inside the seeded
  // 06:00-22:00 operating/pricing windows regardless of when seed is run.
  const startAt = new Date();
  startAt.setUTCDate(startAt.getUTCDate() + 3);
  startAt.setUTCHours(3, 0, 0, 0);
  const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
  await prisma.booking.upsert({
    where: { id: ids.booking },
    update: {
      startAt,
      endAt,
      status: BookingStatus.CONFIRMED,
      expiresAt: null,
      occupiesCourt: true,
      priceAmount: 300000,
      pricingBreakdown: [
        {
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          amount: 300000,
        },
      ],
    },
    create: {
      id: ids.booking,
      customerId: ids.customer,
      offeringId: ids.offeringOne,
      courtId: ids.courtOne,
      startAt,
      endAt,
      status: BookingStatus.CONFIRMED,
      occupiesCourt: true,
      priceAmount: 300000,
      cancellationNoticeMinutes: 120,
      confirmationModeSnapshot: ConfirmationMode.INSTANT,
      pricingBreakdown: [
        {
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          amount: 300000,
        },
      ],
    },
  });
  const pendingStart = new Date(startAt.getTime() + 24 * 60 * 60 * 1000);
  const pendingEnd = new Date(pendingStart.getTime() + 60 * 60 * 1000);
  const pendingExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await prisma.booking.upsert({
    where: { id: ids.pendingBooking },
    update: {
      startAt: pendingStart,
      endAt: pendingEnd,
      status: BookingStatus.PENDING,
      expiresAt: pendingExpiresAt,
      occupiesCourt: true,
    },
    create: {
      id: ids.pendingBooking,
      customerId: ids.customer,
      offeringId: ids.offeringTwo,
      courtId: ids.courtTwo,
      startAt: pendingStart,
      endAt: pendingEnd,
      status: BookingStatus.PENDING,
      expiresAt: pendingExpiresAt,
      occupiesCourt: true,
      priceAmount: 120000,
      cancellationNoticeMinutes: 120,
      confirmationModeSnapshot: ConfirmationMode.OWNER_APPROVAL,
      pricingBreakdown: [
        {
          startAt: pendingStart.toISOString(),
          endAt: pendingEnd.toISOString(),
          amount: 120000,
        },
      ],
    },
  });
  await prisma.booking.upsert({
    where: { id: ids.cancelledBooking },
    update: {
      startAt,
      endAt,
      status: BookingStatus.CANCELLED,
      expiresAt: null,
      occupiesCourt: false,
      cancellationReason: "Booking demo đã hủy",
    },
    create: {
      id: ids.cancelledBooking,
      customerId: ids.customer,
      offeringId: ids.offeringOne,
      courtId: ids.courtOne,
      startAt,
      endAt,
      status: BookingStatus.CANCELLED,
      occupiesCourt: false,
      priceAmount: 300000,
      cancellationNoticeMinutes: 120,
      confirmationModeSnapshot: ConfirmationMode.INSTANT,
      pricingBreakdown: [],
      cancellationReason: "Booking demo đã hủy",
    },
  });
  const previousLifecycleEvents = await prisma.outboxEvent.findMany({
    where: {
      aggregateId: { in: [ids.booking, ids.pendingBooking] },
      eventType: {
        in: ["BOOKING_COMPLETION_REQUESTED", "BOOKING_EXPIRATION_REQUESTED"],
      },
    },
    select: { id: true },
  });
  await prisma.processedEvent.deleteMany({
    where: {
      eventId: { in: previousLifecycleEvents.map(({ id }) => id) },
    },
  });
  await prisma.outboxEvent.deleteMany({
    where: { id: { in: previousLifecycleEvents.map(({ id }) => id) } },
  });
  await Promise.all([
    prisma.outboxEvent.create({
      data: {
        id: ids.completionEvent,
        aggregateType: "Booking",
        aggregateId: ids.booking,
        eventType: "BOOKING_COMPLETION_REQUESTED",
        payload: { bookingId: ids.booking },
        availableAt: endAt,
      },
    }),
    prisma.outboxEvent.create({
      data: {
        id: ids.expirationEvent,
        aggregateType: "Booking",
        aggregateId: ids.pendingBooking,
        eventType: "BOOKING_EXPIRATION_REQUESTED",
        payload: { bookingId: ids.pendingBooking },
        availableAt: pendingExpiresAt,
      },
    }),
  ]);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
