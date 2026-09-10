import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import {
  PricingRepository,
  PricingRuleInput,
  PricingRuleRecord,
} from "./pricing.repository";

function mapRule(rule: {
  id: string;
  offeringId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  pricePerSlot: bigint;
}): PricingRuleRecord {
  const pricePerSlot = Number(rule.pricePerSlot);
  if (!Number.isSafeInteger(pricePerSlot)) {
    throw new Error("Pricing rule exceeds JSON safe integer");
  }
  return { ...rule, pricePerSlot };
}

@Injectable()
export class PrismaPricingRepository implements PricingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async offeringContext(id: string) {
    const offering = await this.prisma.venueSportOffering.findUnique({
      where: { id },
      select: {
        isActive: true,
        venue: { select: { id: true, ownerId: true, status: true } },
      },
    });
    return offering
      ? {
          ownerId: offering.venue.ownerId,
          venueId: offering.venue.id,
          venueStatus: offering.venue.status,
          isActive: offering.isActive,
        }
      : null;
  }
  async listRules(offeringId: string) {
    return (
      await this.prisma.pricingRule.findMany({
        where: { offeringId },
        orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
      })
    ).map(mapRule);
  }
  async findRule(id: string) {
    const rule = await this.prisma.pricingRule.findUnique({
      where: { id },
      include: {
        offering: { select: { venue: { select: { ownerId: true } } } },
      },
    });
    return rule
      ? { ...mapRule(rule), ownerId: rule.offering.venue.ownerId }
      : null;
  }
  async createRule(offeringId: string, input: PricingRuleInput) {
    return mapRule(
      await this.prisma.pricingRule.create({
        data: {
          ...input,
          offeringId,
          pricePerSlot: BigInt(input.pricePerSlot),
        },
      }),
    );
  }
  async updateRule(id: string, input: PricingRuleInput) {
    return mapRule(
      await this.prisma.pricingRule.update({
        where: { id },
        data: { ...input, pricePerSlot: BigInt(input.pricePerSlot) },
      }),
    );
  }
  async deleteRule(id: string) {
    await this.prisma.pricingRule.delete({ where: { id } });
  }
  async hasOverlap(
    offeringId: string,
    input: PricingRuleInput,
    excludeId?: string,
  ) {
    return (
      (await this.prisma.pricingRule.count({
        where: {
          offeringId,
          weekday: input.weekday,
          ...(excludeId ? { id: { not: excludeId } } : {}),
          startMinute: { lt: input.endMinute },
          endMinute: { gt: input.startMinute },
        },
      })) > 0
    );
  }
  async quoteInputs(offeringId: string) {
    const context = await this.prisma.venueSportOffering.findUniqueOrThrow({
      where: { id: offeringId },
      select: { venueId: true },
    });
    const [operatingHours, closures, pricingRules] = await Promise.all([
      this.prisma.operatingHour.findMany({
        where: { venueId: context.venueId },
      }),
      this.prisma.venueClosure.findMany({
        where: { venueId: context.venueId, courtId: null },
        select: { startAt: true, endAt: true },
      }),
      this.listRules(offeringId),
    ]);
    return { operatingHours, closures, pricingRules };
  }
}
