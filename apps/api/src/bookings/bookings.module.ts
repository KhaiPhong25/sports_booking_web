import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PricingModule } from "../pricing/pricing.module";
import {
  AvailabilityController,
  CustomerBookingsController,
  OwnerBookingsController,
} from "./bookings.controller";
import { BookingsService } from "./bookings.service";

@Module({
  imports: [AuthModule, PricingModule],
  controllers: [
    AvailabilityController,
    CustomerBookingsController,
    OwnerBookingsController,
  ],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
