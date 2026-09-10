import { randomUUID } from "node:crypto";
import {
  OfferingPricingContext,
  PricingRepository,
  PricingRuleInput,
  PricingRuleRecord,
} from "../pricing.repository";

export class InMemoryPricingRepository implements PricingRepository {
  readonly offerings = new Map<string, OfferingPricingContext>();
  readonly rules = new Map<string, PricingRuleRecord>();
  readonly hours = new Map<
    string,
    Array<{ weekday: number; startMinute: number; endMinute: number }>
  >();
  readonly closures = new Map<string, Array<{ startAt: Date; endAt: Date }>>();

  async offeringContext(id: string) {
    return structuredClone(this.offerings.get(id) ?? null);
  }
  async listRules(offeringId: string) {
    return structuredClone(
      [...this.rules.values()].filter((rule) => rule.offeringId === offeringId),
    );
  }
  async findRule(id: string) {
    const rule = this.rules.get(id);
    const context = rule ? this.offerings.get(rule.offeringId) : null;
    return rule && context
      ? { ...structuredClone(rule), ownerId: context.ownerId }
      : null;
  }
  async createRule(offeringId: string, input: PricingRuleInput) {
    const record = { id: randomUUID(), offeringId, ...input };
    this.rules.set(record.id, record);
    return structuredClone(record);
  }
  async updateRule(id: string, input: PricingRuleInput) {
    const rule = this.rules.get(id);
    if (!rule) throw new Error("Pricing rule not found");
    Object.assign(rule, input);
    return structuredClone(rule);
  }
  async deleteRule(id: string) {
    this.rules.delete(id);
  }
  async hasOverlap(
    offeringId: string,
    input: PricingRuleInput,
    excludeId?: string,
  ) {
    return [...this.rules.values()].some(
      (rule) =>
        rule.id !== excludeId &&
        rule.offeringId === offeringId &&
        rule.weekday === input.weekday &&
        rule.startMinute < input.endMinute &&
        input.startMinute < rule.endMinute,
    );
  }
  async quoteInputs(offeringId: string) {
    return {
      operatingHours: structuredClone(this.hours.get(offeringId) ?? []),
      closures: structuredClone(this.closures.get(offeringId) ?? []),
      pricingRules: await this.listRules(offeringId),
    };
  }
}
