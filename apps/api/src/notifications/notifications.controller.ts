import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
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
import { NotificationListDto } from "./dto/notification-list.dto";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@ApiBearerAuth()
@Roles("CUSTOMER")
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() principal: Principal,
    @Query() query: NotificationListDto,
  ) {
    return this.notifications.list(principal.userId, query);
  }

  @Post(":id/read")
  @HttpCode(200)
  markRead(
    @CurrentUser() principal: Principal,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.notifications.markRead(principal.userId, id);
  }
}
