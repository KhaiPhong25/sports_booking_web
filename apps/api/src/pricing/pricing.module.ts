import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PricingEngine } from "./pricing-engine";
import {
  OwnerPricingController,
  PublicPricingController,
} from "./pricing.controller";
import { PRICING_REPOSITORY } from "./pricing.repository";
import { PrismaPricingRepository } from "./prisma-pricing.repository";
import { PricingService } from "./pricing.service";

@Module({
  imports: [AuthModule],
  controllers: [PublicPricingController, OwnerPricingController],
  providers: [
    PricingEngine,
    PricingService,
    PrismaPricingRepository,
    { provide: PRICING_REPOSITORY, useExisting: PrismaPricingRepository },
  ],
  exports: [PricingEngine, PricingService, PRICING_REPOSITORY],
})
export class PricingModule {}
