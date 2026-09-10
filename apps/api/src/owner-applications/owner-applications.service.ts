import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  OWNER_APPLICATION_REPOSITORY,
  OwnerApplicationRepository,
} from "./owner-application.repository";

@Injectable()
export class OwnerApplicationsService {
  constructor(
    @Inject(OWNER_APPLICATION_REPOSITORY)
    private readonly repository: OwnerApplicationRepository,
  ) {}

  async submit(
    userId: string,
    input: { businessName: string; experience?: string },
  ) {
    if (await this.repository.hasPending(userId)) {
      throw new ConflictException("A pending owner application already exists");
    }
    return this.repository.create(userId, {
      businessName: input.businessName.trim(),
      experience: input.experience?.trim() || null,
    });
  }

  async mine(userId: string, page = 1, pageSize = 20) {
    const result = await this.repository.findByUser(
      userId,
      (page - 1) * pageSize,
      pageSize,
    );
    return { ...result, page, pageSize };
  }

  async pending(page = 1, pageSize = 20) {
    const result = await this.repository.listPending(
      (page - 1) * pageSize,
      pageSize,
    );
    return { ...result, page, pageSize };
  }

  approve(reviewerId: string, applicationId: string) {
    return this.requiredReview(applicationId, reviewerId, "APPROVED", null);
  }

  async reject(reviewerId: string, applicationId: string, reason: string) {
    if (reason.trim().length < 10) {
      throw new BadRequestException(
        "Rejection reason must contain at least 10 characters",
      );
    }
    return this.requiredReview(
      applicationId,
      reviewerId,
      "REJECTED",
      reason.trim(),
    );
  }

  private async requiredReview(
    id: string,
    reviewerId: string,
    decision: "APPROVED" | "REJECTED",
    reason: string | null,
  ) {
    const result = await this.repository.review(
      id,
      reviewerId,
      decision,
      reason,
    );
    if (!result)
      throw new NotFoundException("Pending owner application not found");
    return result;
  }
}
