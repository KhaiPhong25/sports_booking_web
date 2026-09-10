import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OwnerSchedulingController } from "./owner-scheduling.controller";
import { PrismaSchedulingRepository } from "./prisma-scheduling.repository";
import { SCHEDULING_REPOSITORY } from "./scheduling.repository";
import { SchedulingService } from "./scheduling.service";

@Module({
  imports: [AuthModule],
  controllers: [OwnerSchedulingController],
  providers: [
    SchedulingService,
    PrismaSchedulingRepository,
    {
      provide: SCHEDULING_REPOSITORY,
      useExisting: PrismaSchedulingRepository,
    },
  ],
  exports: [SchedulingService],
})
export class SchedulingModule {}
