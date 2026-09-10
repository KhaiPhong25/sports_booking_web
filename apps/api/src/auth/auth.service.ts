import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { IDENTITY_REPOSITORY, IdentityRepository } from "./identity.repository";
import { IdentityUser, Principal, SessionTokens } from "./auth.types";
import { normalizeVietnamesePhone } from "./phone";
import { PasswordService } from "./password.service";
import { RefreshClaims, TokenService } from "./token.service";

export interface RegisterInput {
  email: string;
  password: string;
  phone: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult extends SessionTokens {
  user: ReturnType<typeof publicUser>;
}

function publicUser(user: IdentityUser) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    roles: user.roles,
  };
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(IDENTITY_REPOSITORY)
    private readonly repository: IdentityRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    if (await this.repository.findUserByEmail(email)) {
      throw new ConflictException("Email is already registered");
    }
    let user: IdentityUser;
    try {
      user = await this.repository.createUser({
        email,
        phone: normalizeVietnamesePhone(input.phone),
        displayName: input.displayName.trim(),
        passwordHash: await this.passwords.hash(input.password),
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Email is already registered");
      }
      throw error;
    }
    const session = await this.createSession(user, null);
    return { ...session, user: publicUser(user) };
  }

  async login(
    input: LoginInput,
    userAgent: string | null,
  ): Promise<AuthResult> {
    const user = await this.repository.findUserByEmail(
      input.email.trim().toLowerCase(),
    );
    if (
      !user ||
      user.isLocked ||
      !(await this.passwords.verify(user.passwordHash, input.password))
    ) {
      throw new UnauthorizedException("Invalid credentials or locked account");
    }
    return {
      ...(await this.createSession(user, userAgent)),
      user: publicUser(user),
    };
  }

  async refresh(
    refreshToken: string,
    userAgent: string | null,
  ): Promise<AuthResult> {
    let claims: RefreshClaims;
    try {
      claims = await this.tokens.verifyRefresh(refreshToken);
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
    const [session, user] = await Promise.all([
      this.repository.findSession(claims.sid),
      this.repository.findUserById(claims.sub),
    ]);
    const validHash = session
      ? await this.passwords.verify(session.tokenHash, refreshToken)
      : false;
    if (
      !session ||
      session.familyId !== claims.fid ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !validHash ||
      !user ||
      user.isLocked ||
      user.securityVersion !== claims.securityVersion
    ) {
      await this.repository.revokeFamily(claims.fid);
      throw new UnauthorizedException("Refresh token reuse or invalid session");
    }

    const next = await this.tokens.issue(
      this.toPrincipal(user),
      claims.fid,
      randomUUID(),
    );
    const replaced = await this.repository.replaceSession(session.id, {
      id: next.sessionId,
      userId: user.id,
      familyId: next.familyId,
      tokenHash: await this.passwords.hash(next.refreshToken),
      expiresAt: next.refreshExpiresAt,
      userAgent,
    });
    if (!replaced) {
      await this.repository.revokeFamily(claims.fid);
      throw new UnauthorizedException("Refresh token was already rotated");
    }
    return { ...next, user: publicUser(user) };
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const claims = await this.tokens.verifyRefresh(refreshToken);
      await this.repository.revokeFamily(claims.fid);
    } catch {
      return;
    }
  }

  async authenticateAccessToken(accessToken: string): Promise<Principal> {
    let claims: Awaited<ReturnType<TokenService["verifyAccess"]>>;
    try {
      claims = await this.tokens.verifyAccess(accessToken);
    } catch {
      throw new UnauthorizedException("Invalid access token");
    }
    const user = await this.repository.findUserById(claims.sub);
    if (
      !user ||
      user.isLocked ||
      user.securityVersion !== claims.securityVersion
    ) {
      throw new UnauthorizedException("Account is unavailable");
    }
    return this.toPrincipal(user);
  }

  private async createSession(
    user: IdentityUser,
    userAgent: string | null,
  ): Promise<SessionTokens> {
    const issued = await this.tokens.issue(this.toPrincipal(user));
    await this.repository.createSession({
      id: issued.sessionId,
      userId: user.id,
      familyId: issued.familyId,
      tokenHash: await this.passwords.hash(issued.refreshToken),
      expiresAt: issued.refreshExpiresAt,
      userAgent,
    });
    return issued;
  }

  private toPrincipal(user: IdentityUser): Principal {
    return {
      userId: user.id,
      roles: user.roles,
      securityVersion: user.securityVersion,
    };
  }
}
