import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Principal } from "../auth/auth.types";
import { AccessTokenGuard } from "../common/auth/access-token.guard";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { Roles } from "../common/auth/roles.decorator";
import { RolesGuard } from "../common/auth/roles.guard";
import { ClosureDto, ReplaceOperatingHoursDto } from "./dto/scheduling.dto";
import { SchedulingService } from "./scheduling.service";

@ApiTags("owner-scheduling")
@ApiBearerAuth()
@Roles("OWNER")
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller("owner")
export class OwnerSchedulingController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Get("venues/:venueId/operating-hours")
  hours(@CurrentUser() owner: Principal, @Param("venueId") venueId: string) {
    return this.scheduling.listHours(owner.userId, venueId);
  }

  @Put("venues/:venueId/operating-hours")
  replaceHours(
    @CurrentUser() owner: Principal,
    @Param("venueId") venueId: string,
    @Body() dto: ReplaceOperatingHoursDto,
  ) {
    return this.scheduling.replaceHours(owner.userId, venueId, dto.windows);
  }

  @Get("venues/:venueId/closures")
  closures(@CurrentUser() owner: Principal, @Param("venueId") venueId: string) {
    return this.scheduling.listClosures(owner.userId, venueId);
  }

  @Post("venues/:venueId/closures")
  createClosure(
    @CurrentUser() owner: Principal,
    @Param("venueId") venueId: string,
    @Body() dto: ClosureDto,
  ) {
    return this.scheduling.createClosure(owner.userId, venueId, {
      ...dto,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
    });
  }

  @Patch("closures/:id")
  updateClosure(
    @CurrentUser() owner: Principal,
    @Param("id") id: string,
    @Body() dto: ClosureDto,
  ) {
    return this.scheduling.updateClosure(owner.userId, id, {
      ...dto,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
    });
  }

  @Delete("closures/:id")
  @HttpCode(204)
  deleteClosure(@CurrentUser() owner: Principal, @Param("id") id: string) {
    return this.scheduling.deleteClosure(owner.userId, id);
  }
}
