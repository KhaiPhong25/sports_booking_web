import { Controller, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AccessTokenGuard } from "../common/auth/access-token.guard";
import { Roles } from "../common/auth/roles.decorator";
import { RolesGuard } from "../common/auth/roles.guard";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { Principal } from "../auth/auth.types";
import { UsersService } from "./users.service";

@ApiTags("admin-users")
@ApiBearerAuth()
@Roles("ADMIN")
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller("admin/users")
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Patch(":id/lock")
  lock(@CurrentUser() admin: Principal, @Param("id") id: string) {
    return this.users.setLocked(id, true, admin.userId);
  }

  @Patch(":id/unlock")
  unlock(@CurrentUser() admin: Principal, @Param("id") id: string) {
    return this.users.setLocked(id, false, admin.userId);
  }
}
