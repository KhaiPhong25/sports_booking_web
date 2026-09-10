import { Pool, PoolClient } from "pg";
import {
  OutboxClaim,
  OutboxClaimStore,
  OutboxEventRecord,
} from "./outbox-relay";

interface OutboxRow {
  id: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
}

export class PostgresOutboxStore implements OutboxClaimStore {
  constructor(
    private readonly pool: Pool,
    private readonly retryDelaySeconds = 5,
    private readonly reconciliationDelaySeconds = 60,
  ) {}

  async claimNext(): Promise<OutboxClaim | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<OutboxRow>(
        `SELECT id,aggregate_id,event_type,payload
         FROM outbox_events
         WHERE available_at <= now()
           AND (
             dispatched_at IS NULL
             OR (
               dispatched_at <= now() - make_interval(secs => $1)
               AND NOT EXISTS (
                 SELECT 1 FROM processed_events processed
                 WHERE processed.event_id = outbox_events.id
               )
             )
           )
         ORDER BY available_at,created_at,id
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
        [this.reconciliationDelaySeconds],
      );
      const row = result.rows[0];
      if (!row) {
        await client.query("COMMIT");
        client.release();
        return null;
      }
      return this.claim(client, {
        id: row.id,
        aggregateId: row.aggregate_id,
        eventType: row.event_type,
        payload: row.payload,
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
      throw error;
    }
  }

  private claim(client: PoolClient, event: OutboxEventRecord): OutboxClaim {
    let finished = false;
    const finish = async (
      sql: string,
      parameters: unknown[],
    ): Promise<void> => {
      if (finished) throw new Error("Outbox claim is already finalized");
      finished = true;
      try {
        await client.query(sql, parameters);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    };
    return {
      event,
      complete: () =>
        finish(
          `UPDATE outbox_events
           SET dispatched_at = now(),last_error = NULL
           WHERE id = $1`,
          [event.id],
        ),
      fail: (message) =>
        finish(
          `UPDATE outbox_events
           SET last_error = $2,
               available_at = now() + make_interval(secs => $3)
           WHERE id = $1`,
          [event.id, message, this.retryDelaySeconds],
        ),
    };
  }
}
