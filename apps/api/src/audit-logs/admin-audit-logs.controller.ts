import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AccessTokenGuard } from "../common/auth/access-token.guard";
import { Roles } from "../common/auth/roles.decorator";
import { RolesGuard } from "../common/auth/roles.guard";
import { AuditLogQueryDto } from "./dto/audit-log-query.dto";
import { AuditLogsService } from "./audit-logs.service";

@ApiTags("admin-audit-logs")
@ApiBearerAuth()
@Roles("ADMIN")
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller("admin/audit-logs")
export class AdminAuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  list(@Query() query: AuditLogQueryDto) {
    return this.auditLogs.list(query);
  }
}
