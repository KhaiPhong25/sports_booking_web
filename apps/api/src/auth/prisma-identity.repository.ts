import { Injectable } from "@nestjs/common";
import { Prisma, RoleName as PrismaRoleName } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { IdentityUser, RefreshSessionRecord, RoleName } from "./auth.types";
import {
  CreateIdentityUser,
  IdentityRepository,
  NewRefreshSession,
} from "./identity.repository";

const userWithRoles = {
  roles: { include: { role: true } },
} satisfies Prisma.UserInclude;

type PrismaIdentityUser = Prisma.UserGetPayload<{
  include: typeof userWithRoles;
}>;

function mapUser(user: PrismaIdentityUser): IdentityUser {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    passwordHash: user.passwordHash,
    avatarObjectKey: user.avatarObjectKey,
    avatarUpdatedAt: user.avatarUpdatedAt,
    isLocked: user.isLocked,
    securityVersion: user.securityVersion,
    roles: user.roles.map(({ role }) => role.name as RoleName),
  };
}

@Injectable()
export class PrismaIdentityRepository implements IdentityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(input: CreateIdentityUser): Promise<IdentityUser> {
    const user = await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.upsert({
        where: { name: PrismaRoleName.CUSTOMER },
        update: {},
        create: { name: PrismaRoleName.CUSTOMER },
      });
      return tx.user.create({
        data: {
          ...input,
          roles: { create: { roleId: role.id } },
        },
        include: userWithRoles,
      });
    });
    return mapUser(user);
  }

  async findUserByEmail(email: string): Promise<IdentityUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: userWithRoles,
    });
    return user ? mapUser(user) : null;
  }

  async findUserById(id: string): Promise<IdentityUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: userWithRoles,
    });
    return user ? mapUser(user) : null;
  }

  async listUsers(
    skip: number,
    take: number,
    filters: { query?: string; locked?: boolean; role?: RoleName } = {},
  ) {
    const query = filters.query?.trim();
    const where = {
      ...(typeof filters.locked === "boolean"
        ? { isLocked: filters.locked }
        : {}),
      ...(filters.role
        ? {
            roles: {
              some: { role: { name: filters.role as PrismaRoleName } },
            },
          }
        : {}),
      ...(query
        ? {
            OR: [
              { email: { contains: query, mode: "insensitive" as const } },
              {
                displayName: {
                  contains: query,
                  mode: "insensitive" as const,
                },
              },
              { phone: { contains: query } },
            ],
          }
        : {}),
    } satisfies Prisma.UserWhereInput;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: userWithRoles,
        orderBy: [{ isLocked: "desc" }, { displayName: "asc" }, { id: "asc" }],
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: items.map(mapUser), total };
  }

  async updateProfile(
    id: string,
    input: { displayName?: string; phone?: string },
  ): Promise<IdentityUser> {
    return mapUser(
      await this.prisma.user.update({
        where: { id },
        data: input,
        include: userWithRoles,
      }),
    );
  }

  async setAvatar(
    id: string,
    objectKey: string | null,
  ): Promise<IdentityUser> {
    return mapUser(
      await this.prisma.user.update({
        where: { id },
        data: {
          avatarObjectKey: objectKey,
          avatarUpdatedAt: objectKey ? new Date() : null,
        },
        include: userWithRoles,
      }),
    );
  }

  async setLocked(
    id: string,
    locked: boolean,
    actorId?: string,
  ): Promise<IdentityUser> {
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { isLocked: locked, securityVersion: { increment: 1 } },
        include: userWithRoles,
      });
      if (locked) {
        await tx.refreshSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      if (actorId) {
        await tx.auditLog.create({
          data: {
            actorId,
            action: locked ? "USER_LOCKED" : "USER_UNLOCKED",
            resourceType: "User",
            resourceId: id,
            beforeData: { isLocked: !locked },
            afterData: { isLocked: locked },
          },
        });
      }
      return updated;
    });
    return mapUser(user);
  }

  async addRole(id: string, roleName: RoleName): Promise<IdentityUser> {
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.upsert({
        where: { name: roleName as PrismaRoleName },
        update: {},
        create: { name: roleName as PrismaRoleName },
      });
      await tx.userRole.upsert({
        where: { userId_roleId: { userId: id, roleId: role.id } },
        update: {},
        create: { userId: id, roleId: role.id },
      });
      const user = await tx.user.findUniqueOrThrow({
        where: { id },
        include: userWithRoles,
      });
      return mapUser(user);
    });
  }

  async createSession(input: NewRefreshSession): Promise<void> {
    await this.prisma.refreshSession.create({ data: input });
  }

  async findSession(id: string): Promise<RefreshSessionRecord | null> {
    return this.prisma.refreshSession.findUnique({ where: { id } });
  }

  async replaceSession(
    currentId: string,
    next: NewRefreshSession,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.refreshSession.updateMany({
        where: { id: currentId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (result.count !== 1) return false;
      await tx.refreshSession.create({ data: next });
      return true;
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
