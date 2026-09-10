import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  BookingStatus,
  ConfirmationMode,
  Prisma,
  VenueStatus,
} from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import {
  BOOKING_COMPLETION_REQUESTED,
  BOOKING_EXPIRATION_REQUESTED,
  NotificationPublisher,
} from "../notifications/notification-publisher";
import {
  PricingEngine,
  PricingNotCoveredError,
} from "../pricing/pricing-engine";
import { BookingStatePolicy, BookingStatusValue } from "./booking-state-policy";
import {
  BookingTimePolicy,
  BookingTimePolicyError,
} from "./booking-time-policy";
import { BookingView } from "./booking.types";

const bookingInclude = {
  court: { select: { internalName: true } },
  customer: { select: { email: true, displayName: true, phone: true } },
  offering: {
    select: {
      venue: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          owner: { select: { email: true, displayName: true } },
        },
      },
      sport: { select: { name: true } },
    },
  },
} satisfies Prisma.BookingInclude;
type BookingPayload = Prisma.BookingGetPayload<{
  include: typeof bookingInclude;
}>;

@Injectable()
export class BookingsService {
  private readonly statePolicy = new BookingStatePolicy();
  private readonly timePolicy = new BookingTimePolicy();

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingEngine: PricingEngine,
    private readonly notifications: NotificationPublisher,
  ) {}

  async availability(
    offeringId: string,
    startAt: Date,
    endAt: Date,
    now = new Date(),
  ) {
    return this.prisma.$transaction(async (tx) => {
      const context = await this.loadPublicContext(tx, offeringId);
      this.validateBookingTime(startAt, endAt, now, context.advanceBookingDays);
      this.quoteContext(context, startAt, endAt);
      await this.expireStalePending(tx, offeringId, now);
      const rows = await tx.$queryRaw<Array<{ capacity: bigint }>>`
        SELECT count(*)::bigint AS capacity
        FROM "courts" c
        WHERE c."offering_id" = ${offeringId}::uuid
          AND c."is_active" = true
          AND NOT EXISTS (
            SELECT 1 FROM "venue_closures" vc
            WHERE vc."venue_id" = ${context.venueId}::uuid
              AND (vc."court_id" IS NULL OR vc."court_id" = c."id")
              AND vc."start_at" < ${endAt}
              AND vc."end_at" > ${startAt}
          )
          AND NOT EXISTS (
            SELECT 1 FROM "bookings" b
            WHERE b."court_id" = c."id"
              AND b."occupies_court" = true
              AND b."start_at" < ${endAt}
              AND b."end_at" > ${startAt}
          )
      `;
      const capacity = Number(rows[0]?.capacity ?? 0);
      return {
        offeringId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        available: capacity > 0,
        capacity,
      };
    });
  }

  async create(
    customerId: string,
    idempotencyKey: string,
    input: { offeringId: string; startAt: Date; endAt: Date },
    now = new Date(),
  ): Promise<BookingView> {
    this.validateIdempotencyKey(idempotencyKey);
    const requestHash = createHash("sha256")
      .update(
        JSON.stringify({
          offeringId: input.offeringId,
          startAt: input.startAt.toISOString(),
          endAt: input.endAt.toISOString(),
        }),
      )
      .digest("hex");

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await tx.$executeRaw`
              SELECT pg_advisory_xact_lock(
                hashtextextended(${`${customerId}:booking-create:${idempotencyKey}`}, 0)
              )
            `;
            const existing = await tx.idempotencyRecord.findUnique({
              where: {
                actorId_scope_key: {
                  actorId: customerId,
                  scope: "BOOKING_CREATE",
                  key: idempotencyKey,
                },
              },
            });
            if (existing) {
              if (existing.requestHash !== requestHash) {
                throw new ConflictException({
                  code: "IDEMPOTENCY_KEY_REUSED",
                  message:
                    "Idempotency key was already used for another request",
                });
              }
              if (!existing.resourceId)
                throw new ConflictException(
                  "Booking request is still processing",
                );
              const booking = await tx.booking.findUnique({
                where: { id: existing.resourceId },
                include: bookingInclude,
              });
              if (!booking)
                throw new ConflictException("Stored booking is missing");
              return this.toView(booking, false);
            }

            const preliminary = await tx.venueSportOffering.findUnique({
              where: { id: input.offeringId },
              select: { venueId: true },
            });
            if (!preliminary)
              throw new NotFoundException("Public offering not found");
            await tx.$queryRaw`
              SELECT "id" FROM "venues"
              WHERE "id" = ${preliminary.venueId}::uuid FOR SHARE
            `;
            await tx.$queryRaw`
              SELECT "id" FROM "venue_sport_offerings"
              WHERE "id" = ${input.offeringId}::uuid FOR SHARE
            `;
            const context = await this.loadPublicContext(tx, input.offeringId);
            this.validateBookingTime(
              input.startAt,
              input.endAt,
              now,
              context.advanceBookingDays,
            );
            const quote = this.quoteContext(
              context,
              input.startAt,
              input.endAt,
            );
            await this.expireStalePending(tx, input.offeringId, now);

            const candidates = await tx.$queryRaw<Array<{ id: string }>>`
              SELECT c."id"
              FROM "courts" c
              WHERE c."offering_id" = ${input.offeringId}::uuid
                AND c."is_active" = true
                AND NOT EXISTS (
                  SELECT 1 FROM "venue_closures" vc
                  WHERE vc."venue_id" = ${context.venueId}::uuid
                    AND (vc."court_id" IS NULL OR vc."court_id" = c."id")
                    AND vc."start_at" < ${input.endAt}
                    AND vc."end_at" > ${input.startAt}
                )
                AND NOT EXISTS (
                  SELECT 1 FROM "bookings" b
                  WHERE b."court_id" = c."id"
                    AND b."occupies_court" = true
                    AND b."start_at" < ${input.endAt}
                    AND b."end_at" > ${input.startAt}
                )
              ORDER BY c."id"
              LIMIT 1
              FOR UPDATE OF c SKIP LOCKED
            `;
            const courtId = candidates[0]?.id;
            if (!courtId) {
              throw new ConflictException({
                code: "BOOKING_NO_CAPACITY",
                message: "No court is available for the selected interval",
              });
            }
            const status =
              context.confirmationMode === ConfirmationMode.INSTANT
                ? BookingStatus.CONFIRMED
                : BookingStatus.PENDING;
            this.statePolicy.assertTransition(null, status);
            const expiresAt =
              status === BookingStatus.PENDING
                ? new Date(now.getTime() + 30 * 60_000)
                : null;
            const booking = await tx.booking.create({
              data: {
                customerId,
                offeringId: input.offeringId,
                courtId,
                startAt: input.startAt,
                endAt: input.endAt,
                status,
                expiresAt,
                occupiesCourt: true,
                priceAmount: BigInt(quote.amount),
                currency: quote.currency,
                slotMinutes: quote.slotMinutes,
                cancellationNoticeMinutes: context.cancellationNoticeMinutes,
                confirmationModeSnapshot: context.confirmationMode,
                pricingBreakdown: quote.breakdown as Prisma.InputJsonValue,
                history: {
                  create: {
                    fromStatus: null,
                    toStatus: status,
                    actorType: "USER",
                    actorId: customerId,
                  },
                },
              },
              include: bookingInclude,
            });
            await this.publishCreated(tx, booking);
            const view = this.toView(booking, false);
            await tx.idempotencyRecord.create({
              data: {
                actorId: customerId,
                scope: "BOOKING_CREATE",
                key: idempotencyKey,
                requestHash,
                resourceId: booking.id,
                responseStatus: 201,
                responseBody: view as unknown as Prisma.InputJsonValue,
              },
            });
            return view;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (this.isRetryableTransactionError(error) && attempt < 2) continue;
        if (this.isOverlapConstraintError(error)) {
          throw new ConflictException({
            code: "BOOKING_NO_CAPACITY",
            message: "No court is available for the selected interval",
          });
        }
        throw error;
      }
    }
    throw new ConflictException("Booking transaction could not be completed");
  }

  async customerList(
    customerId: string,
    query: {
      page?: number;
      pageSize?: number;
      status?: BookingStatus;
      from?: string;
      to?: string;
      sort?: "startAtAsc" | "startAtDesc";
    } = {},
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.BookingWhereInput = {
      customerId,
      ...(query.status ? { status: query.status } : {}),
      ...this.dateFilter(query.from, query.to),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        include: bookingInclude,
        orderBy: { startAt: query.sort === "startAtAsc" ? "asc" : "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return {
      items: items.map((item) => this.toView(item, false)),
      total,
      page,
      pageSize,
    };
  }

  async customerDetail(customerId: string, id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: bookingInclude,
    });
    if (!booking || booking.customerId !== customerId)
      throw new NotFoundException("Booking not found");
    return this.toView(booking, false);
  }

  async ownerList(
    ownerId: string,
    query: {
      page?: number;
      pageSize?: number;
      status?: BookingStatus;
      from?: string;
      to?: string;
      sort?: "startAtAsc" | "startAtDesc";
      venueId?: string;
    } = {},
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.BookingWhereInput = {
      offering: {
        venue: {
          ownerId,
          ...(query.venueId ? { id: query.venueId } : {}),
        },
      },
      ...(query.status ? { status: query.status } : {}),
      ...this.dateFilter(query.from, query.to),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        include: bookingInclude,
        orderBy: { startAt: query.sort === "startAtAsc" ? "asc" : "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return {
      items: items.map((item) => this.toView(item, true)),
      total,
      page,
      pageSize,
    };
  }

  async ownerDetail(ownerId: string, id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: bookingInclude,
    });
    if (!booking || booking.offering.venue.ownerId !== ownerId)
      throw new NotFoundException("Booking not found");
    return this.toView(booking, true);
  }

  cancelCustomer(
    customerId: string,
    id: string,
    reason: string | null,
    now = new Date(),
  ) {
    return this.transition({
      id,
      actorId: customerId,
      customerId,
      to: "CANCELLED",
      reason,
      now,
      enforceCancellationWindow: true,
    });
  }
  confirmOwner(ownerId: string, actorId: string, id: string, now = new Date()) {
    return this.transition({
      id,
      actorId,
      ownerId,
      to: "CONFIRMED",
      reason: null,
      now,
      requireUnexpiredPending: true,
    });
  }
  rejectOwner(
    ownerId: string,
    actorId: string,
    id: string,
    reason: string,
    now = new Date(),
  ) {
    return this.transition({
      id,
      actorId,
      ownerId,
      to: "REJECTED",
      reason: this.requiredReason(reason),
      now,
      requireUnexpiredPending: true,
    });
  }
  cancelOwner(
    ownerId: string,
    actorId: string,
    id: string,
    reason: string,
    now = new Date(),
  ) {
    return this.transition({
      id,
      actorId,
      ownerId,
      to: "CANCELLED",
      reason: this.requiredReason(reason),
      now,
    });
  }

  async reassignOwner(
    ownerId: string,
    bookingId: string,
    targetCourtId: string,
    now = new Date(),
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "bookings" WHERE "id" = ${bookingId}::uuid FOR UPDATE`;
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: bookingInclude,
      });
      if (!booking || booking.offering.venue.ownerId !== ownerId)
        return { kind: "missing" as const };
      if (
        booking.status === BookingStatus.PENDING &&
        booking.expiresAt &&
        booking.expiresAt <= now
      ) {
        await this.writeTransition(
          tx,
          booking,
          "EXPIRED",
          null,
          "Pending hold elapsed",
        );
        return { kind: "expired" as const };
      }
      if (!booking.occupiesCourt) return { kind: "invalid" as const };
      const lockIds = [booking.courtId, targetCourtId].sort();
      await tx.$queryRaw`
        SELECT "id" FROM "courts"
        WHERE "id"::text IN (${Prisma.join(lockIds)})
        ORDER BY "id" FOR UPDATE
      `;
      const target = await tx.court.findUnique({
        where: { id: targetCourtId },
      });
      if (
        !target ||
        target.offeringId !== booking.offeringId ||
        !target.isActive
      )
        throw new BadRequestException(
          "Target court must be active and in the same offering",
        );
      const [closure, overlap] = await Promise.all([
        tx.venueClosure.findFirst({
          where: {
            venueId: booking.offering.venue.id,
            OR: [{ courtId: null }, { courtId: targetCourtId }],
            startAt: { lt: booking.endAt },
            endAt: { gt: booking.startAt },
          },
        }),
        tx.booking.findFirst({
          where: {
            id: { not: booking.id },
            courtId: targetCourtId,
            occupiesCourt: true,
            startAt: { lt: booking.endAt },
            endAt: { gt: booking.startAt },
          },
        }),
      ]);
      if (closure || overlap)
        throw new ConflictException({
          code: "BOOKING_NO_CAPACITY",
          message: "Target court is unavailable",
        });
      return {
        kind: "ok" as const,
        booking: await tx.booking.update({
          where: { id: booking.id },
          data: { courtId: targetCourtId },
          include: bookingInclude,
        }),
      };
    });
    if (result.kind === "missing")
      throw new NotFoundException("Booking not found");
    if (result.kind === "expired")
      throw new ConflictException({
        code: "BOOKING_HOLD_EXPIRED",
        message: "Booking hold has expired",
      });
    if (result.kind === "invalid")
      throw new ConflictException({
        code: "BOOKING_INVALID_TRANSITION",
        message: "Only active bookings can be reassigned",
      });
    return this.toView(result.booking, true);
  }

  private async transition(input: {
    id: string;
    actorId: string;
    customerId?: string;
    ownerId?: string;
    to: BookingStatusValue;
    reason: string | null;
    now: Date;
    enforceCancellationWindow?: boolean;
    requireUnexpiredPending?: boolean;
  }) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "bookings" WHERE "id" = ${input.id}::uuid FOR UPDATE`;
      const booking = await tx.booking.findUnique({
        where: { id: input.id },
        include: bookingInclude,
      });
      if (!booking) return { kind: "missing" as const };
      if (input.customerId && booking.customerId !== input.customerId)
        return { kind: "missing" as const };
      if (input.ownerId && booking.offering.venue.ownerId !== input.ownerId)
        return { kind: "missing" as const };
      if (
        booking.status === BookingStatus.PENDING &&
        booking.expiresAt &&
        booking.expiresAt <= input.now
      ) {
        await this.writeTransition(tx, booking, "EXPIRED", null, null);
        return { kind: "expired" as const };
      }
      if (
        input.requireUnexpiredPending &&
        booking.status !== BookingStatus.PENDING
      )
        return { kind: "invalid" as const, from: booking.status };
      if (
        input.to === BookingStatus.CANCELLED &&
        input.now >= booking.startAt
      ) {
        return { kind: "window" as const };
      }
      if (
        input.enforceCancellationWindow &&
        input.now.getTime() + booking.cancellationNoticeMinutes * 60_000 >
          booking.startAt.getTime()
      ) {
        return { kind: "window" as const };
      }
      try {
        this.statePolicy.assertTransition(booking.status, input.to);
      } catch {
        return { kind: "invalid" as const, from: booking.status };
      }
      const updated = await this.writeTransition(
        tx,
        booking,
        input.to,
        input.actorId,
        input.reason,
      );
      return { kind: "ok" as const, booking: updated };
    });
    if (result.kind === "missing")
      throw new NotFoundException("Booking not found");
    if (result.kind === "expired")
      throw new ConflictException({
        code: "BOOKING_HOLD_EXPIRED",
        message: "Booking hold has expired",
      });
    if (result.kind === "window")
      throw new ConflictException({
        code: "BOOKING_CANCELLATION_WINDOW_CLOSED",
        message: "Cancellation notice window is closed",
      });
    if (result.kind === "invalid")
      throw new ConflictException({
        code: "BOOKING_INVALID_TRANSITION",
        message: `Cannot transition from ${result.from}`,
      });
    return this.toView(result.booking, Boolean(input.ownerId));
  }

  private async writeTransition(
    tx: Prisma.TransactionClient,
    booking: BookingPayload,
    to: BookingStatusValue,
    actorId: string | null,
    reason: string | null,
  ) {
    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: to,
        occupiesCourt: this.statePolicy.occupiesCourt(to),
        expiresAt: to === "PENDING" ? booking.expiresAt : null,
        ...(to === "CANCELLED" ? { cancellationReason: reason } : {}),
        history: {
          create: {
            fromStatus: booking.status,
            toStatus: to,
            actorType: actorId ? "USER" : "SYSTEM",
            actorId,
            reason,
          },
        },
      },
      include: bookingInclude,
    });
    await this.publishTransition(tx, updated, actorId);
    return updated;
  }

  private async expireStalePending(
    tx: Prisma.TransactionClient,
    offeringId: string,
    now: Date,
  ) {
    const stale = await tx.booking.findMany({
      where: {
        offeringId,
        status: "PENDING",
        occupiesCourt: true,
        expiresAt: { lte: now },
      },
      include: bookingInclude,
    });
    for (const booking of stale) {
      const updated = await tx.booking.updateMany({
        where: {
          id: booking.id,
          status: "PENDING",
          occupiesCourt: true,
          expiresAt: { lte: now },
        },
        data: {
          status: "EXPIRED",
          occupiesCourt: false,
          expiresAt: null,
        },
      });
      if (updated.count === 1) {
        await tx.bookingStatusHistory.create({
          data: {
            bookingId: booking.id,
            fromStatus: "PENDING",
            toStatus: "EXPIRED",
            actorType: "SYSTEM",
            reason: "Pending hold elapsed",
          },
        });
        await this.publishTransition(tx, booking, null, "EXPIRED");
      }
    }
  }

  private async publishCreated(
    tx: Prisma.TransactionClient,
    booking: BookingPayload,
  ) {
    const bookingId = booking.id;
    const customerType =
      booking.status === BookingStatus.PENDING
        ? "BOOKING_PENDING"
        : "BOOKING_CONFIRMED";
    await this.notifications.publish(tx, {
      userId: booking.customerId,
      type: customerType,
      payload: this.notificationPayload(booking),
      email: {
        to: booking.customer.email,
        subject:
          booking.status === BookingStatus.PENDING
            ? "Yêu cầu đặt sân đang chờ duyệt"
            : "Booking sân đã được xác nhận",
        text: `${booking.customer.displayName}, booking tại ${booking.offering.venue.name} có trạng thái ${booking.status}.`,
      },
    });
    await this.notifications.publish(tx, {
      userId: booking.offering.venue.ownerId,
      type: "BOOKING_CREATED",
      payload: this.notificationPayload(booking),
      email: {
        to: booking.offering.venue.owner.email,
        subject: "Có booking mới tại địa điểm của bạn",
        text: `${booking.offering.venue.owner.displayName}, có booking mới tại ${booking.offering.venue.name}.`,
      },
    });
    await this.notifications.scheduleLifecycle(tx, {
      bookingId,
      eventType:
        booking.status === BookingStatus.PENDING
          ? BOOKING_EXPIRATION_REQUESTED
          : BOOKING_COMPLETION_REQUESTED,
      availableAt:
        booking.status === BookingStatus.PENDING
          ? booking.expiresAt!
          : booking.endAt,
    });
  }

  private async publishTransition(
    tx: Prisma.TransactionClient,
    booking: BookingPayload,
    actorId: string | null,
    status: BookingStatusValue = booking.status,
  ) {
    if (status === BookingStatus.CONFIRMED) {
      await this.notifications.scheduleLifecycle(tx, {
        bookingId: booking.id,
        eventType: BOOKING_COMPLETION_REQUESTED,
        availableAt: booking.endAt,
      });
    }
    const notifyOwner =
      status === BookingStatus.CANCELLED && actorId === booking.customerId;
    const recipient = notifyOwner
      ? {
          id: booking.offering.venue.ownerId,
          email: booking.offering.venue.owner.email,
          name: booking.offering.venue.owner.displayName,
        }
      : {
          id: booking.customerId,
          email: booking.customer.email,
          name: booking.customer.displayName,
        };
    await this.notifications.publish(tx, {
      userId: recipient.id,
      type: `BOOKING_${status}`,
      payload: this.notificationPayload(booking, status),
      email: {
        to: recipient.email,
        subject: `Cập nhật booking: ${status}`,
        text: `${recipient.name}, booking tại ${booking.offering.venue.name} đã chuyển sang ${status}.`,
      },
    });
  }

  private notificationPayload(
    booking: BookingPayload,
    status: BookingStatusValue = booking.status,
  ): Prisma.InputJsonObject {
    return {
      bookingId: booking.id,
      venueId: booking.offering.venue.id,
      venueName: booking.offering.venue.name,
      sportName: booking.offering.sport.name,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      status,
    };
  }

  private async loadPublicContext(
    tx: Prisma.TransactionClient,
    offeringId: string,
  ) {
    const offering = await tx.venueSportOffering.findUnique({
      where: { id: offeringId },
      include: {
        venue: {
          include: {
            operatingHours: true,
            closures: { where: { courtId: null } },
          },
        },
        pricingRules: true,
      },
    });
    if (
      !offering ||
      !offering.isActive ||
      offering.venue.status !== VenueStatus.APPROVED
    )
      throw new NotFoundException("Public offering not found");
    return {
      venueId: offering.venueId,
      confirmationMode: offering.confirmationMode,
      advanceBookingDays: offering.advanceBookingDays,
      cancellationNoticeMinutes: offering.cancellationNoticeMinutes,
      operatingHours: offering.venue.operatingHours,
      closures: offering.venue.closures,
      pricingRules: offering.pricingRules.map((rule) => ({
        ...rule,
        pricePerSlot: Number(rule.pricePerSlot),
      })),
    };
  }

  private quoteContext(
    context: Awaited<ReturnType<BookingsService["loadPublicContext"]>>,
    startAt: Date,
    endAt: Date,
  ) {
    try {
      return this.pricingEngine.quote({ startAt, endAt, ...context });
    } catch (error) {
      if (error instanceof PricingNotCoveredError)
        throw new UnprocessableEntityException({
          code: "PRICING_NOT_COVERED",
          message: error.message,
        });
      throw new BadRequestException((error as Error).message);
    }
  }

  private validateBookingTime(
    startAt: Date,
    endAt: Date,
    now: Date,
    advanceBookingDays: number,
  ) {
    try {
      this.timePolicy.validate(startAt, endAt, now, advanceBookingDays);
    } catch (error) {
      if (error instanceof BookingTimePolicyError)
        throw new BadRequestException(error.message);
      throw error;
    }
  }

  private toView(booking: BookingPayload, includeCourt: boolean): BookingView {
    const priceAmount = Number(booking.priceAmount);
    if (!Number.isSafeInteger(priceAmount))
      throw new Error("Booking price exceeds JSON safe integer");
    return {
      id: booking.id,
      customerId: booking.customerId,
      offeringId: booking.offeringId,
      ...(includeCourt
        ? {
            courtId: booking.courtId,
            courtName: booking.court.internalName,
            customer: booking.customer,
          }
        : {}),
      venueId: booking.offering.venue.id,
      venueName: booking.offering.venue.name,
      sportName: booking.offering.sport.name,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      status: booking.status,
      expiresAt: booking.expiresAt?.toISOString() ?? null,
      priceAmount,
      currency: booking.currency,
      slotMinutes: booking.slotMinutes,
      cancellationNoticeMinutes: booking.cancellationNoticeMinutes,
      confirmationModeSnapshot: booking.confirmationModeSnapshot,
      pricingBreakdown: booking.pricingBreakdown,
      cancellationReason: booking.cancellationReason,
    };
  }

  private validateIdempotencyKey(key: string) {
    if (
      !key ||
      key.length < 8 ||
      key.length > 128 ||
      !/^[A-Za-z0-9._:-]+$/.test(key)
    )
      throw new BadRequestException(
        "A valid Idempotency-Key header is required",
      );
  }
  private dateFilter(from?: string, to?: string): Prisma.BookingWhereInput {
    if (!from && !to) return {};
    return {
      startAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lt: new Date(to) } : {}),
      },
    };
  }
  private requiredReason(reason: string) {
    const clean = reason.trim();
    if (clean.length < 3)
      throw new BadRequestException(
        "Reason must contain at least 3 characters",
      );
    return clean;
  }
  private isRetryableTransactionError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    );
  }
  private isOverlapConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2004" ||
        (error.code === "P2010" && error.meta?.code === "23P01"))
    );
  }
}
