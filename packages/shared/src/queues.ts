export const QUEUE_NAMES = Object.freeze({
  notifications: "notifications",
  bookingLifecycle: "booking-lifecycle",
});

export const OUTBOX_EVENT_TYPES = Object.freeze({
  notificationEmail: "NOTIFICATION_EMAIL_REQUESTED",
  bookingExpiration: "BOOKING_EXPIRATION_REQUESTED",
  bookingCompletion: "BOOKING_COMPLETION_REQUESTED",
});

export interface OutboxJobData {
  eventId: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export function routeOutboxEvent(eventType: string): {
  queueName: string;
  jobName: string;
} {
  if (eventType === OUTBOX_EVENT_TYPES.notificationEmail) {
    return { queueName: QUEUE_NAMES.notifications, jobName: "send-email" };
  }
  if (eventType === OUTBOX_EVENT_TYPES.bookingExpiration) {
    return {
      queueName: QUEUE_NAMES.bookingLifecycle,
      jobName: "expire-booking",
    };
  }
  if (eventType === OUTBOX_EVENT_TYPES.bookingCompletion) {
    return {
      queueName: QUEUE_NAMES.bookingLifecycle,
      jobName: "complete-booking",
    };
  }
  throw new Error(`Unsupported outbox event type: ${eventType}`);
}
