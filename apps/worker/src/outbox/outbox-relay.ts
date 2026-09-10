export interface OutboxEventRecord {
  id: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface OutboxClaim {
  event: OutboxEventRecord;
  complete(): Promise<void>;
  fail(message: string): Promise<void>;
}

export interface OutboxClaimStore {
  claimNext(): Promise<OutboxClaim | null>;
}

export interface OutboxQueuePublisher {
  publish(event: OutboxEventRecord): Promise<void>;
}

export class OutboxRelay {
  constructor(
    private readonly store: OutboxClaimStore,
    private readonly publisher: OutboxQueuePublisher,
  ) {}

  async relayBatch(limit = 20): Promise<number> {
    let processed = 0;
    while (processed < limit) {
      const claim = await this.store.claimNext();
      if (!claim) break;
      processed += 1;
      try {
        await this.publisher.publish(claim.event);
        await claim.complete();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown enqueue error";
        await claim.fail(message.slice(0, 1000));
      }
    }
    return processed;
  }
}
