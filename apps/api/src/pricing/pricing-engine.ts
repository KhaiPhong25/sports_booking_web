import {
  SLOT_MINUTES,
  overlaps,
  toBusinessDateTime,
} from "../scheduling/business-time";
import { WeeklyWindow } from "../scheduling/schedule-policy";

export interface PricingRuleValue extends WeeklyWindow {
  id: string;
  pricePerSlot: number;
}

export interface ClosureValue {
  startAt: Date;
  endAt: Date;
}

export interface PriceQuote {
  amount: number;
  currency: "VND";
  slotMinutes: 30;
  breakdown: Array<{
    ruleId: string;
    startAt: string;
    endAt: string;
    amount: number;
  }>;
}

export class QuoteIntervalError extends Error {}
export class PricingNotCoveredError extends Error {}

export class PricingEngine {
  quote(input: {
    startAt: Date;
    endAt: Date;
    operatingHours: WeeklyWindow[];
    closures: ClosureValue[];
    pricingRules: PricingRuleValue[];
  }): PriceQuote {
    const { startAt, endAt } = input;
    const durationMs = endAt.getTime() - startAt.getTime();
    const slotMs = SLOT_MINUTES * 60_000;
    if (
      Number.isNaN(durationMs) ||
      durationMs <= 0 ||
      durationMs % slotMs !== 0
    ) {
      throw new QuoteIntervalError("Interval must use 30-minute slots");
    }
    const startLocal = toBusinessDateTime(startAt);
    const endLocal = toBusinessDateTime(endAt);
    if (
      startLocal.date !== endLocal.date ||
      startLocal.second !== 0 ||
      endLocal.second !== 0 ||
      startLocal.minute % SLOT_MINUTES !== 0 ||
      endLocal.minute % SLOT_MINUTES !== 0
    ) {
      throw new QuoteIntervalError("Interval must stay in one business date");
    }
    const openingWindow = input.operatingHours.find(
      (window) =>
        window.weekday === startLocal.weekday &&
        window.startMinute <= startLocal.minute &&
        endLocal.minute <= window.endMinute,
    );
    if (!openingWindow) {
      throw new QuoteIntervalError("Interval is outside operating hours");
    }
    if (
      input.closures.some((closure) =>
        overlaps(startAt, endAt, closure.startAt, closure.endAt),
      )
    ) {
      throw new QuoteIntervalError("Interval overlaps a closure");
    }

    const breakdown: PriceQuote["breakdown"] = [];
    for (
      let slotStartMs = startAt.getTime();
      slotStartMs < endAt.getTime();
      slotStartMs += slotMs
    ) {
      const slotStart = new Date(slotStartMs);
      const slotEnd = new Date(slotStartMs + slotMs);
      const local = toBusinessDateTime(slotStart);
      const matches = input.pricingRules.filter(
        (rule) =>
          rule.weekday === local.weekday &&
          rule.startMinute <= local.minute &&
          local.minute + SLOT_MINUTES <= rule.endMinute,
      );
      if (matches.length !== 1) {
        throw new PricingNotCoveredError(
          "Every slot must be covered by exactly one pricing rule",
        );
      }
      const rule = matches[0];
      if (!rule) throw new PricingNotCoveredError("Pricing rule is missing");
      breakdown.push({
        ruleId: rule.id,
        startAt: slotStart.toISOString(),
        endAt: slotEnd.toISOString(),
        amount: rule.pricePerSlot,
      });
    }
    const amount = breakdown.reduce((sum, slot) => sum + slot.amount, 0);
    if (!Number.isSafeInteger(amount)) {
      throw new PricingNotCoveredError(
        "Quoted amount exceeds JSON safe integer",
      );
    }
    return { amount, currency: "VND", slotMinutes: 30, breakdown };
  }
}
