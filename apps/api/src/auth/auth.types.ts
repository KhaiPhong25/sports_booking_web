export type RoleName = "CUSTOMER" | "OWNER" | "ADMIN";

export interface IdentityUser {
  id: string;
  email: string;
  phone: string;
  displayName: string;
  passwordHash: string;
  isLocked: boolean;
  securityVersion: number;
  roles: RoleName[];
}

export interface RefreshSessionRecord {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  userAgent: string | null;
}

export interface Principal {
  userId: string;
  roles: RoleName[];
  securityVersion: number;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}
