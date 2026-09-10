import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "node:crypto";
import { Principal, SessionTokens } from "./auth.types";

export interface RefreshClaims extends Principal {
  sub: string;
  sid: string;
  fid: string;
  type: "refresh";
  exp: number;
}

interface AccessClaims extends Principal {
  sub: string;
  type: "access";
}

@Injectable()
export class TokenService {
  private readonly jwt = new JwtService();

  constructor(
    private readonly accessSecret: string,
    private readonly refreshSecret: string,
  ) {}

  async issue(
    principal: Principal,
    familyId: string = randomUUID(),
    sessionId: string = randomUUID(),
  ): Promise<SessionTokens & { familyId: string; sessionId: string }> {
    const accessPayload: AccessClaims = {
      ...principal,
      sub: principal.userId,
      type: "access",
    };
    const refreshPayload = {
      ...principal,
      sub: principal.userId,
      sid: sessionId,
      fid: familyId,
      type: "refresh" as const,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.accessSecret,
        expiresIn: "15m",
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.refreshSecret,
        expiresIn: "7d",
      }),
    ]);
    const decoded = this.jwt.decode(refreshToken) as { exp: number };
    return {
      accessToken,
      refreshToken,
      familyId,
      sessionId,
      refreshExpiresAt: new Date(decoded.exp * 1000),
    };
  }

  verifyAccess(token: string): Promise<AccessClaims> {
    return this.jwt.verifyAsync<AccessClaims>(token, {
      secret: this.accessSecret,
    });
  }

  verifyRefresh(token: string): Promise<RefreshClaims> {
    return this.jwt.verifyAsync<RefreshClaims>(token, {
      secret: this.refreshSecret,
    });
  }
}
