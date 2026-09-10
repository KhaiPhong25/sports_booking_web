import { OUTBOX_EVENT_TYPES, OutboxJobData } from "@sports-booking/shared";
import { EmailAdapter, EmailMessage } from "../adapters/email.adapter";

export interface NotificationDeliveryStore {
  withDeliveryLock<T>(
    notificationId: string,
    task: () => Promise<T>,
  ): Promise<T>;
  isProcessed(eventId: string, processorName: string): Promise<boolean>;
  markFailure(notificationId: string, message: string): Promise<void>;
  markSent(
    eventId: string,
    processorName: string,
    notificationId: string,
  ): Promise<void>;
  markTerminalFailure(
    eventId: string,
    processorName: string,
    notificationId: string,
    message: string,
  ): Promise<void>;
}

export class EmailNotificationProcessor {
  private readonly processorName = "email-notification";

  constructor(
    private readonly store: NotificationDeliveryStore,
    private readonly mailer: EmailAdapter,
  ) {}

  async process(
    job: OutboxJobData,
    attempt?: { currentAttempt: number; maxAttempts: number },
  ): Promise<void> {
    if (job.eventType !== OUTBOX_EVENT_TYPES.notificationEmail) {
      throw new Error(`Unsupported email event: ${job.eventType}`);
    }
    await this.store.withDeliveryLock(job.aggregateId, async () => {
      if (await this.store.isProcessed(job.eventId, this.processorName)) return;
      try {
        const message = this.messageFrom(job);
        await this.mailer.send(message);
        await this.store.markSent(
          job.eventId,
          this.processorName,
          job.aggregateId,
        );
      } catch (error) {
        const failure =
          error instanceof Error ? error.message : "Unknown email error";
        const message = failure.slice(0, 1000);
        if (attempt && attempt.currentAttempt >= attempt.maxAttempts) {
          await this.store.markTerminalFailure(
            job.eventId,
            this.processorName,
            job.aggregateId,
            message,
          );
        } else {
          await this.store.markFailure(job.aggregateId, message);
        }
        throw error;
      }
    });
  }

  private messageFrom(job: OutboxJobData): EmailMessage {
    const { to, subject, text } = job.payload;
    if (
      typeof to !== "string" ||
      typeof subject !== "string" ||
      typeof text !== "string" ||
      job.payload.notificationId !== job.aggregateId
    ) {
      throw new Error("Malformed notification email event");
    }
    return { to, subject, text };
  }
}
