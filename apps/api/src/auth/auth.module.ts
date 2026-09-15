import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AccessTokenGuard } from "../common/auth/access-token.guard";
import { RolesGuard } from "../common/auth/roles.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { IDENTITY_REPOSITORY } from "./identity.repository";
import { PasswordService } from "./password.service";
import { PrismaIdentityRepository } from "./prisma-identity.repository";
import { TokenService } from "./token.service";
import { AuthRateLimitGuard } from "./auth-rate-limit.guard";
import { AuthRateLimitService } from "./auth-rate-limit.service";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    PrismaIdentityRepository,
    { provide: IDENTITY_REPOSITORY, useExisting: PrismaIdentityRepository },
    {
      provide: TokenService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new TokenService(
          config.getOrThrow<string>("JWT_ACCESS_SECRET"),
          config.getOrThrow<string>("JWT_REFRESH_SECRET"),
        ),
    },
    AccessTokenGuard,
    RolesGuard,
    AuthRateLimitService,
    AuthRateLimitGuard,
  ],
  exports: [
    AuthService,
    IDENTITY_REPOSITORY,
    AccessTokenGuard,
    RolesGuard,
    AuthRateLimitGuard,
    AuthRateLimitService,
  ],
})
export class AuthModule {}
