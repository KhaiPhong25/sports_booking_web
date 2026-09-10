import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { WeeklyWindow } from "./schedule-policy";
import { ClosureInput, SchedulingRepository } from "./scheduling.repository";

@Injectable()
export class PrismaSchedulingRepository implements SchedulingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async venueOwner(venueId: string) {
    return (
      (
        await this.prisma.venue.findUnique({
          where: { id: venueId },
          select: { ownerId: true },
        })
      )?.ownerId ?? null
    );
  }
  async courtVenue(courtId: string) {
    return (
      (
        await this.prisma.court.findUnique({
          where: { id: courtId },
          select: { offering: { select: { venueId: true } } },
        })
      )?.offering.venueId ?? null
    );
  }
  listHours(venueId: string) {
    return this.prisma.operatingHour.findMany({
      where: { venueId },
      orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
    });
  }
  replaceHours(venueId: string, windows: WeeklyWindow[]) {
    return this.prisma.$transaction(async (tx) => {
      await tx.operatingHour.deleteMany({ where: { venueId } });
      if (windows.length) {
        await tx.operatingHour.createMany({
          data: windows.map((window) => ({ venueId, ...window })),
        });
      }
      return tx.operatingHour.findMany({
        where: { venueId },
        orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
      });
    });
  }
  replaceHoursIfNoBookings(
    venueId: string,
    windows: WeeklyWindow[],
    now: Date,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "venues" WHERE "id" = ${venueId}::uuid FOR UPDATE
      `;
      const active = await tx.booking.count({
        where: {
          offering: { venueId },
          endAt: { gt: now },
          occupiesCourt: true,
          OR: [
            { status: "CONFIRMED" },
            { status: "PENDING", expiresAt: { gt: now } },
          ],
        },
      });
      if (active) return null;
      await tx.operatingHour.deleteMany({ where: { venueId } });
      if (windows.length)
        await tx.operatingHour.createMany({
          data: windows.map((window) => ({ venueId, ...window })),
        });
      return tx.operatingHour.findMany({
        where: { venueId },
        orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
      });
    });
  }
  listClosures(venueId: string) {
    return this.prisma.venueClosure.findMany({
      where: { venueId },
      orderBy: { startAt: "asc" },
    });
  }
  async findClosure(id: string) {
    const closure = await this.prisma.venueClosure.findUnique({
      where: { id },
      include: { venue: { select: { ownerId: true } } },
    });
    return closure ? { ...closure, ownerId: closure.venue.ownerId } : null;
  }
  createClosure(venueId: string, input: ClosureInput) {
    return this.prisma.venueClosure.create({
      data: { venueId, ...input, courtId: input.courtId ?? null },
    });
  }
  createClosureIfNoBookings(venueId: string, input: ClosureInput) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "venues" WHERE "id" = ${venueId}::uuid FOR UPDATE
      `;
      const active = await tx.booking.count({
        where: {
          offering: { venueId },
          ...(input.courtId ? { courtId: input.courtId } : {}),
          occupiesCourt: true,
          startAt: { lt: input.endAt },
          endAt: { gt: input.startAt },
          OR: [
            { status: "CONFIRMED" },
            { status: "PENDING", expiresAt: { gt: new Date() } },
          ],
        },
      });
      if (active) return null;
      return tx.venueClosure.create({
        data: { venueId, ...input, courtId: input.courtId ?? null },
      });
    });
  }
  updateClosure(id: string, input: ClosureInput) {
    return this.prisma.venueClosure.update({
      where: { id },
      data: { ...input, courtId: input.courtId ?? null },
    });
  }
  updateClosureIfNoBookings(id: string, venueId: string, input: ClosureInput) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "venues" WHERE "id" = ${venueId}::uuid FOR UPDATE
      `;
      const active = await tx.booking.count({
        where: {
          offering: { venueId },
          ...(input.courtId ? { courtId: input.courtId } : {}),
          occupiesCourt: true,
          startAt: { lt: input.endAt },
          endAt: { gt: input.startAt },
          OR: [
            { status: "CONFIRMED" },
            { status: "PENDING", expiresAt: { gt: new Date() } },
          ],
        },
      });
      if (active) return null;
      return tx.venueClosure.update({
        where: { id },
        data: { ...input, courtId: input.courtId ?? null },
      });
    });
  }
  async deleteClosure(id: string) {
    await this.prisma.venueClosure.delete({ where: { id } });
  }
  async hasOccupyingBooking(
    venueId: string,
    courtId: string | null,
    startAt: Date,
    endAt: Date,
  ) {
    return (
      (await this.prisma.booking.count({
        where: {
          offering: { venueId },
          ...(courtId ? { courtId } : {}),
          occupiesCourt: true,
          startAt: { lt: endAt },
          endAt: { gt: startAt },
          OR: [
            { status: "CONFIRMED" },
            { status: "PENDING", expiresAt: { gt: new Date() } },
          ],
        },
      })) > 0
    );
  }
}
