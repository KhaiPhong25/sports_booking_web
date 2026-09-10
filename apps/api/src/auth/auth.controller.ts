import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import { AuthService, AuthResult } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { AuthRateLimitGuard } from "./auth-rate-limit.guard";

const refreshCookie = "sports_refresh";

@ApiTags("auth")
@UseGuards(AuthRateLimitGuard)
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post("register")
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.register(dto);
    this.writeRefreshCookie(response, result);
    return this.publicResult(result);
  }

  @HttpCode(200)
  @Post("login")
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(
      dto,
      request.get("user-agent") ?? null,
    );
    this.writeRefreshCookie(response, result);
    return this.publicResult(result);
  }

  @HttpCode(200)
  @Post("refresh")
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedOrigin(request);
    const token = request.cookies?.[refreshCookie] as string | undefined;
    if (!token) throw new UnauthorizedException("Refresh cookie is required");
    const result = await this.auth.refresh(
      token,
      request.get("user-agent") ?? null,
    );
    this.writeRefreshCookie(response, result);
    return this.publicResult(result);
  }

  @HttpCode(204)
  @Post("logout")
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedOrigin(request);
    const token = request.cookies?.[refreshCookie] as string | undefined;
    if (token) await this.auth.logout(token);
    response.clearCookie(refreshCookie, { path: "/api/v1/auth" });
  }

  private assertTrustedOrigin(request: Request): void {
    const origin = request.get("origin");
    const expected = this.config.get<string>("WEB_ORIGIN");
    if (origin && expected && origin !== expected) {
      throw new UnauthorizedException("Untrusted request origin");
    }
  }

  private writeRefreshCookie(response: Response, result: AuthResult): void {
    response.cookie(refreshCookie, result.refreshToken, {
      httpOnly: true,
      secure: this.config.get<string>("NODE_ENV") === "production",
      sameSite: "strict",
      path: "/api/v1/auth",
      expires: result.refreshExpiresAt,
    });
  }

  private publicResult(result: AuthResult) {
    return { accessToken: result.accessToken, user: result.user };
  }
}
