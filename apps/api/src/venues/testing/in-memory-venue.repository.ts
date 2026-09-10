import { randomUUID } from "node:crypto";
import {
  CourtRecord,
  OfferingInput,
  OfferingRecord,
  VenueInput,
  VenueRecord,
  VenueRepository,
  VenueStatus,
} from "../venue.repository";

export class InMemoryVenueRepository implements VenueRepository {
  readonly venues = new Map<string, VenueRecord>();
  readonly offerings = new Map<string, OfferingRecord>();
  readonly courts = new Map<string, CourtRecord>();
  readonly futureBookedCourtIds = new Set<string>();
  readonly futureBookedVenueIds = new Set<string>();
  readonly audits: Array<{
    actorId: string;
    action: string;
    resourceId: string;
  }> = [];

  async createVenue(ownerId: string, input: VenueInput): Promise<VenueRecord> {
    const venue: VenueRecord = {
      id: randomUUID(),
      ownerId,
      ...input,
      status: "PENDING_APPROVAL",
      moderationReason: null,
      images: [],
      amenities: [],
      offerings: [],
    };
    this.venues.set(venue.id, venue);
    return structuredClone(venue);
  }

  async findVenue(id: string): Promise<VenueRecord | null> {
    const venue = this.venues.get(id);
    return venue ? this.withInventory(venue) : null;
  }

  async publicVenues(
    skip: number,
    take: number,
    filters: { sportId?: string; areaId?: string } = {},
  ) {
    const all = [...this.venues.values()]
      .filter((venue) => venue.status === "APPROVED")
      .map((venue) => this.withInventory(venue))
      .filter(
        (venue) =>
          (!filters.areaId || venue.areaId === filters.areaId) &&
          (!filters.sportId ||
            venue.offerings?.some(
              (offering) =>
                offering.sportId === filters.sportId && offering.isActive,
            )),
      );
    return { items: all.slice(skip, skip + take), total: all.length };
  }

  async pendingVenues(skip: number, take: number) {
    const all = [...this.venues.values()]
      .filter((venue) => venue.status === "PENDING_APPROVAL")
      .map((venue) => this.withInventory(venue));
    return { items: all.slice(skip, skip + take), total: all.length };
  }

  async ownerVenues(ownerId: string, skip: number, take: number) {
    const all = [...this.venues.values()]
      .filter((venue) => venue.ownerId === ownerId)
      .map((venue) => this.withInventory(venue));
    return { items: all.slice(skip, skip + take), total: all.length };
  }

  async updateVenue(
    id: string,
    input: Partial<VenueInput> & { status?: VenueStatus },
  ): Promise<VenueRecord> {
    const venue = this.venues.get(id);
    if (!venue) throw new Error("Venue not found");
    Object.assign(venue, input);
    return this.withInventory(venue);
  }

  async moderateVenue(
    id: string,
    adminId: string,
    status: VenueStatus,
    reason: string | null,
  ): Promise<VenueRecord> {
    const venue = this.venues.get(id);
    if (!venue) throw new Error("Venue not found");
    venue.status = status;
    venue.moderationReason = reason;
    this.audits.push({
      actorId: adminId,
      action: `VENUE_${status}`,
      resourceId: id,
    });
    return this.withInventory(venue);
  }

  async setAmenities(id: string, amenityIds: string[]): Promise<VenueRecord> {
    const venue = this.venues.get(id);
    if (!venue) throw new Error("Venue not found");
    venue.amenities = amenityIds.map((amenityId) => ({
      id: amenityId,
      code: amenityId,
      name: amenityId,
    }));
    return this.withInventory(venue);
  }

  async addImage(
    id: string,
    image: { id: string; objectKey: string; url: string; altText: string },
  ): Promise<VenueRecord> {
    const venue = this.venues.get(id);
    if (!venue) throw new Error("Venue not found");
    venue.images ??= [];
    venue.images.push({ ...image, sortOrder: venue.images.length });
    return this.withInventory(venue);
  }

  async createOffering(
    venueId: string,
    input: OfferingInput,
  ): Promise<OfferingRecord> {
    const record = {
      id: randomUUID(),
      venueId,
      ...input,
      isActive: true,
      courts: [],
    };
    this.offerings.set(record.id, record);
    return structuredClone(record);
  }

  async findOffering(
    id: string,
  ): Promise<(OfferingRecord & { ownerId: string }) | null> {
    const offering = this.offerings.get(id);
    const venue = offering ? this.venues.get(offering.venueId) : null;
    return offering && venue
      ? { ...structuredClone(offering), ownerId: venue.ownerId }
      : null;
  }

  async updateOffering(
    id: string,
    input: Partial<OfferingInput> & { isActive?: boolean },
  ): Promise<OfferingRecord> {
    const offering = this.offerings.get(id);
    if (!offering) throw new Error("Offering not found");
    Object.assign(offering, input);
    return structuredClone(offering);
  }

  async createCourt(
    offeringId: string,
    internalName: string,
  ): Promise<CourtRecord> {
    const court = {
      id: randomUUID(),
      offeringId,
      internalName,
      isActive: true,
    };
    this.courts.set(court.id, court);
    return structuredClone(court);
  }

  async findCourt(
    id: string,
  ): Promise<(CourtRecord & { ownerId: string }) | null> {
    const court = this.courts.get(id);
    const offering = court ? this.offerings.get(court.offeringId) : null;
    const venue = offering ? this.venues.get(offering.venueId) : null;
    return court && venue
      ? { ...structuredClone(court), ownerId: venue.ownerId }
      : null;
  }

  async updateCourt(
    id: string,
    input: { internalName?: string; isActive?: boolean },
  ): Promise<CourtRecord> {
    const court = this.courts.get(id);
    if (!court) throw new Error("Court not found");
    Object.assign(court, input);
    return structuredClone(court);
  }

  async hasFutureOccupyingBookingForVenue(venueId: string) {
    return this.futureBookedVenueIds.has(venueId);
  }

  async hasFutureOccupyingBookingForCourt(courtId: string) {
    return this.futureBookedCourtIds.has(courtId);
  }

  async archiveVenueIfNoBookings(venueId: string) {
    if (this.futureBookedVenueIds.has(venueId)) return null;
    return this.updateVenue(venueId, { status: "ARCHIVED" });
  }

  async setCourtActiveIfNoBookings(courtId: string, isActive: boolean) {
    if (!isActive && this.futureBookedCourtIds.has(courtId)) return null;
    return this.updateCourt(courtId, { isActive });
  }

  async sports() {
    return [{ id: "sport-badminton", code: "BADMINTON", name: "Cầu lông" }];
  }
  async areas() {
    return [{ id: "area-1", code: "Q1", name: "Quận 1", type: "district" }];
  }
  async amenities() {
    return [{ id: "parking", code: "PARKING", name: "Bãi đỗ xe" }];
  }

  private withInventory(venue: VenueRecord): VenueRecord {
    const offerings = [...this.offerings.values()]
      .filter((offering) => offering.venueId === venue.id)
      .map((offering) => ({
        ...offering,
        courts: [...this.courts.values()].filter(
          (court) => court.offeringId === offering.id,
        ),
      }));
    return structuredClone({ ...venue, offerings });
  }
}
