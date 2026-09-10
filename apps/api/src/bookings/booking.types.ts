import { BookingStatusValue } from "./booking-state-policy";

export interface BookingView {
  id: string;
  customerId: string;
  offeringId: string;
  courtId?: string;
  courtName?: string;
  customer?: { displayName: string; email: string; phone: string };
  venueId: string;
  venueName: string;
  sportName: string;
  startAt: string;
  endAt: string;
  status: BookingStatusValue;
  expiresAt: string | null;
  priceAmount: number;
  currency: string;
  slotMinutes: number;
  cancellationNoticeMinutes: number;
  confirmationModeSnapshot: "INSTANT" | "OWNER_APPROVAL";
  pricingBreakdown: unknown;
  cancellationReason: string | null;
}
