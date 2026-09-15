import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from "../auth/auth-cookie";
import { AuthRateLimitGuard } from "../auth/auth-rate-limit.guard";
import { AuthService } from "../auth/auth.service";
import { Principal } from "../auth/auth.types";
import { AccessTokenGuard } from "../common/auth/access-token.guard";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller("me")
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  profile(@CurrentUser() user: Principal) {
    return this.users.profile(user.userId);
  }

  @Patch()
  update(@CurrentUser() user: Principal, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.userId, dto);
  }

  @UseGuards(AuthRateLimitGuard)
  @HttpCode(204)
  @Patch("password")
  async changePassword(
    @CurrentUser() user: Principal,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.changePassword(
      user.userId,
      dto.currentPassword,
      dto.newPassword,
    );
    response.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  }
}
