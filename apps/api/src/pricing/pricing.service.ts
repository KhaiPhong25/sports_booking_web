import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { SchedulePolicy } from "../scheduling/schedule-policy";
import {
  PricingEngine,
  PricingNotCoveredError,
  QuoteIntervalError,
} from "./pricing-engine";
import {
  PRICING_REPOSITORY,
  PricingRepository,
  PricingRuleInput,
} from "./pricing.repository";

@Injectable()
export class PricingService {
  private readonly schedulePolicy = new SchedulePolicy();

  constructor(
    @Inject(PRICING_REPOSITORY) private readonly repository: PricingRepository,
    private readonly engine: PricingEngine,
  ) {}

  async listRules(ownerId: string, offeringId: string) {
    await this.assertOwner(ownerId, offeringId);
    return this.repository.listRules(offeringId);
  }
  async createRule(
    ownerId: string,
    offeringId: string,
    input: PricingRuleInput,
  ) {
    await this.assertOwner(ownerId, offeringId);
    this.validateRule(input);
    await this.assertNoOverlap(offeringId, input);
    try {
      return await this.repository.createRule(offeringId, input);
    } catch (error) {
      this.rethrowOverlapConstraint(error);
    }
  }
  async updateRule(ownerId: string, id: string, input: PricingRuleInput) {
    const rule = await this.repository.findRule(id);
    if (!rule) throw new NotFoundException("Pricing rule not found");
    if (rule.ownerId !== ownerId)
      throw new ForbiddenException("Venue ownership required");
    this.validateRule(input);
    await this.assertNoOverlap(rule.offeringId, input, id);
    try {
      return await this.repository.updateRule(id, input);
    } catch (error) {
      this.rethrowOverlapConstraint(error);
    }
  }
  async deleteRule(ownerId: string, id: string) {
    const rule = await this.repository.findRule(id);
    if (!rule) throw new NotFoundException("Pricing rule not found");
    if (rule.ownerId !== ownerId)
      throw new ForbiddenException("Venue ownership required");
    await this.repository.deleteRule(id);
  }
  async quote(offeringId: string, interval: { startAt: Date; endAt: Date }) {
    const context = await this.repository.offeringContext(offeringId);
    if (!context || context.venueStatus !== "APPROVED" || !context.isActive) {
      throw new NotFoundException("Public offering not found");
    }
    const inputs = await this.repository.quoteInputs(offeringId);
    try {
      return this.engine.quote({ ...interval, ...inputs });
    } catch (error) {
      if (error instanceof PricingNotCoveredError) {
        throw new UnprocessableEntityException({
          code: "PRICING_NOT_COVERED",
          message: error.message,
        });
      }
      if (error instanceof QuoteIntervalError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private validateRule(input: PricingRuleInput) {
    try {
      this.schedulePolicy.validateWeeklyWindows([input]);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    if (!Number.isSafeInteger(input.pricePerSlot) || input.pricePerSlot <= 0) {
      throw new BadRequestException("Price must be a positive VND integer");
    }
  }
  private async assertOwner(ownerId: string, offeringId: string) {
    const context = await this.repository.offeringContext(offeringId);
    if (!context) throw new NotFoundException("Offering not found");
    if (context.ownerId !== ownerId)
      throw new ForbiddenException("Venue ownership required");
  }

  private async assertNoOverlap(
    offeringId: string,
    input: PricingRuleInput,
    excludeId?: string,
  ) {
    if (await this.repository.hasOverlap(offeringId, input, excludeId)) {
      throw new ConflictException({
        code: "PRICING_RULE_OVERLAP",
        message: "Pricing rules cannot overlap for one weekday",
      });
    }
  }

  private rethrowOverlapConstraint(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2004"
    ) {
      throw new ConflictException({
        code: "PRICING_RULE_OVERLAP",
        message: "Pricing rules cannot overlap for one weekday",
      });
    }
    throw error;
  }
}
