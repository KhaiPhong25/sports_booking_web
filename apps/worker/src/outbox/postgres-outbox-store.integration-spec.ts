import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { PostgresOutboxStore } from "./postgres-outbox-store";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("PostgresOutboxStore", () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 4 });
  const store = new PostgresOutboxStore(pool, 1, 1);
  const eventId = randomUUID();
  const aggregateId = randomUUID();

  beforeEach(async () => {
    await pool.query(`DELETE FROM outbox_events WHERE id = $1`, [eventId]);
    await pool.query(
      `INSERT INTO outbox_events
       (id,aggregate_type,aggregate_id,event_type,payload,available_at)
       VALUES ($1,'Notification',$2,'NOTIFICATION_EMAIL_REQUESTED',$3::jsonb,'2000-01-01T00:00:00Z')`,
      [eventId, aggregateId, JSON.stringify({ notificationId: aggregateId })],
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM outbox_events WHERE id = $1`, [eventId]);
    await pool.end();
  });

  it("keeps a row locked until a claim records failure or completion", async () => {
    const first = await store.claimNext();
    expect(
      (
        await pool.query(
          `SELECT id FROM outbox_events WHERE id = $1 FOR UPDATE SKIP LOCKED`,
          [eventId],
        )
      ).rowCount,
    ).toBe(0);
    await first!.fail("redis unavailable");
    expect(first?.event).toEqual({
      id: eventId,
      aggregateId,
      eventType: "NOTIFICATION_EMAIL_REQUESTED",
      payload: { notificationId: aggregateId },
    });
    const failed = await pool.query(
      `SELECT dispatched_at,last_error,available_at > now() AS delayed
       FROM outbox_events WHERE id = $1`,
      [eventId],
    );
    expect(failed.rows[0]).toEqual({
      dispatched_at: null,
      last_error: "redis unavailable",
      delayed: true,
    });

    await pool.query(
      `UPDATE outbox_events SET available_at = '2000-01-01T00:00:00Z' WHERE id = $1`,
      [eventId],
    );
    const retry = await store.claimNext();
    await retry!.complete();
    const completed = await pool.query(
      `SELECT dispatched_at IS NOT NULL AS dispatched,last_error
       FROM outbox_events WHERE id = $1`,
      [eventId],
    );
    expect(completed.rows[0]).toEqual({ dispatched: true, last_error: null });
  });

  it("reclaims an old dispatched event until a durable processor receipt exists", async () => {
    await pool.query(
      `UPDATE outbox_events SET dispatched_at = '2000-01-02T00:00:00Z' WHERE id = $1`,
      [eventId],
    );

    const replay = await store.claimNext();
    expect(replay?.event.id).toBe(eventId);
    await replay!.complete();
  });
});
