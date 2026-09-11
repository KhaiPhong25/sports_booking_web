import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminAuditLogsController } from "./admin-audit-logs.controller";
import { AuditLogsService } from "./audit-logs.service";

@Module({
  imports: [AuthModule],
  controllers: [AdminAuditLogsController],
  providers: [AuditLogsService],
})
export class AuditLogsModule {}
