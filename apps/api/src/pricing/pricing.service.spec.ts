import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { InMemoryPricingRepository } from "./testing/in-memory-pricing.repository";
import { PricingService } from "./pricing.service";
import { PricingEngine } from "./pricing-engine";

describe("PricingService", () => {
  it("allows only the offering owner to create a non-overlapping rule", async () => {
    const repository = new InMemoryPricingRepository();
    repository.offerings.set("offering-1", {
      ownerId: "owner-1",
      venueId: "venue-1",
      venueStatus: "APPROVED",
      isActive: true,
    });
    const service = new PricingService(repository, new PricingEngine());

    const rule = await service.createRule("owner-1", "offering-1", {
      weekday: 1,
      startMinute: 480,
      endMinute: 600,
      pricePerSlot: 50_000,
    });
    expect(rule.pricePerSlot).toBe(50_000);
    await expect(
      service.createRule("owner-2", "offering-1", {
        weekday: 1,
        startMinute: 600,
        endMinute: 720,
        pricePerSlot: 60_000,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("quotes only an approved active public offering", async () => {
    const repository = new InMemoryPricingRepository();
    repository.offerings.set("offering-1", {
      ownerId: "owner-1",
      venueId: "venue-1",
      venueStatus: "PENDING_APPROVAL",
      isActive: true,
    });
    const service = new PricingService(repository, new PricingEngine());

    await expect(
      service.quote("offering-1", {
        startAt: new Date("2026-09-14T01:00:00.000Z"),
        endAt: new Date("2026-09-14T02:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects overlapping pricing windows for one offering and weekday", async () => {
    const repository = new InMemoryPricingRepository();
    repository.offerings.set("offering-1", {
      ownerId: "owner-1",
      venueId: "venue-1",
      venueStatus: "APPROVED",
      isActive: true,
    });
    const service = new PricingService(repository, new PricingEngine());
    await service.createRule("owner-1", "offering-1", {
      weekday: 1,
      startMinute: 480,
      endMinute: 600,
      pricePerSlot: 50_000,
    });

    await expect(
      service.createRule("owner-1", "offering-1", {
        weekday: 1,
        startMinute: 570,
        endMinute: 720,
        pricePerSlot: 60_000,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("maps the database overlap guard to the same domain conflict", async () => {
    const repository = new InMemoryPricingRepository();
    repository.offerings.set("offering-1", {
      ownerId: "owner-1",
      venueId: "venue-1",
      venueStatus: "APPROVED",
      isActive: true,
    });
    jest.spyOn(repository, "createRule").mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("exclusion constraint", {
        code: "P2004",
        clientVersion: "6.12.0",
      }),
    );
    const service = new PricingService(repository, new PricingEngine());

    await expect(
      service.createRule("owner-1", "offering-1", {
        weekday: 1,
        startMinute: 480,
        endMinute: 600,
        pricePerSlot: 50_000,
      }),
    ).rejects.toMatchObject({
      response: { code: "PRICING_RULE_OVERLAP" },
    });
  });
});
