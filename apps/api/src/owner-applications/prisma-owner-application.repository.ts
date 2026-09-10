import { Injectable } from "@nestjs/common";
import { ReviewStatus, RoleName } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import {
  OwnerApplicationRecord,
  OwnerApplicationRepository,
  OwnerApplicationStatus,
} from "./owner-application.repository";

@Injectable()
export class PrismaOwnerApplicationRepository implements OwnerApplicationRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    userId: string,
    input: { businessName: string; experience: string | null },
  ): Promise<OwnerApplicationRecord> {
    return this.prisma.ownerApplication.create({ data: { userId, ...input } });
  }

  async hasPending(userId: string): Promise<boolean> {
    return Boolean(
      await this.prisma.ownerApplication.findFirst({
        where: { userId, status: ReviewStatus.PENDING },
        select: { id: true },
      }),
    );
  }

  async findByUser(userId: string, skip: number, take: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ownerApplication.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.ownerApplication.count({ where: { userId } }),
    ]);
    return { items, total };
  }

  async listPending(skip: number, take: number) {
    const where = { status: ReviewStatus.PENDING };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ownerApplication.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip,
        take,
      }),
      this.prisma.ownerApplication.count({ where }),
    ]);
    return { items, total };
  }

  review(
    id: string,
    reviewerId: string,
    decision: Exclude<OwnerApplicationStatus, "PENDING">,
    reason: string | null,
  ): Promise<OwnerApplicationRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.ownerApplication.findUnique({ where: { id } });
      if (!current || current.status !== ReviewStatus.PENDING) return null;
      const claimed = await tx.ownerApplication.updateMany({
        where: { id, status: ReviewStatus.PENDING },
        data: {
          status: decision as ReviewStatus,
          reviewReason: reason,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
      });
      if (claimed.count !== 1) return null;
      if (decision === "APPROVED") {
        const role = await tx.role.upsert({
          where: { name: RoleName.OWNER },
          update: {},
          create: { name: RoleName.OWNER },
        });
        await tx.userRole.upsert({
          where: { userId_roleId: { userId: current.userId, roleId: role.id } },
          update: {},
          create: { userId: current.userId, roleId: role.id },
        });
      }
      const reviewed = await tx.ownerApplication.findUniqueOrThrow({
        where: { id },
      });
      await tx.auditLog.create({
        data: {
          actorId: reviewerId,
          action: `OWNER_APPLICATION_${decision}`,
          resourceType: "OwnerApplication",
          resourceId: id,
          beforeData: { status: current.status },
          afterData: { status: reviewed.status, reason },
        },
      });
      return reviewed;
    });
  }
}
