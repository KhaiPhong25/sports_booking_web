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
import { ModerationDto } from "./dto/venue.dto";
import { VenuesService } from "./venues.service";
import { PaginationDto } from "../common/pagination.dto";

@ApiTags("admin-venues")
@ApiBearerAuth()
@Roles("ADMIN")
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller("admin/venues")
export class AdminVenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Get()
  pending(@Query() query: PaginationDto) {
    return this.venues.pendingList(query.page, query.pageSize);
  }

  @Post(":id/approve")
  approve(@CurrentUser() admin: Principal, @Param("id") id: string) {
    return this.venues.moderate(admin.userId, id, "APPROVED", null);
  }

  @Post(":id/reject")
  reject(
    @CurrentUser() admin: Principal,
    @Param("id") id: string,
    @Body() dto: ModerationDto,
  ) {
    return this.venues.moderate(
      admin.userId,
      id,
      "REJECTED",
      dto.reason ?? null,
    );
  }

  @Post(":id/hide")
  hide(
    @CurrentUser() admin: Principal,
    @Param("id") id: string,
    @Body() dto: ModerationDto,
  ) {
    return this.venues.moderate(admin.userId, id, "HIDDEN", dto.reason ?? null);
  }
}
