import { randomUUID } from "node:crypto";
import {
  CreateIdentityUser,
  IdentityRepository,
  NewRefreshSession,
} from "../identity.repository";
import { IdentityUser, RefreshSessionRecord, RoleName } from "../auth.types";

export class InMemoryIdentityRepository implements IdentityRepository {
  readonly users = new Map<string, IdentityUser>();
  readonly sessions = new Map<string, RefreshSessionRecord>();

  async createUser(input: CreateIdentityUser): Promise<IdentityUser> {
    const user: IdentityUser = {
      id: randomUUID(),
      ...input,
      roles: ["CUSTOMER"],
      isLocked: false,
      securityVersion: 1,
    };
    this.users.set(user.id, user);
    return structuredClone(user);
  }

  async findUserByEmail(email: string): Promise<IdentityUser | null> {
    return (
      [...this.users.values()].find((user) => user.email === email) ?? null
    );
  }

  async findUserById(id: string): Promise<IdentityUser | null> {
    return this.users.get(id) ?? null;
  }

  async updateProfile(
    id: string,
    input: { displayName?: string; phone?: string },
  ): Promise<IdentityUser> {
    const user = this.requiredUser(id);
    Object.assign(user, input);
    return structuredClone(user);
  }

  async setLocked(id: string, locked: boolean): Promise<IdentityUser> {
    const user = this.requiredUser(id);
    user.isLocked = locked;
    user.securityVersion += 1;
    if (locked) {
      for (const session of this.sessions.values()) {
        if (session.userId === id) session.revokedAt = new Date();
      }
    }
    return structuredClone(user);
  }

  async addRole(id: string, role: RoleName): Promise<IdentityUser> {
    const user = this.requiredUser(id);
    if (!user.roles.includes(role)) user.roles.push(role);
    return structuredClone(user);
  }

  async createSession(input: NewRefreshSession): Promise<void> {
    this.sessions.set(input.id, { ...input, revokedAt: null });
  }

  async findSession(id: string): Promise<RefreshSessionRecord | null> {
    return this.sessions.get(id) ?? null;
  }

  async replaceSession(
    currentId: string,
    next: NewRefreshSession,
  ): Promise<boolean> {
    const current = this.sessions.get(currentId);
    if (!current || current.revokedAt) return false;
    current.revokedAt = new Date();
    await this.createSession(next);
    return true;
  }

  async revokeFamily(familyId: string): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.familyId === familyId && !session.revokedAt) {
        session.revokedAt = new Date();
      }
    }
  }

  activeSessions(): RefreshSessionRecord[] {
    return [...this.sessions.values()].filter((session) => !session.revokedAt);
  }

  private requiredUser(id: string): IdentityUser {
    const user = this.users.get(id);
    if (!user) throw new Error("User not found");
    return user;
  }
}
