import { IdentityUser, RefreshSessionRecord, RoleName } from "./auth.types";

export const IDENTITY_REPOSITORY = Symbol("IDENTITY_REPOSITORY");

export interface CreateIdentityUser {
  email: string;
  phone: string;
  displayName: string;
  passwordHash: string;
}

export interface NewRefreshSession {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent: string | null;
}

export interface IdentityRepository {
  createUser(input: CreateIdentityUser): Promise<IdentityUser>;
  findUserByEmail(email: string): Promise<IdentityUser | null>;
  findUserById(id: string): Promise<IdentityUser | null>;
  listUsers(
    skip: number,
    take: number,
    filters?: { query?: string; locked?: boolean; role?: RoleName },
  ): Promise<{ items: IdentityUser[]; total: number }>;
  updateProfile(
    id: string,
    input: { displayName?: string; phone?: string },
  ): Promise<IdentityUser>;
  setAvatar(id: string, objectKey: string | null): Promise<IdentityUser>;
  changePassword(id: string, passwordHash: string): Promise<void>;
  setLocked(
    id: string,
    locked: boolean,
    actorId?: string,
  ): Promise<IdentityUser>;
  addRole(id: string, role: RoleName): Promise<IdentityUser>;
  createSession(input: NewRefreshSession): Promise<void>;
  findSession(id: string): Promise<RefreshSessionRecord | null>;
  replaceSession(currentId: string, next: NewRefreshSession): Promise<boolean>;
  revokeFamily(familyId: string): Promise<void>;
}
