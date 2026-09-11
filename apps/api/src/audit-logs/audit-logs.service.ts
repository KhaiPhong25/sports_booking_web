import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";

export interface AuditLogFilters {
  action?: string;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  sort?: "newest" | "oldest";
  page?: number;
  pageSize?: number;
}

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: AuditLogFilters) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const where = {
      ...(filters.action?.trim() ? { action: filters.action.trim() } : {}),
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
      ...(filters.resourceType?.trim()
        ? { resourceType: filters.resourceType.trim() }
        : {}),
      ...(filters.resourceId ? { resourceId: filters.resourceId } : {}),
    } satisfies Prisma.AuditLogWhereInput;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        select: {
          id: true,
          action: true,
          resourceType: true,
          resourceId: true,
          beforeData: true,
          afterData: true,
          createdAt: true,
          actor: {
            select: { id: true, email: true, displayName: true },
          },
        },
        orderBy: [
          { createdAt: filters.sort === "oldest" ? "asc" : "desc" },
          { id: filters.sort === "oldest" ? "asc" : "desc" },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }
}
