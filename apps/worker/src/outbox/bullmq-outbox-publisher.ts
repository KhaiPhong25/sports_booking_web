import {
  OutboxJobData,
  QUEUE_NAMES,
  routeOutboxEvent,
} from "@sports-booking/shared";
import { OutboxEventRecord, OutboxQueuePublisher } from "./outbox-relay";

export interface QueueHandle {
  add(
    name: string,
    data: OutboxJobData,
    options: {
      jobId: string;
      attempts: number;
      backoff: { type: "exponential"; delay: number };
      removeOnComplete: { age: number; count: number };
      removeOnFail: { age: number; count: number };
    },
  ): Promise<unknown>;
  close(): Promise<void>;
}

export class BullMqOutboxPublisher implements OutboxQueuePublisher {
  constructor(
    private readonly queues: {
      notifications: QueueHandle;
      bookingLifecycle: QueueHandle;
    },
  ) {}

  async publish(event: OutboxEventRecord): Promise<void> {
    const route = routeOutboxEvent(event.eventType);
    const queue =
      route.queueName === QUEUE_NAMES.notifications
        ? this.queues.notifications
        : this.queues.bookingLifecycle;
    await queue.add(
      route.jobName,
      {
        eventId: event.id,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: event.payload,
      },
      {
        jobId: event.id,
        attempts: 5,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { age: 7 * 24 * 60 * 60, count: 10_000 },
        removeOnFail: { age: 7 * 24 * 60 * 60, count: 10_000 },
      },
    );
  }

  async close(): Promise<void> {
    await Promise.all([
      this.queues.notifications.close(),
      this.queues.bookingLifecycle.close(),
    ]);
  }
}
