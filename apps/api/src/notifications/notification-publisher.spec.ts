import { Prisma } from "@prisma/client";
import { NotificationPublisher } from "./notification-publisher";

describe("NotificationPublisher", () => {
  it("writes the in-app notification and email outbox event through one transaction client", async () => {
    const notificationCreate = jest.fn().mockResolvedValue({
      id: "10000000-0000-4000-8000-000000000001",
    });
    const outboxCreate = jest.fn().mockResolvedValue({});
    const tx = {
      notification: { create: notificationCreate },
      outboxEvent: { create: outboxCreate },
    } as unknown as Prisma.TransactionClient;
    const publisher = new NotificationPublisher();

    await publisher.publish(tx, {
      userId: "20000000-0000-4000-8000-000000000001",
      type: "BOOKING_CONFIRMED",
      payload: { bookingId: "30000000-0000-4000-8000-000000000001" },
      email: {
        to: "customer@example.com",
        subject: "Booking đã được xác nhận",
        text: "Booking của bạn đã được xác nhận.",
      },
    });

    expect(notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "20000000-0000-4000-8000-000000000001",
        type: "BOOKING_CONFIRMED",
        emailStatus: "PENDING",
      }),
    });
    expect(outboxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        aggregateType: "Notification",
        aggregateId: "10000000-0000-4000-8000-000000000001",
        eventType: "NOTIFICATION_EMAIL_REQUESTED",
        payload: {
          notificationId: "10000000-0000-4000-8000-000000000001",
          to: "customer@example.com",
          subject: "Booking đã được xác nhận",
          text: "Booking của bạn đã được xác nhận.",
        },
      }),
    });
  });

  it("schedules a booking lifecycle event at its durable due time", async () => {
    const outboxCreate = jest.fn().mockResolvedValue({});
    const tx = {
      outboxEvent: { create: outboxCreate },
    } as unknown as Prisma.TransactionClient;
    const publisher = new NotificationPublisher();
    const dueAt = new Date("2026-09-10T04:30:00.000Z");

    await publisher.scheduleLifecycle(tx, {
      bookingId: "30000000-0000-4000-8000-000000000001",
      eventType: "BOOKING_EXPIRATION_REQUESTED",
      availableAt: dueAt,
    });

    expect(outboxCreate).toHaveBeenCalledWith({
      data: {
        aggregateType: "Booking",
        aggregateId: "30000000-0000-4000-8000-000000000001",
        eventType: "BOOKING_EXPIRATION_REQUESTED",
        availableAt: dueAt,
        payload: { bookingId: "30000000-0000-4000-8000-000000000001" },
      },
    });
  });
});
