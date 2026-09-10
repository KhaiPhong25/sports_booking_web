import { OUTBOX_EVENT_TYPES } from "@sports-booking/shared";
import { BullMqOutboxPublisher, QueueHandle } from "./bullmq-outbox-publisher";

describe("BullMqOutboxPublisher", () => {
  it("uses the outbox event id as the retry-safe BullMQ job id", async () => {
    const calls: unknown[][] = [];
    const queue: QueueHandle = {
      add: async (...args) => {
        calls.push(args);
      },
      close: async () => undefined,
    };
    const publisher = new BullMqOutboxPublisher({
      notifications: queue,
      bookingLifecycle: queue,
    });

    await publisher.publish({
      id: "10000000-0000-4000-8000-000000000001",
      aggregateId: "20000000-0000-4000-8000-000000000001",
      eventType: OUTBOX_EVENT_TYPES.notificationEmail,
      payload: { notificationId: "20000000-0000-4000-8000-000000000001" },
    });

    expect(calls).toEqual([
      [
        "send-email",
        {
          eventId: "10000000-0000-4000-8000-000000000001",
          aggregateId: "20000000-0000-4000-8000-000000000001",
          eventType: OUTBOX_EVENT_TYPES.notificationEmail,
          payload: {
            notificationId: "20000000-0000-4000-8000-000000000001",
          },
        },
        expect.objectContaining({
          jobId: "10000000-0000-4000-8000-000000000001",
          attempts: 5,
          backoff: { type: "exponential", delay: 1000 },
        }),
      ],
    ]);
  });
});
