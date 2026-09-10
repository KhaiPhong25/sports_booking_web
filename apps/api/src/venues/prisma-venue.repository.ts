import { Injectable } from "@nestjs/common";
import {
  ConfirmationMode as PrismaConfirmationMode,
  Prisma,
  VenueStatus as PrismaVenueStatus,
} from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import {
  ConfirmationMode,
  CourtRecord,
  OfferingInput,
  OfferingRecord,
  VenueInput,
  VenueRecord,
  VenueRepository,
  VenueStatus,
} from "./venue.repository";

const venueInclude = {
  images: { orderBy: { sortOrder: "asc" as const } },
  amenities: { include: { amenity: true } },
  offerings: { include: { courts: true } },
} satisfies Prisma.VenueInclude;
type VenuePayload = Prisma.VenueGetPayload<{ include: typeof venueInclude }>;

function mapOffering(
  offering: VenuePayload["offerings"][number],
): OfferingRecord {
  return {
    id: offering.id,
    venueId: offering.venueId,
    sportId: offering.sportId,
    confirmationMode: offering.confirmationMode as ConfirmationMode,
    advanceBookingDays: offering.advanceBookingDays,
    cancellationNoticeMinutes: offering.cancellationNoticeMinutes,
    isActive: offering.isActive,
    courts: offering.courts,
  };
}

function mapVenue(venue: VenuePayload): VenueRecord {
  return {
    id: venue.id,
    ownerId: venue.ownerId,
    areaId: venue.areaId,
    name: venue.name,
    address: venue.address,
    description: venue.description,
    latitude: venue.latitude.toNumber(),
    longitude: venue.longitude.toNumber(),
    status: venue.status as VenueStatus,
    moderationReason: venue.moderationReason,
    images: venue.images.map(({ id, objectKey, url, altText, sortOrder }) => ({
      id,
      objectKey,
      url,
      altText,
      sortOrder,
    })),
    amenities: venue.amenities.map(({ amenity }) => amenity),
    offerings: venue.offerings.map(mapOffering),
  };
}

@Injectable()
export class PrismaVenueRepository implements VenueRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createVenue(ownerId: string, input: VenueInput): Promise<VenueRecord> {
    return mapVenue(
      await this.prisma.venue.create({
        data: { ...input, ownerId, status: PrismaVenueStatus.PENDING_APPROVAL },
        include: venueInclude,
      }),
    );
  }

  async findVenue(id: string): Promise<VenueRecord | null> {
    const venue = await this.prisma.venue.findUnique({
      where: { id },
      include: venueInclude,
    });
    return venue ? mapVenue(venue) : null;
  }

  async publicVenues(
    skip: number,
    take: number,
    filters: { sportId?: string; areaId?: string } = {},
  ) {
    const where = {
      status: PrismaVenueStatus.APPROVED,
      ...(filters.areaId ? { areaId: filters.areaId } : {}),
      offerings: {
        some: {
          isActive: true,
          ...(filters.sportId ? { sportId: filters.sportId } : {}),
          courts: { some: { isActive: true } },
        },
      },
    } satisfies Prisma.VenueWhereInput;
    const [venues, total] = await this.prisma.$transaction([
      this.prisma.venue.findMany({
        where,
        include: venueInclude,
        orderBy: { name: "asc" },
        skip,
        take,
      }),
      this.prisma.venue.count({ where }),
    ]);
    return { items: venues.map(mapVenue), total };
  }

  async pendingVenues(skip: number, take: number) {
    const where = { status: PrismaVenueStatus.PENDING_APPROVAL };
    const [venues, total] = await this.prisma.$transaction([
      this.prisma.venue.findMany({
        where: { status: PrismaVenueStatus.PENDING_APPROVAL },
        include: venueInclude,
        orderBy: { createdAt: "asc" },
        skip,
        take,
      }),
      this.prisma.venue.count({ where }),
    ]);
    return { items: venues.map(mapVenue), total };
  }

  async ownerVenues(ownerId: string, skip: number, take: number) {
    const where = { ownerId, status: { not: PrismaVenueStatus.ARCHIVED } };
    const [venues, total] = await this.prisma.$transaction([
      this.prisma.venue.findMany({
        where,
        include: venueInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.venue.count({ where }),
    ]);
    return { items: venues.map(mapVenue), total };
  }

  async updateVenue(
    id: string,
    input: Partial<VenueInput> & { status?: VenueStatus },
  ): Promise<VenueRecord> {
    return mapVenue(
      await this.prisma.venue.update({
        where: { id },
        data: {
          ...input,
          ...(input.status
            ? { status: input.status as PrismaVenueStatus }
            : {}),
        },
        include: venueInclude,
      }),
    );
  }

  moderateVenue(
    id: string,
    adminId: string,
    status: VenueStatus,
    reason: string | null,
  ): Promise<VenueRecord> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.venue.findUniqueOrThrow({ where: { id } });
      const updated = await tx.venue.update({
        where: { id },
        data: { status: status as PrismaVenueStatus, moderationReason: reason },
        include: venueInclude,
      });
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: `VENUE_${status}`,
          resourceType: "Venue",
          resourceId: id,
          beforeData: {
            status: before.status,
            reason: before.moderationReason,
          },
          afterData: { status, reason },
        },
      });
      return mapVenue(updated);
    });
  }

  async setAmenities(id: string, amenityIds: string[]): Promise<VenueRecord> {
    return this.prisma.$transaction(async (tx) => {
      await tx.venueAmenity.deleteMany({ where: { venueId: id } });
      if (amenityIds.length) {
        await tx.venueAmenity.createMany({
          data: amenityIds.map((amenityId) => ({ venueId: id, amenityId })),
          skipDuplicates: true,
        });
      }
      return mapVenue(
        await tx.venue.findUniqueOrThrow({
          where: { id },
          include: venueInclude,
        }),
      );
    });
  }

  async addImage(
    id: string,
    image: { id: string; objectKey: string; url: string; altText: string },
  ): Promise<VenueRecord> {
    const count = await this.prisma.venueImage.count({
      where: { venueId: id },
    });
    await this.prisma.venueImage.create({
      data: { venueId: id, ...image, sortOrder: count },
    });
    return mapVenue(
      await this.prisma.venue.findUniqueOrThrow({
        where: { id },
        include: venueInclude,
      }),
    );
  }

  createOffering(
    venueId: string,
    input: OfferingInput,
  ): Promise<OfferingRecord> {
    return this.prisma.venueSportOffering.create({
      data: {
        ...input,
        venueId,
        confirmationMode: input.confirmationMode as PrismaConfirmationMode,
      },
      include: { courts: true },
    }) as Promise<OfferingRecord>;
  }

  async findOffering(
    id: string,
  ): Promise<(OfferingRecord & { ownerId: string }) | null> {
    const offering = await this.prisma.venueSportOffering.findUnique({
      where: { id },
      include: { courts: true, venue: { select: { ownerId: true } } },
    });
    return offering
      ? {
          ...offering,
          confirmationMode: offering.confirmationMode as ConfirmationMode,
          ownerId: offering.venue.ownerId,
        }
      : null;
  }

  updateOffering(
    id: string,
    input: Partial<OfferingInput> & { isActive?: boolean },
  ): Promise<OfferingRecord> {
    return this.prisma.venueSportOffering.update({
      where: { id },
      data: {
        ...input,
        ...(input.confirmationMode
          ? {
              confirmationMode:
                input.confirmationMode as PrismaConfirmationMode,
            }
          : {}),
      },
      include: { courts: true },
    }) as Promise<OfferingRecord>;
  }

  createCourt(offeringId: string, internalName: string): Promise<CourtRecord> {
    return this.prisma.court.create({ data: { offeringId, internalName } });
  }

  async findCourt(
    id: string,
  ): Promise<(CourtRecord & { ownerId: string }) | null> {
    const court = await this.prisma.court.findUnique({
      where: { id },
      include: {
        offering: { include: { venue: { select: { ownerId: true } } } },
      },
    });
    return court ? { ...court, ownerId: court.offering.venue.ownerId } : null;
  }

  updateCourt(
    id: string,
    input: { internalName?: string; isActive?: boolean },
  ): Promise<CourtRecord> {
    return this.prisma.court.update({ where: { id }, data: input });
  }

  async hasFutureOccupyingBookingForVenue(venueId: string, now: Date) {
    return (
      (await this.prisma.booking.count({
        where: {
          offering: { venueId },
          endAt: { gt: now },
          occupiesCourt: true,
          OR: [
            { status: "CONFIRMED" },
            { status: "PENDING", expiresAt: { gt: now } },
          ],
        },
      })) > 0
    );
  }

  async hasFutureOccupyingBookingForCourt(courtId: string, now: Date) {
    return (
      (await this.prisma.booking.count({
        where: {
          courtId,
          endAt: { gt: now },
          occupiesCourt: true,
          OR: [
            { status: "CONFIRMED" },
            { status: "PENDING", expiresAt: { gt: now } },
          ],
        },
      })) > 0
    );
  }

  archiveVenueIfNoBookings(venueId: string, now: Date) {
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
      return mapVenue(
        await tx.venue.update({
          where: { id: venueId },
          data: { status: PrismaVenueStatus.ARCHIVED },
          include: venueInclude,
        }),
      );
    });
  }

  setCourtActiveIfNoBookings(courtId: string, isActive: boolean, now: Date) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "courts" WHERE "id" = ${courtId}::uuid FOR UPDATE
      `;
      if (!isActive) {
        const active = await tx.booking.count({
          where: {
            courtId,
            endAt: { gt: now },
            occupiesCourt: true,
            OR: [
              { status: "CONFIRMED" },
              { status: "PENDING", expiresAt: { gt: now } },
            ],
          },
        });
        if (active) return null;
      }
      return tx.court.update({ where: { id: courtId }, data: { isActive } });
    });
  }

  sports() {
    return this.prisma.sport.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    });
  }
  areas() {
    return this.prisma.area.findMany({
      select: { id: true, code: true, name: true, type: true },
      orderBy: { name: "asc" },
    });
  }
  amenities() {
    return this.prisma.amenity.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    });
  }
}
