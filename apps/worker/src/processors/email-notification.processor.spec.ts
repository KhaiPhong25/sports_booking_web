import {
  EmailNotificationProcessor,
  NotificationDeliveryStore,
} from "./email-notification.processor";
import { EmailAdapter, EmailMessage } from "../adapters/email.adapter";

class FakeDeliveryStore implements NotificationDeliveryStore {
  processed = false;
  failures: string[] = [];
  sent = 0;
  terminalFailures: string[] = [];
  private deliveryTail = Promise.resolve();
  async withDeliveryLock<T>(
    _notificationId: string,
    task: () => Promise<T>,
  ): Promise<T> {
    const result = this.deliveryTail.then(task);
    this.deliveryTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  async isProcessed(): Promise<boolean> {
    return this.processed;
  }
  async markFailure(_notificationId: string, message: string): Promise<void> {
    this.failures.push(message);
  }
  async markSent(): Promise<void> {
    this.sent += 1;
    this.processed = true;
  }
  async markTerminalFailure(
    _eventId: string,
    _processorName: string,
    _notificationId: string,
    message: string,
  ): Promise<void> {
    this.terminalFailures.push(message);
    this.processed = true;
  }
}

const job = {
  eventId: "10000000-0000-4000-8000-000000000001",
  aggregateId: "20000000-0000-4000-8000-000000000001",
  eventType: "NOTIFICATION_EMAIL_REQUESTED",
  payload: {
    notificationId: "20000000-0000-4000-8000-000000000001",
    to: "customer@example.com",
    subject: "Booking confirmed",
    text: "Your booking is confirmed.",
  },
};

describe("EmailNotificationProcessor", () => {
  it("persists a delivery error and rethrows so BullMQ can retry", async () => {
    const store = new FakeDeliveryStore();
    const mailer: EmailAdapter = {
      send: async () => {
        throw new Error("SMTP temporarily unavailable");
      },
    };
    const processor = new EmailNotificationProcessor(store, mailer);

    await expect(processor.process(job)).rejects.toThrow(
      "SMTP temporarily unavailable",
    );
    expect(store.failures).toEqual(["SMTP temporarily unavailable"]);
    expect(store.sent).toBe(0);
  });

  it("marks a successful email once and skips a processed duplicate", async () => {
    const store = new FakeDeliveryStore();
    const sent: EmailMessage[] = [];
    const mailer: EmailAdapter = {
      send: async (message) => {
        sent.push(message);
      },
    };
    const processor = new EmailNotificationProcessor(store, mailer);

    await processor.process(job);
    await processor.process(job);

    expect(sent).toEqual([
      {
        to: "customer@example.com",
        subject: "Booking confirmed",
        text: "Your booking is confirmed.",
      },
    ]);
    expect(store.sent).toBe(1);
  });

  it("serializes concurrent deliveries and sends the event once", async () => {
    const store = new FakeDeliveryStore();
    const send = jest.fn().mockResolvedValue(undefined);
    const processor = new EmailNotificationProcessor(store, { send });

    await Promise.all([processor.process(job), processor.process(job)]);

    expect(send).toHaveBeenCalledTimes(1);
    expect(store.sent).toBe(1);
  });

  it("records malformed payload errors before BullMQ retries", async () => {
    const store = new FakeDeliveryStore();
    const processor = new EmailNotificationProcessor(store, {
      send: jest.fn(),
    });

    await expect(
      processor.process({
        ...job,
        payload: { notificationId: job.aggregateId },
      }),
    ).rejects.toThrow("Malformed notification email event");
    expect(store.failures).toEqual(["Malformed notification email event"]);
  });

  it("writes a durable terminal receipt after the final failed attempt", async () => {
    const store = new FakeDeliveryStore();
    const processor = new EmailNotificationProcessor(store, {
      send: async () => {
        throw new Error("SMTP remains unavailable");
      },
    });

    await expect(
      processor.process(job, { currentAttempt: 5, maxAttempts: 5 }),
    ).rejects.toThrow("SMTP remains unavailable");
    expect(store.terminalFailures).toEqual(["SMTP remains unavailable"]);
    expect(store.failures).toEqual([]);
  });
});
