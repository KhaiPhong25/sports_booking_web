import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminOwnerApplicationsController } from "./admin-owner-applications.controller";
import { OWNER_APPLICATION_REPOSITORY } from "./owner-application.repository";
import { OwnerApplicationsController } from "./owner-applications.controller";
import { OwnerApplicationsService } from "./owner-applications.service";
import { PrismaOwnerApplicationRepository } from "./prisma-owner-application.repository";

@Module({
  imports: [AuthModule],
  controllers: [OwnerApplicationsController, AdminOwnerApplicationsController],
  providers: [
    OwnerApplicationsService,
    PrismaOwnerApplicationRepository,
    {
      provide: OWNER_APPLICATION_REPOSITORY,
      useExisting: PrismaOwnerApplicationRepository,
    },
  ],
})
export class OwnerApplicationsModule {}
