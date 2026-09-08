import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnvironment } from "./config/environment";
import { HealthController } from "./health/health.controller";
import { ReadinessService } from "./health/readiness.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
  ],
  controllers: [HealthController],
  providers: [
    { provide: ReadinessService, useFactory: () => new ReadinessService() },
  ],
})
export class AppModule {}
