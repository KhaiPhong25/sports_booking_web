import { ClosureValue, PricingRuleValue } from "./pricing-engine";
import { WeeklyWindow } from "../scheduling/schedule-policy";

export const PRICING_REPOSITORY = Symbol("PRICING_REPOSITORY");

export interface PricingRuleInput {
  weekday: number;
  startMinute: number;
  endMinute: number;
  pricePerSlot: number;
}

export interface PricingRuleRecord extends PricingRuleValue {
  offeringId: string;
}

export interface OfferingPricingContext {
  ownerId: string;
  venueId: string;
  venueStatus: string;
  isActive: boolean;
}

export interface PricingRepository {
  offeringContext(id: string): Promise<OfferingPricingContext | null>;
  listRules(offeringId: string): Promise<PricingRuleRecord[]>;
  findRule(
    id: string,
  ): Promise<(PricingRuleRecord & { ownerId: string }) | null>;
  createRule(
    offeringId: string,
    input: PricingRuleInput,
  ): Promise<PricingRuleRecord>;
  updateRule(id: string, input: PricingRuleInput): Promise<PricingRuleRecord>;
  deleteRule(id: string): Promise<void>;
  hasOverlap(
    offeringId: string,
    input: PricingRuleInput,
    excludeId?: string,
  ): Promise<boolean>;
  quoteInputs(offeringId: string): Promise<{
    operatingHours: WeeklyWindow[];
    closures: ClosureValue[];
    pricingRules: PricingRuleRecord[];
  }>;
}
