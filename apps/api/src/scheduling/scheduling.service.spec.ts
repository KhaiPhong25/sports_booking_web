import { ConflictException, ForbiddenException } from "@nestjs/common";
import { InMemorySchedulingRepository } from "./testing/in-memory-scheduling.repository";
import { SchedulingService } from "./scheduling.service";

describe("SchedulingService", () => {
  it("replaces validated weekly hours only for the venue owner", async () => {
    const repository = new InMemorySchedulingRepository();
    repository.venues.set("venue-1", "owner-1");
    const service = new SchedulingService(repository);
    const windows = [
      { weekday: 1, startMinute: 360, endMinute: 720 },
      { weekday: 1, startMinute: 780, endMinute: 1320 },
    ];

    expect(await service.replaceHours("owner-1", "venue-1", windows)).toEqual(
      windows.map((window) => expect.objectContaining(window)),
    );
    await expect(
      service.replaceHours("owner-2", "venue-1", windows),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects a closure that overlaps an occupying booking", async () => {
    const repository = new InMemorySchedulingRepository();
    repository.venues.set("venue-1", "owner-1");
    repository.courts.set("court-1", "venue-1");
    repository.bookingIntervals.push({
      venueId: "venue-1",
      courtId: "court-1",
      startAt: new Date("2026-09-15T01:00:00.000Z"),
      endAt: new Date("2026-09-15T03:00:00.000Z"),
    });
    const service = new SchedulingService(repository);

    await expect(
      service.createClosure("owner-1", "venue-1", {
        courtId: "court-1",
        startAt: new Date("2026-09-15T02:00:00.000Z"),
        endAt: new Date("2026-09-15T04:00:00.000Z"),
        reason: "Bảo trì mặt sân",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
