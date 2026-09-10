import { ConflictException } from "@nestjs/common";
import { InMemoryOwnerApplicationRepository } from "./testing/in-memory-owner-application.repository";
import { OwnerApplicationsService } from "./owner-applications.service";

describe("OwnerApplicationsService", () => {
  it("allows one pending application and exposes it to its applicant", async () => {
    const repository = new InMemoryOwnerApplicationRepository();
    const service = new OwnerApplicationsService(repository);
    const created = await service.submit("customer-1", {
      businessName: "Sân Xanh",
      experience: "Ba năm vận hành sân",
    });

    expect((await service.mine("customer-1")).items[0]?.id).toBe(created.id);
    await expect(
      service.submit("customer-1", { businessName: "Trùng", experience: "" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("approves atomically by granting OWNER and recording an audit event", async () => {
    const repository = new InMemoryOwnerApplicationRepository();
    const service = new OwnerApplicationsService(repository);
    const application = await service.submit("customer-2", {
      businessName: "Nhà thi đấu An Bình",
      experience: "Hai năm",
    });

    const approved = await service.approve("admin-1", application.id);

    expect(approved.status).toBe("APPROVED");
    expect(repository.roles.get("customer-2")).toContain("OWNER");
    expect(repository.audits).toEqual([
      expect.objectContaining({
        actorId: "admin-1",
        action: "OWNER_APPLICATION_APPROVED",
        resourceId: application.id,
      }),
    ]);
  });

  it("requires a meaningful rejection reason and never grants OWNER", async () => {
    const repository = new InMemoryOwnerApplicationRepository();
    const service = new OwnerApplicationsService(repository);
    const application = await service.submit("customer-3", {
      businessName: "Sân Chưa Đủ Hồ Sơ",
      experience: "",
    });

    await expect(
      service.reject("admin-1", application.id, "x"),
    ).rejects.toThrow("reason");
    const rejected = await service.reject(
      "admin-1",
      application.id,
      "Thiếu giấy tờ chứng minh quyền vận hành",
    );
    expect(rejected.status).toBe("REJECTED");
    expect(repository.roles.get("customer-3") ?? []).not.toContain("OWNER");
  });
});
