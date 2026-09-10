import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Principal } from "../auth/auth.types";
import { AccessTokenGuard } from "../common/auth/access-token.guard";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { Roles } from "../common/auth/roles.decorator";
import { RolesGuard } from "../common/auth/roles.guard";
import { RejectOwnerApplicationDto } from "./dto/reject-owner-application.dto";
import { OwnerApplicationsService } from "./owner-applications.service";
import { PaginationDto } from "../common/pagination.dto";

@ApiTags("admin-owner-applications")
@ApiBearerAuth()
@Roles("ADMIN")
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller("admin/owner-applications")
export class AdminOwnerApplicationsController {
  constructor(private readonly applications: OwnerApplicationsService) {}

  @Get()
  pending(@Query() query: PaginationDto) {
    return this.applications.pending(query.page, query.pageSize);
  }

  @Post(":id/approve")
  approve(@CurrentUser() admin: Principal, @Param("id") id: string) {
    return this.applications.approve(admin.userId, id);
  }

  @Post(":id/reject")
  reject(
    @CurrentUser() admin: Principal,
    @Param("id") id: string,
    @Body() dto: RejectOwnerApplicationDto,
  ) {
    return this.applications.reject(admin.userId, id, dto.reason);
  }
}
