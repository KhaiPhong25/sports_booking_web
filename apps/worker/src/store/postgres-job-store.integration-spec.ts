import { OUTBOX_EVENT_TYPES } from "@sports-booking/shared";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { PostgresJobStore } from "./postgres-job-store";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("PostgresJobStore booking lifecycle", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const store = new PostgresJobStore(pool);
  const ids = {
    owner: randomUUID(),
    customer: randomUUID(),
    area: randomUUID(),
    sport: randomUUID(),
    venue: randomUUID(),
    offering: randomUUID(),
    court: randomUUID(),
    pending: randomUUID(),
    confirmed: randomUUID(),
    racing: randomUUID(),
    expirationEvent: randomUUID(),
    completionEvent: randomUUID(),
    racingEvent: randomUUID(),
  };
  const suffix = randomUUID();
  const now = new Date("2026-09-10T05:00:00.000Z");

  beforeAll(async () => {
    await pool.query(
      `INSERT INTO users (id,email,phone,display_name,password_hash,updated_at)
       VALUES ($1,$2,'+84901111111','Owner','test',now()),
              ($3,$4,'+84902222222','Customer','test',now())`,
      [
        ids.owner,
        `worker-owner-${suffix}@example.com`,
        ids.customer,
        `worker-customer-${suffix}@example.com`,
      ],
    );
    await pool.query(
      `INSERT INTO areas (id,code,name,type) VALUES ($1,$2,'Worker Area','district')`,
      [ids.area, `WORKER_${suffix}`],
    );
    await pool.query(
      `INSERT INTO sports (id,code,name) VALUES ($1,$2,'Worker Sport')`,
      [ids.sport, `WORKER_SPORT_${suffix}`],
    );
    await pool.query(
      `INSERT INTO venues (id,owner_id,area_id,name,address,description,latitude,longitude,status,updated_at)
       VALUES ($1,$2,$3,'Worker Venue','Test','Worker lifecycle venue',10.7,106.7,'APPROVED',now())`,
      [ids.venue, ids.owner, ids.area],
    );
    await pool.query(
      `INSERT INTO venue_sport_offerings (id,venue_id,sport_id,confirmation_mode,updated_at)
       VALUES ($1,$2,$3,'OWNER_APPROVAL',now())`,
      [ids.offering, ids.venue, ids.sport],
    );
    await pool.query(
      `INSERT INTO courts (id,offering_id,internal_name,updated_at)
       VALUES ($1,$2,'Worker Court',now())`,
      [ids.court, ids.offering],
    );
    await pool.query(
      `INSERT INTO bookings
       (id,customer_id,offering_id,court_id,start_at,end_at,status,expires_at,occupies_court,price_amount,cancellation_notice_minutes,confirmation_mode_snapshot,pricing_breakdown,updated_at)
       VALUES
       ($1,$3,$4,$5,'2026-09-11T03:00:00Z','2026-09-11T04:00:00Z','PENDING','2026-09-10T04:30:00Z',true,100000,120,'OWNER_APPROVAL','[]',now()),
       ($2,$3,$4,$5,'2026-09-09T03:00:00Z','2026-09-09T04:00:00Z','CONFIRMED',NULL,true,100000,120,'INSTANT','[]',now()),
       ($6,$3,$4,$5,'2026-09-12T03:00:00Z','2026-09-12T04:00:00Z','PENDING','2026-09-10T04:30:00Z',true,100000,120,'OWNER_APPROVAL','[]',now())`,
      [
        ids.pending,
        ids.confirmed,
        ids.customer,
        ids.offering,
        ids.court,
        ids.racing,
      ],
    );
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM outbox_events
       WHERE aggregate_id::text IN ($1,$2,$3)
          OR aggregate_type = 'Notification' AND payload->>'bookingId' IN ($1,$2,$3)`,
      [ids.pending, ids.confirmed, ids.racing],
    );
    await pool.query(`DELETE FROM notifications WHERE user_id = $1`, [
      ids.customer,
    ]);
    await pool.query(
      `DELETE FROM processed_events WHERE event_id IN ($1,$2,$3)`,
      [ids.expirationEvent, ids.completionEvent, ids.racingEvent],
    );
    await pool.query(`DELETE FROM bookings WHERE id IN ($1,$2,$3)`, [
      ids.pending,
      ids.confirmed,
      ids.racing,
    ]);
    await pool.query(`DELETE FROM courts WHERE id = $1`, [ids.court]);
    await pool.query(`DELETE FROM venue_sport_offerings WHERE id = $1`, [
      ids.offering,
    ]);
    await pool.query(`DELETE FROM venues WHERE id = $1`, [ids.venue]);
    await pool.query(`DELETE FROM sports WHERE id = $1`, [ids.sport]);
    await pool.query(`DELETE FROM areas WHERE id = $1`, [ids.area]);
    await pool.query(`DELETE FROM users WHERE id IN ($1,$2)`, [
      ids.owner,
      ids.customer,
    ]);
    await pool.end();
  });

  it("expires a pending booking and emits notification exactly once when repeated", async () => {
    const job = {
      eventId: ids.expirationEvent,
      aggregateId: ids.pending,
      eventType: OUTBOX_EVENT_TYPES.bookingExpiration,
      payload: { bookingId: ids.pending },
    };

    await expect(store.processLifecycleEvent(job, now)).resolves.toBe(true);
    await expect(store.processLifecycleEvent(job, now)).resolves.toBe(false);

    expect(
      (
        await pool.query(`SELECT status FROM bookings WHERE id = $1`, [
          ids.pending,
        ])
      ).rows[0].status,
    ).toBe("EXPIRED");
    expect(
      (
        await pool.query(
          `SELECT count(*)::int AS count FROM booking_status_history WHERE booking_id = $1 AND to_status = 'EXPIRED'`,
          [ids.pending],
        )
      ).rows[0].count,
    ).toBe(1);
    expect(
      (
        await pool.query(
          `SELECT count(*)::int AS count FROM notifications WHERE user_id = $1 AND type = 'BOOKING_EXPIRED'`,
          [ids.customer],
        )
      ).rows[0].count,
    ).toBe(1);
    expect(
      (
        await pool.query(
          `SELECT payload FROM notifications WHERE user_id = $1 AND type = 'BOOKING_EXPIRED'`,
          [ids.customer],
        )
      ).rows[0].payload,
    ).toEqual(
      expect.objectContaining({
        startAt: "2026-09-11T03:00:00.000Z",
        endAt: "2026-09-11T04:00:00.000Z",
      }),
    );
  });

  it("completes an ended confirmed booking idempotently", async () => {
    const job = {
      eventId: ids.completionEvent,
      aggregateId: ids.confirmed,
      eventType: OUTBOX_EVENT_TYPES.bookingCompletion,
      payload: { bookingId: ids.confirmed },
    };

    await expect(store.processLifecycleEvent(job, now)).resolves.toBe(true);
    await expect(store.processLifecycleEvent(job, now)).resolves.toBe(false);
    expect(
      (
        await pool.query(`SELECT status FROM bookings WHERE id = $1`, [
          ids.confirmed,
        ])
      ).rows[0].status,
    ).toBe("COMPLETED");
  });

  it("does not expire a booking when confirmation wins the row-lock race", async () => {
    const confirmingClient = await pool.connect();
    await confirmingClient.query("BEGIN");
    await confirmingClient.query(
      `SELECT id FROM bookings WHERE id = $1 FOR UPDATE`,
      [ids.racing],
    );
    await confirmingClient.query(
      `UPDATE bookings
       SET status = 'CONFIRMED',expires_at = NULL,updated_at = now()
       WHERE id = $1 AND status = 'PENDING'`,
      [ids.racing],
    );

    const lifecycleResult = store.processLifecycleEvent(
      {
        eventId: ids.racingEvent,
        aggregateId: ids.racing,
        eventType: OUTBOX_EVENT_TYPES.bookingExpiration,
        payload: { bookingId: ids.racing },
      },
      now,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    await confirmingClient.query("COMMIT");
    confirmingClient.release();

    await expect(lifecycleResult).resolves.toBe(false);
    expect(
      (
        await pool.query(`SELECT status FROM bookings WHERE id = $1`, [
          ids.racing,
        ])
      ).rows[0].status,
    ).toBe("CONFIRMED");
    expect(
      (
        await pool.query(
          `SELECT count(*)::int AS count FROM booking_status_history
           WHERE booking_id = $1 AND to_status = 'EXPIRED'`,
          [ids.racing],
        )
      ).rows[0].count,
    ).toBe(0);
  });
});
