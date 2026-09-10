import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  HttpException,
} from "@nestjs/common";
import { BookingsService } from "../bookings/bookings.service";
import {
  OfferingInput,
  VENUE_REPOSITORY,
  VenueInput,
  VenueRepository,
  VenueStatus,
} from "./venue.repository";

@Injectable()
export class VenuesService {
  constructor(
    @Inject(VENUE_REPOSITORY) private readonly repository: VenueRepository,
    @Optional() private readonly bookings?: BookingsService,
  ) {}

  create(ownerId: string, input: VenueInput) {
    return this.repository.createVenue(ownerId, this.cleanVenue(input));
  }

  async publicList(
    page = 1,
    pageSize = 20,
    filters: {
      sportId?: string;
      areaId?: string;
      startAt?: string;
      endAt?: string;
    } = {},
  ) {
    const hasStart = Boolean(filters.startAt);
    const hasEnd = Boolean(filters.endAt);
    if (hasStart !== hasEnd || ((hasStart || hasEnd) && !filters.sportId)) {
      throw new BadRequestException(
        "sportId, startAt and endAt are required together for availability search",
      );
    }
    if (hasStart && hasEnd) {
      if (!this.bookings)
        throw new Error("Booking availability service is unavailable");
      const all = await this.repository.publicVenues(0, 1000, filters);
      const startAt = new Date(filters.startAt!);
      const endAt = new Date(filters.endAt!);
      const available = [];
      for (const venue of all.items) {
        const matching = [];
        for (const offering of venue.offerings ?? []) {
          if (!offering.isActive || offering.sportId !== filters.sportId)
            continue;
          try {
            const result = await this.bookings.availability(
              offering.id,
              startAt,
              endAt,
            );
            if (result.available) matching.push(offering);
          } catch (error) {
            if (error instanceof HttpException && error.getStatus() === 422)
              continue;
            throw error;
          }
        }
        if (matching.length) available.push({ ...venue, offerings: matching });
      }
      const items = available.slice((page - 1) * pageSize, page * pageSize);
      return {
        items: items.map((venue) => this.publicVenue(venue)),
        total: available.length,
        page,
        pageSize,
      };
    }
    const result = await this.repository.publicVenues(
      (page - 1) * pageSize,
      pageSize,
      filters,
    );
    return {
      ...result,
      items: result.items.map((venue) => this.publicVenue(venue)),
      page,
      pageSize,
    };
  }

  async pendingList(page = 1, pageSize = 20) {
    const result = await this.repository.pendingVenues(
      (page - 1) * pageSize,
      pageSize,
    );
    return { ...result, page, pageSize };
  }

  async publicDetail(id: string) {
    const venue = await this.repository.findVenue(id);
    if (!venue || venue.status !== "APPROVED") {
      throw new NotFoundException("Public venue not found");
    }
    return this.publicVenue(venue);
  }

  async ownerList(ownerId: string, page = 1, pageSize = 20) {
    const result = await this.repository.ownerVenues(
      ownerId,
      (page - 1) * pageSize,
      pageSize,
    );
    return { ...result, page, pageSize };
  }

  async ownerDetail(ownerId: string, id: string) {
    const venue = await this.ownedVenue(ownerId, id);
    return venue;
  }

  async update(ownerId: string, id: string, input: Partial<VenueInput>) {
    const venue = await this.ownedVenue(ownerId, id);
    const nextStatus =
      venue.status === "APPROVED" ? "PENDING_APPROVAL" : venue.status;
    return this.repository.updateVenue(id, {
      ...input,
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(input.address ? { address: input.address.trim() } : {}),
      ...(input.description ? { description: input.description.trim() } : {}),
      status: nextStatus,
    });
  }

  async archive(ownerId: string, id: string) {
    await this.ownedVenue(ownerId, id);
    const archived = await this.repository.archiveVenueIfNoBookings(
      id,
      new Date(),
    );
    if (!archived) {
      throw new ConflictException({
        code: "RESOURCE_HAS_ACTIVE_BOOKINGS",
        message: "Venue has current or future bookings",
      });
    }
    return archived;
  }

  async setAmenities(ownerId: string, id: string, amenityIds: string[]) {
    await this.ownedVenue(ownerId, id);
    return this.repository.setAmenities(id, [...new Set(amenityIds)]);
  }

  async addImage(
    ownerId: string,
    id: string,
    image: { id: string; objectKey: string; url: string; altText: string },
  ) {
    await this.ownedVenue(ownerId, id);
    return this.repository.addImage(id, image);
  }

  async publicImage(venueId: string, imageId: string) {
    const venue = await this.repository.findVenue(venueId);
    if (!venue || venue.status !== "APPROVED")
      throw new NotFoundException("Public image not found");
    const image = venue.images?.find((item) => item.id === imageId);
    if (!image) throw new NotFoundException("Public image not found");
    return image;
  }

  async addOffering(ownerId: string, venueId: string, input: OfferingInput) {
    await this.ownedVenue(ownerId, venueId);
    return this.repository.createOffering(venueId, input);
  }

  async updateOffering(
    ownerId: string,
    offeringId: string,
    input: Partial<OfferingInput> & { isActive?: boolean },
  ) {
    const offering = await this.repository.findOffering(offeringId);
    if (!offering) throw new NotFoundException("Offering not found");
    if (offering.ownerId !== ownerId)
      throw new ForbiddenException("Venue ownership required");
    return this.repository.updateOffering(offeringId, input);
  }

  async addCourt(ownerId: string, offeringId: string, internalName: string) {
    const offering = await this.repository.findOffering(offeringId);
    if (!offering) throw new NotFoundException("Offering not found");
    if (offering.ownerId !== ownerId)
      throw new ForbiddenException("Venue ownership required");
    return this.repository.createCourt(offeringId, internalName.trim());
  }

  async setCourtActive(ownerId: string, courtId: string, isActive: boolean) {
    const court = await this.repository.findCourt(courtId);
    if (!court) throw new NotFoundException("Court not found");
    if (court.ownerId !== ownerId)
      throw new ForbiddenException("Venue ownership required");
    const updated = await this.repository.setCourtActiveIfNoBookings(
      courtId,
      isActive,
      new Date(),
    );
    if (!updated) {
      throw new ConflictException({
        code: "RESOURCE_HAS_ACTIVE_BOOKINGS",
        message: "Court has current or future bookings",
      });
    }
    return updated;
  }

  async updateCourt(ownerId: string, courtId: string, internalName: string) {
    const court = await this.repository.findCourt(courtId);
    if (!court) throw new NotFoundException("Court not found");
    if (court.ownerId !== ownerId)
      throw new ForbiddenException("Venue ownership required");
    return this.repository.updateCourt(courtId, {
      internalName: internalName.trim(),
    });
  }

  async moderate(
    adminId: string,
    id: string,
    status: Extract<VenueStatus, "APPROVED" | "REJECTED" | "HIDDEN">,
    reason: string | null,
  ) {
    const venue = await this.repository.findVenue(id);
    if (!venue) throw new NotFoundException("Venue not found");
    if (status !== "APPROVED" && (!reason || reason.trim().length < 10)) {
      throw new BadRequestException(
        "Moderation reason must contain at least 10 characters",
      );
    }
    return this.repository.moderateVenue(
      id,
      adminId,
      status,
      reason?.trim() ?? null,
    );
  }

  referenceData() {
    return Promise.all([
      this.repository.sports(),
      this.repository.areas(),
      this.repository.amenities(),
    ]).then(([sports, areas, amenities]) => ({ sports, areas, amenities }));
  }

  private async ownedVenue(ownerId: string, id: string) {
    const venue = await this.repository.findVenue(id);
    if (!venue) throw new NotFoundException("Venue not found");
    if (venue.ownerId !== ownerId)
      throw new ForbiddenException("Venue ownership required");
    return venue;
  }

  private cleanVenue(input: VenueInput): VenueInput {
    if (
      input.latitude < -90 ||
      input.latitude > 90 ||
      input.longitude < -180 ||
      input.longitude > 180
    ) {
      throw new BadRequestException("Invalid map coordinates");
    }
    return {
      ...input,
      name: input.name.trim(),
      address: input.address.trim(),
      description: input.description.trim(),
    };
  }

  private publicVenue(
    venue: Awaited<ReturnType<VenueRepository["findVenue"]>>,
  ) {
    if (!venue) throw new NotFoundException("Public venue not found");
    return {
      id: venue.id,
      areaId: venue.areaId,
      name: venue.name,
      address: venue.address,
      description: venue.description,
      latitude: venue.latitude,
      longitude: venue.longitude,
      images: (venue.images ?? []).map(({ id, url, altText, sortOrder }) => ({
        id,
        url,
        altText,
        sortOrder,
      })),
      amenities: venue.amenities ?? [],
      offerings: (venue.offerings ?? [])
        .filter((offering) => offering.isActive)
        .map((offering) => ({
          id: offering.id,
          venueId: offering.venueId,
          sportId: offering.sportId,
          sportName: offering.sportName,
          confirmationMode: offering.confirmationMode,
          advanceBookingDays: offering.advanceBookingDays,
          cancellationNoticeMinutes: offering.cancellationNoticeMinutes,
          isActive: offering.isActive,
        })),
    };
  }
}
