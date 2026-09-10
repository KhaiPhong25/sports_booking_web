export const VENUE_REPOSITORY = Symbol("VENUE_REPOSITORY");

export type VenueStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "HIDDEN"
  | "ARCHIVED";
export type ConfirmationMode = "INSTANT" | "OWNER_APPROVAL";

export interface VenueRecord {
  id: string;
  ownerId: string;
  areaId: string;
  name: string;
  address: string;
  description: string;
  latitude: number;
  longitude: number;
  status: VenueStatus;
  moderationReason: string | null;
  images?: Array<{
    id: string;
    objectKey: string;
    url: string;
    altText: string;
    sortOrder: number;
  }>;
  amenities?: Array<{ id: string; code: string; name: string }>;
  offerings?: OfferingRecord[];
}

export interface OfferingRecord {
  id: string;
  venueId: string;
  sportId: string;
  confirmationMode: ConfirmationMode;
  advanceBookingDays: number;
  cancellationNoticeMinutes: number;
  isActive: boolean;
  courts?: CourtRecord[];
}

export interface CourtRecord {
  id: string;
  offeringId: string;
  internalName: string;
  isActive: boolean;
}

export interface VenueInput {
  areaId: string;
  name: string;
  address: string;
  description: string;
  latitude: number;
  longitude: number;
}

export interface OfferingInput {
  sportId: string;
  confirmationMode: ConfirmationMode;
  advanceBookingDays: number;
  cancellationNoticeMinutes: number;
}

export interface VenueRepository {
  createVenue(ownerId: string, input: VenueInput): Promise<VenueRecord>;
  findVenue(id: string): Promise<VenueRecord | null>;
  publicVenues(
    skip: number,
    take: number,
    filters?: { sportId?: string; areaId?: string },
  ): Promise<{ items: VenueRecord[]; total: number }>;
  pendingVenues(
    skip: number,
    take: number,
  ): Promise<{ items: VenueRecord[]; total: number }>;
  ownerVenues(
    ownerId: string,
    skip: number,
    take: number,
  ): Promise<{ items: VenueRecord[]; total: number }>;
  updateVenue(
    id: string,
    input: Partial<VenueInput> & { status?: VenueStatus },
  ): Promise<VenueRecord>;
  moderateVenue(
    id: string,
    adminId: string,
    status: VenueStatus,
    reason: string | null,
  ): Promise<VenueRecord>;
  setAmenities(id: string, amenityIds: string[]): Promise<VenueRecord>;
  addImage(
    id: string,
    image: { id: string; objectKey: string; url: string; altText: string },
  ): Promise<VenueRecord>;
  createOffering(
    venueId: string,
    input: OfferingInput,
  ): Promise<OfferingRecord>;
  findOffering(
    id: string,
  ): Promise<(OfferingRecord & { ownerId: string }) | null>;
  updateOffering(
    id: string,
    input: Partial<OfferingInput> & { isActive?: boolean },
  ): Promise<OfferingRecord>;
  createCourt(offeringId: string, internalName: string): Promise<CourtRecord>;
  findCourt(id: string): Promise<(CourtRecord & { ownerId: string }) | null>;
  updateCourt(
    id: string,
    input: { internalName?: string; isActive?: boolean },
  ): Promise<CourtRecord>;
  hasFutureOccupyingBookingForVenue(
    venueId: string,
    now: Date,
  ): Promise<boolean>;
  hasFutureOccupyingBookingForCourt(
    courtId: string,
    now: Date,
  ): Promise<boolean>;
  archiveVenueIfNoBookings(
    venueId: string,
    now: Date,
  ): Promise<VenueRecord | null>;
  setCourtActiveIfNoBookings(
    courtId: string,
    isActive: boolean,
    now: Date,
  ): Promise<CourtRecord | null>;
  sports(): Promise<Array<{ id: string; code: string; name: string }>>;
  areas(): Promise<
    Array<{ id: string; code: string; name: string; type: string }>
  >;
  amenities(): Promise<Array<{ id: string; code: string; name: string }>>;
}
