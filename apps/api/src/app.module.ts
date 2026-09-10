import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnvironment } from "./config/environment";
import { HealthController } from "./health/health.controller";
import { ReadinessService } from "./health/readiness.service";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { OwnerApplicationsModule } from "./owner-applications/owner-applications.module";
import { VenuesModule } from "./venues/venues.module";
import { SchedulingModule } from "./scheduling/scheduling.module";
import { PricingModule } from "./pricing/pricing.module";
import { BookingsModule } from "./bookings/bookings.module";
import { NotificationsModule } from "./notifications/notifications.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    OwnerApplicationsModule,
    VenuesModule,
    SchedulingModule,
    PricingModule,
    BookingsModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: ReadinessService, useFactory: () => new ReadinessService() },
  ],
})
export class AppModule {}
