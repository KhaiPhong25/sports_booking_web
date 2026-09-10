import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BookingsModule } from "../bookings/bookings.module";
import { StorageModule } from "../storage/storage.module";
import { AdminVenuesController } from "./admin-venues.controller";
import { OwnerVenuesController } from "./owner-venues.controller";
import { PrismaVenueRepository } from "./prisma-venue.repository";
import { PublicVenuesController } from "./public-venues.controller";
import { VENUE_REPOSITORY } from "./venue.repository";
import { VenuesService } from "./venues.service";

@Module({
  imports: [AuthModule, StorageModule, BookingsModule],
  controllers: [
    PublicVenuesController,
    OwnerVenuesController,
    AdminVenuesController,
  ],
  providers: [
    VenuesService,
    PrismaVenueRepository,
    { provide: VENUE_REPOSITORY, useExisting: PrismaVenueRepository },
  ],
})
export class VenuesModule {}
