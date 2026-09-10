import { randomUUID } from "node:crypto";
import {
  OwnerApplicationRecord,
  OwnerApplicationRepository,
  OwnerApplicationStatus,
} from "../owner-application.repository";

export class InMemoryOwnerApplicationRepository implements OwnerApplicationRepository {
  readonly applications = new Map<string, OwnerApplicationRecord>();
  readonly roles = new Map<string, string[]>();
  readonly audits: Array<{
    actorId: string;
    action: string;
    resourceId: string;
    reason: string | null;
  }> = [];

  async create(
    userId: string,
    input: { businessName: string; experience: string | null },
  ): Promise<OwnerApplicationRecord> {
    const record: OwnerApplicationRecord = {
      id: randomUUID(),
      userId,
      ...input,
      status: "PENDING",
      reviewReason: null,
      reviewedById: null,
      reviewedAt: null,
      createdAt: new Date(),
    };
    this.applications.set(record.id, record);
    return structuredClone(record);
  }

  async hasPending(userId: string): Promise<boolean> {
    return [...this.applications.values()].some(
      (item) => item.userId === userId && item.status === "PENDING",
    );
  }

  async findByUser(userId: string, skip: number, take: number) {
    const all = [...this.applications.values()].filter(
      (item) => item.userId === userId,
    );
    return { items: all.slice(skip, skip + take), total: all.length };
  }

  async listPending(skip: number, take: number) {
    const all = [...this.applications.values()].filter(
      (item) => item.status === "PENDING",
    );
    return { items: all.slice(skip, skip + take), total: all.length };
  }

  async review(
    id: string,
    reviewerId: string,
    decision: Exclude<OwnerApplicationStatus, "PENDING">,
    reason: string | null,
  ): Promise<OwnerApplicationRecord | null> {
    const current = this.applications.get(id);
    if (!current || current.status !== "PENDING") return null;
    const reviewed = {
      ...current,
      status: decision,
      reviewReason: reason,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    };
    this.applications.set(id, reviewed);
    if (decision === "APPROVED") {
      const roles = this.roles.get(current.userId) ?? ["CUSTOMER"];
      if (!roles.includes("OWNER")) roles.push("OWNER");
      this.roles.set(current.userId, roles);
    }
    this.audits.push({
      actorId: reviewerId,
      action: `OWNER_APPLICATION_${decision}`,
      resourceId: id,
      reason,
    });
    return structuredClone(reviewed);
  }
}
