import { QUEUE_NAMES } from "./queue-names";

describe("queue names", () => {
  it("uses one stable notification queue name across producers and workers", () => {
    expect(QUEUE_NAMES.notifications).toBe("notifications");
  });
});
