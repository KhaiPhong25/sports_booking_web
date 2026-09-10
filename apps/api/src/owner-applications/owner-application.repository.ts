export const OWNER_APPLICATION_REPOSITORY = Symbol(
  "OWNER_APPLICATION_REPOSITORY",
);

export type OwnerApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface OwnerApplicationRecord {
  id: string;
  userId: string;
  businessName: string;
  experience: string | null;
  status: OwnerApplicationStatus;
  reviewReason: string | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export interface OwnerApplicationRepository {
  create(
    userId: string,
    input: { businessName: string; experience: string | null },
  ): Promise<OwnerApplicationRecord>;
  hasPending(userId: string): Promise<boolean>;
  findByUser(
    userId: string,
    skip: number,
    take: number,
  ): Promise<{ items: OwnerApplicationRecord[]; total: number }>;
  listPending(
    skip: number,
    take: number,
  ): Promise<{ items: OwnerApplicationRecord[]; total: number }>;
  review(
    id: string,
    reviewerId: string,
    decision: Exclude<OwnerApplicationStatus, "PENDING">,
    reason: string | null,
  ): Promise<OwnerApplicationRecord | null>;
}
