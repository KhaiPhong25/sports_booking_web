import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { SchedulePolicy, WeeklyWindow } from "./schedule-policy";
import {
  ClosureInput,
  SCHEDULING_REPOSITORY,
  SchedulingRepository,
} from "./scheduling.repository";

@Injectable()
export class SchedulingService {
  private readonly policy = new SchedulePolicy();

  constructor(
    @Inject(SCHEDULING_REPOSITORY)
    private readonly repository: SchedulingRepository,
  ) {}

  async listHours(ownerId: string, venueId: string) {
    await this.assertVenueOwner(ownerId, venueId);
    return this.repository.listHours(venueId);
  }
  async replaceHours(
    ownerId: string,
    venueId: string,
    windows: WeeklyWindow[],
  ) {
    await this.assertVenueOwner(ownerId, venueId);
    try {
      this.policy.validateWeeklyWindows(windows);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    const saved = await this.repository.replaceHoursIfNoBookings(
      venueId,
      windows,
      new Date(),
    );
    if (!saved)
      throw new ConflictException({
        code: "RESOURCE_HAS_ACTIVE_BOOKINGS",
        message: "Operating hours cannot change while future bookings exist",
      });
    return saved;
  }
  async listClosures(ownerId: string, venueId: string) {
    await this.assertVenueOwner(ownerId, venueId);
    return this.repository.listClosures(venueId);
  }
  async createClosure(ownerId: string, venueId: string, input: ClosureInput) {
    await this.assertVenueOwner(ownerId, venueId);
    await this.validateClosure(venueId, input);
    const created = await this.repository.createClosureIfNoBookings(venueId, {
      ...input,
      reason: input.reason.trim(),
    });
    if (!created) this.throwClosureConflict();
    return created;
  }
  async updateClosure(ownerId: string, id: string, input: ClosureInput) {
    const closure = await this.repository.findClosure(id);
    if (!closure) throw new NotFoundException("Closure not found");
    if (closure.ownerId !== ownerId)
      throw new ForbiddenException("Venue ownership required");
    await this.validateClosure(closure.venueId, input);
    const updated = await this.repository.updateClosureIfNoBookings(
      id,
      closure.venueId,
      {
        ...input,
        reason: input.reason.trim(),
      },
    );
    if (!updated) this.throwClosureConflict();
    return updated;
  }
  async deleteClosure(ownerId: string, id: string) {
    const closure = await this.repository.findClosure(id);
    if (!closure) throw new NotFoundException("Closure not found");
    if (closure.ownerId !== ownerId)
      throw new ForbiddenException("Venue ownership required");
    await this.repository.deleteClosure(id);
  }

  private async validateClosure(venueId: string, input: ClosureInput) {
    if (
      Number.isNaN(input.startAt.getTime()) ||
      Number.isNaN(input.endAt.getTime()) ||
      input.startAt >= input.endAt ||
      input.reason.trim().length < 3
    ) {
      throw new BadRequestException("Invalid closure interval or reason");
    }
    if (input.courtId) {
      const courtVenue = await this.repository.courtVenue(input.courtId);
      if (courtVenue !== venueId) {
        throw new BadRequestException("Court must belong to the same venue");
      }
    }
  }

  private throwClosureConflict(): never {
    throw new ConflictException({
      code: "RESOURCE_HAS_ACTIVE_BOOKINGS",
      message: "Closure overlaps an active booking",
    });
  }

  private async assertVenueOwner(ownerId: string, venueId: string) {
    const actualOwner = await this.repository.venueOwner(venueId);
    if (!actualOwner) throw new NotFoundException("Venue not found");
    if (actualOwner !== ownerId)
      throw new ForbiddenException("Venue ownership required");
  }
}
