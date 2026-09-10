import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

const notificationSelect = {
  id: true,
  userId: true,
  type: true,
  payload: true,
  readAt: true,
  createdAt: true,
} as const;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    query: { page: number; pageSize: number; unread?: boolean },
  ) {
    const where = {
      userId,
      ...(query.unread === true ? { readAt: null } : {}),
      ...(query.unread === false ? { readAt: { not: null } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        select: notificationSelect,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async markRead(userId: string, id: string, now = new Date()) {
    const updated = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: now },
    });
    if (updated.count !== 1)
      throw new NotFoundException("Notification not found");
    return this.prisma.notification.findUniqueOrThrow({
      where: { id },
      select: notificationSelect,
    });
  }
}
