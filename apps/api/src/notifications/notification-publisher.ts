import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export const NOTIFICATION_EMAIL_REQUESTED =
  "NOTIFICATION_EMAIL_REQUESTED" as const;
export const BOOKING_EXPIRATION_REQUESTED =
  "BOOKING_EXPIRATION_REQUESTED" as const;
export const BOOKING_COMPLETION_REQUESTED =
  "BOOKING_COMPLETION_REQUESTED" as const;

interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class NotificationPublisher {
  async publish(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      type: string;
      payload: Prisma.InputJsonObject;
      email: EmailMessage;
    },
  ) {
    const notification = await tx.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        payload: input.payload,
        emailStatus: "PENDING",
      },
    });
    await tx.outboxEvent.create({
      data: {
        aggregateType: "Notification",
        aggregateId: notification.id,
        eventType: NOTIFICATION_EMAIL_REQUESTED,
        payload: {
          notificationId: notification.id,
          ...input.email,
        },
      },
    });
    return notification;
  }

  async scheduleLifecycle(
    tx: Prisma.TransactionClient,
    input: {
      bookingId: string;
      eventType:
        | typeof BOOKING_EXPIRATION_REQUESTED
        | typeof BOOKING_COMPLETION_REQUESTED;
      availableAt: Date;
    },
  ) {
    return tx.outboxEvent.create({
      data: {
        aggregateType: "Booking",
        aggregateId: input.bookingId,
        eventType: input.eventType,
        availableAt: input.availableAt,
        payload: { bookingId: input.bookingId },
      },
    });
  }
}
