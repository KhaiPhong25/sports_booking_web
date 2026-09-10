import {
  OUTBOX_EVENT_TYPES,
  QUEUE_NAMES,
  routeOutboxEvent,
} from "@sports-booking/shared";

describe("queue names", () => {
  it("uses one stable notification queue name across producers and workers", () => {
    expect(QUEUE_NAMES.notifications).toBe("notifications");
  });

  it("routes durable outbox event types to a stable queue and job name", () => {
    expect(routeOutboxEvent(OUTBOX_EVENT_TYPES.notificationEmail)).toEqual({
      queueName: "notifications",
      jobName: "send-email",
    });
    expect(routeOutboxEvent(OUTBOX_EVENT_TYPES.bookingExpiration)).toEqual({
      queueName: "booking-lifecycle",
      jobName: "expire-booking",
    });
    expect(routeOutboxEvent(OUTBOX_EVENT_TYPES.bookingCompletion)).toEqual({
      queueName: "booking-lifecycle",
      jobName: "complete-booking",
    });
  });
});
