import {
  OutboxClaim,
  OutboxClaimStore,
  OutboxEventRecord,
  OutboxQueuePublisher,
  OutboxRelay,
} from "./outbox-relay";

const event: OutboxEventRecord = {
  id: "10000000-0000-4000-8000-000000000001",
  aggregateId: "20000000-0000-4000-8000-000000000001",
  eventType: "NOTIFICATION_EMAIL_REQUESTED",
  payload: { notificationId: "20000000-0000-4000-8000-000000000001" },
};

class FakeClaim implements OutboxClaim {
  completed = false;
  failure: string | null = null;
  constructor(readonly event: OutboxEventRecord) {}
  async complete(): Promise<void> {
    this.completed = true;
  }
  async fail(message: string): Promise<void> {
    this.failure = message;
  }
}

class FakeStore implements OutboxClaimStore {
  constructor(private readonly claims: OutboxClaim[]) {}
  async claimNext(): Promise<OutboxClaim | null> {
    return this.claims.shift() ?? null;
  }
}

describe("OutboxRelay", () => {
  it("marks an event dispatched only after its stable event id is published", async () => {
    const claim = new FakeClaim(event);
    const published: Array<{ eventId: string; eventType: string }> = [];
    const publisher: OutboxQueuePublisher = {
      publish: async (record) => {
        published.push({ eventId: record.id, eventType: record.eventType });
      },
    };
    const relay = new OutboxRelay(new FakeStore([claim]), publisher);

    await expect(relay.relayBatch(10)).resolves.toBe(1);
    expect(published).toEqual([
      {
        eventId: "10000000-0000-4000-8000-000000000001",
        eventType: "NOTIFICATION_EMAIL_REQUESTED",
      },
    ]);
    expect(claim.completed).toBe(true);
    expect(claim.failure).toBeNull();
  });

  it("persists an enqueue error and leaves the event retryable", async () => {
    const claim = new FakeClaim(event);
    const publisher: OutboxQueuePublisher = {
      publish: async () => {
        throw new Error("redis unavailable");
      },
    };
    const relay = new OutboxRelay(new FakeStore([claim]), publisher);

    await expect(relay.relayBatch(1)).resolves.toBe(1);
    expect(claim.completed).toBe(false);
    expect(claim.failure).toBe("redis unavailable");
  });
});
