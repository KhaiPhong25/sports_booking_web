import { OutboxJobData } from "@sports-booking/shared";

export interface BookingLifecycleStore {
  processLifecycleEvent(job: OutboxJobData): Promise<boolean>;
}

export class BookingLifecycleProcessor {
  constructor(private readonly store: BookingLifecycleStore) {}

  process(job: OutboxJobData): Promise<boolean> {
    return this.store.processLifecycleEvent(job);
  }
}
