import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { InMemoryVenueRepository } from "./testing/in-memory-venue.repository";
import { VenuesService } from "./venues.service";

const venueInput = {
  areaId: "area-1",
  name: "Sân Xanh",
  address: "12 Nguyễn Huệ, Quận 1",
  description: "Cụm sân thể thao trung tâm",
  latitude: 10.7731,
  longitude: 106.7031,
};

describe("VenuesService", () => {
  it("keeps a new venue private until an administrator approves it", async () => {
    const repository = new InMemoryVenueRepository();
    const service = new VenuesService(repository);
    const venue = await service.create("owner-1", venueInput);

    expect(venue.status).toBe("PENDING_APPROVAL");
    expect((await service.publicList()).items).toEqual([]);
    await service.moderate("admin-1", venue.id, "APPROVED", null);
    expect((await service.publicList()).items[0]?.id).toBe(venue.id);
  });

  it("denies cross-owner changes and hides missing private records", async () => {
    const repository = new InMemoryVenueRepository();
    const service = new VenuesService(repository);
    const venue = await service.create("owner-1", venueInput);

    await expect(
      service.update("owner-2", venue.id, { name: "Chiếm quyền" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.publicDetail(venue.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("requires re-approval after public venue details change", async () => {
    const repository = new InMemoryVenueRepository();
    const service = new VenuesService(repository);
    const venue = await service.create("owner-1", venueInput);
    await service.moderate("admin-1", venue.id, "APPROVED", null);

    const updated = await service.update("owner-1", venue.id, {
      address: "99 Lê Lợi, Quận 1",
    });
    expect(updated.status).toBe("PENDING_APPROVAL");
    expect((await service.publicList()).items).toEqual([]);
  });

  it("creates offerings and lets only the owner change court maintenance state", async () => {
    const repository = new InMemoryVenueRepository();
    const service = new VenuesService(repository);
    const venue = await service.create("owner-1", venueInput);
    const offering = await service.addOffering("owner-1", venue.id, {
      sportId: "sport-badminton",
      confirmationMode: "OWNER_APPROVAL",
      advanceBookingDays: 21,
      cancellationNoticeMinutes: 180,
    });
    const court = await service.addCourt("owner-1", offering.id, "Sân 1");

    expect(
      (await service.setCourtActive("owner-1", court.id, false)).isActive,
    ).toBe(false);
    await expect(
      service.setCourtActive("owner-2", court.id, true),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("records moderation decisions in the audit trail", async () => {
    const repository = new InMemoryVenueRepository();
    const service = new VenuesService(repository);
    const venue = await service.create("owner-1", venueInput);
    await service.moderate(
      "admin-1",
      venue.id,
      "REJECTED",
      "Địa chỉ chưa đủ thông tin để xác minh",
    );
    expect(repository.audits[0]).toEqual(
      expect.objectContaining({
        action: "VENUE_REJECTED",
        resourceId: venue.id,
      }),
    );
  });

  it("refuses to deactivate a court that has a future occupying booking", async () => {
    const repository = new InMemoryVenueRepository();
    const service = new VenuesService(repository);
    const venue = await service.create("owner-1", venueInput);
    const offering = await service.addOffering("owner-1", venue.id, {
      sportId: "sport-badminton",
      confirmationMode: "INSTANT",
      advanceBookingDays: 14,
      cancellationNoticeMinutes: 120,
    });
    const court = await service.addCourt("owner-1", offering.id, "Sân 1");
    repository.futureBookedCourtIds.add(court.id);

    await expect(
      service.setCourtActive("owner-1", court.id, false),
    ).rejects.toBeInstanceOf(ConflictException);
    expect((await repository.findCourt(court.id))?.isActive).toBe(true);
  });

  it("refuses to archive a venue that has a future occupying booking", async () => {
    const repository = new InMemoryVenueRepository();
    const service = new VenuesService(repository);
    const venue = await service.create("owner-1", venueInput);
    repository.futureBookedVenueIds.add(venue.id);

    await expect(service.archive("owner-1", venue.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect((await repository.findVenue(venue.id))?.status).not.toBe("ARCHIVED");
  });
});
