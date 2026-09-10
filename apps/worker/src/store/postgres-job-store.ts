import { OUTBOX_EVENT_TYPES, OutboxJobData } from "@sports-booking/shared";
import { randomUUID } from "node:crypto";
import { Pool, PoolClient } from "pg";
import { NotificationDeliveryStore } from "../processors/email-notification.processor";

interface LockedBooking {
  id: string;
  status: string;
  expires_at: Date | null;
  start_at: Date;
  end_at: Date;
  customer_id: string;
  customer_email: string;
  customer_name: string;
  venue_id: string;
  venue_name: string;
  sport_name: string;
}

export class PostgresJobStore implements NotificationDeliveryStore {
  constructor(private readonly pool: Pool) {}

  async withDeliveryLock<T>(
    notificationId: string,
    task: () => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`notification-email:${notificationId}`],
      );
      const result = await task();
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async isProcessed(eventId: string, processorName: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM processed_events WHERE event_id = $1 AND processor_name = $2`,
      [eventId, processorName],
    );
    return result.rowCount === 1;
  }

  async markFailure(notificationId: string, message: string): Promise<void> {
    await this.pool.query(
      `UPDATE notifications
       SET email_status = 'FAILED',
           email_attempts = email_attempts + 1,
           email_last_error = $2,
           email_sent_at = NULL
       WHERE id = $1 AND email_status <> 'SENT'`,
      [notificationId, message],
    );
  }

  async markSent(
    eventId: string,
    processorName: string,
    notificationId: string,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        `INSERT INTO processed_events (event_id, processor_name)
         VALUES ($1,$2)
         ON CONFLICT DO NOTHING
         RETURNING event_id`,
        [eventId, processorName],
      );
      if (inserted.rowCount === 1) {
        await client.query(
          `UPDATE notifications
           SET email_status = 'SENT',
               email_attempts = email_attempts + 1,
               email_last_error = NULL,
               email_sent_at = now()
           WHERE id = $1`,
          [notificationId],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async markTerminalFailure(
    eventId: string,
    processorName: string,
    notificationId: string,
    message: string,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO processed_events (event_id, processor_name)
         VALUES ($1,$2)
         ON CONFLICT DO NOTHING`,
        [eventId, processorName],
      );
      await client.query(
        `UPDATE notifications
         SET email_status = 'FAILED',
             email_attempts = email_attempts + 1,
             email_last_error = $2,
             email_sent_at = NULL
         WHERE id = $1 AND email_status <> 'SENT'`,
        [notificationId, message],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async processLifecycleEvent(
    job: OutboxJobData,
    now = new Date(),
  ): Promise<boolean> {
    const bookingId = job.payload.bookingId;
    if (typeof bookingId !== "string" || bookingId !== job.aggregateId) {
      throw new Error("Malformed booking lifecycle event");
    }
    const isExpiration = job.eventType === OUTBOX_EVENT_TYPES.bookingExpiration;
    const isCompletion = job.eventType === OUTBOX_EVENT_TYPES.bookingCompletion;
    if (!isExpiration && !isCompletion) {
      throw new Error(`Unsupported lifecycle event: ${job.eventType}`);
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        `INSERT INTO processed_events (event_id, processor_name)
         VALUES ($1,'booking-lifecycle')
         ON CONFLICT DO NOTHING
         RETURNING event_id`,
        [job.eventId],
      );
      if (inserted.rowCount !== 1) {
        await client.query("COMMIT");
        return false;
      }
      const booking = await this.lockBooking(client, bookingId);
      if (!booking) {
        await client.query("COMMIT");
        return false;
      }
      const dueAt = isExpiration ? booking.expires_at : booking.end_at;
      const expectedStatus = isExpiration ? "PENDING" : "CONFIRMED";
      if (booking.status !== expectedStatus) {
        await client.query("COMMIT");
        return false;
      }
      if (!dueAt || dueAt > now) {
        throw new Error("Booking lifecycle event is not due yet");
      }
      const nextStatus = isExpiration ? "EXPIRED" : "COMPLETED";
      await client.query(
        `UPDATE bookings
         SET status = $2::"BookingStatus",
             occupies_court = false,
             expires_at = NULL,
             updated_at = now()
         WHERE id = $1`,
        [bookingId, nextStatus],
      );
      await client.query(
        `INSERT INTO booking_status_history
         (id,booking_id,from_status,to_status,actor_type,reason)
         VALUES ($1,$2,$3::"BookingStatus",$4::"BookingStatus",'SYSTEM',$5)`,
        [
          randomUUID(),
          bookingId,
          expectedStatus,
          nextStatus,
          isExpiration ? "Pending hold elapsed" : "Booking interval ended",
        ],
      );
      await this.createLifecycleNotification(client, booking, nextStatus);
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async lockBooking(
    client: PoolClient,
    bookingId: string,
  ): Promise<LockedBooking | null> {
    const result = await client.query<LockedBooking>(
      `SELECT b.id,b.status,b.expires_at,b.start_at,b.end_at,b.customer_id,
              customer.email AS customer_email,
              customer.display_name AS customer_name,
              v.id AS venue_id,v.name AS venue_name,s.name AS sport_name
       FROM bookings b
       JOIN users customer ON customer.id = b.customer_id
       JOIN venue_sport_offerings o ON o.id = b.offering_id
       JOIN venues v ON v.id = o.venue_id
       JOIN sports s ON s.id = o.sport_id
       WHERE b.id = $1
       FOR UPDATE OF b`,
      [bookingId],
    );
    return result.rows[0] ?? null;
  }

  private async createLifecycleNotification(
    client: PoolClient,
    booking: LockedBooking,
    status: "EXPIRED" | "COMPLETED",
  ): Promise<void> {
    const notificationId = randomUUID();
    const payload = {
      bookingId: booking.id,
      venueId: booking.venue_id,
      venueName: booking.venue_name,
      sportName: booking.sport_name,
      startAt: booking.start_at.toISOString(),
      endAt: booking.end_at.toISOString(),
      status,
    };
    await client.query(
      `INSERT INTO notifications (id,user_id,type,payload,email_status)
       VALUES ($1,$2,$3,$4::jsonb,'PENDING')`,
      [
        notificationId,
        booking.customer_id,
        `BOOKING_${status}`,
        JSON.stringify(payload),
      ],
    );
    await client.query(
      `INSERT INTO outbox_events
       (id,aggregate_type,aggregate_id,event_type,payload)
       VALUES ($1,'Notification',$2,$3,$4::jsonb)`,
      [
        randomUUID(),
        notificationId,
        OUTBOX_EVENT_TYPES.notificationEmail,
        JSON.stringify({
          notificationId,
          bookingId: booking.id,
          to: booking.customer_email,
          subject: `Cập nhật booking: ${status}`,
          text: `${booking.customer_name}, booking tại ${booking.venue_name} đã chuyển sang ${status}.`,
        }),
      ],
    );
  }
}
