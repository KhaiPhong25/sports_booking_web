import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Principal } from "../auth/auth.types";
import { AccessTokenGuard } from "../common/auth/access-token.guard";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { CreateOwnerApplicationDto } from "./dto/create-owner-application.dto";
import { OwnerApplicationsService } from "./owner-applications.service";
import { PaginationDto } from "../common/pagination.dto";

@ApiTags("owner-applications")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller("owner-applications")
export class OwnerApplicationsController {
  constructor(private readonly applications: OwnerApplicationsService) {}

  @Post()
  submit(
    @CurrentUser() user: Principal,
    @Body() dto: CreateOwnerApplicationDto,
  ) {
    return this.applications.submit(user.userId, dto);
  }

  @Get()
  mine(@CurrentUser() user: Principal, @Query() query: PaginationDto) {
    return this.applications.mine(user.userId, query.page, query.pageSize);
  }
}
