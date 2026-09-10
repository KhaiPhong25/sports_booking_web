import { OutboxJobData } from "@sports-booking/shared";
import { BookingLifecycleProcessor } from "./booking-lifecycle.processor";

describe("BookingLifecycleProcessor", () => {
  it("delegates lifecycle handling to the durable store", async () => {
    const job = {
      eventId: "10000000-0000-4000-8000-000000000001",
      aggregateId: "20000000-0000-4000-8000-000000000001",
      eventType: "BOOKING_EXPIRATION_REQUESTED",
      payload: { bookingId: "20000000-0000-4000-8000-000000000001" },
    } satisfies OutboxJobData;
    const processLifecycleEvent = jest.fn().mockResolvedValue(true);
    const processor = new BookingLifecycleProcessor({ processLifecycleEvent });

    await expect(processor.process(job)).resolves.toBe(true);
    expect(processLifecycleEvent).toHaveBeenCalledWith(job);
  });
});
