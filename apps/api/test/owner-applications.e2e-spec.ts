import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AuthService } from "../src/auth/auth.service";
import { IDENTITY_REPOSITORY } from "../src/auth/identity.repository";
import { PasswordService } from "../src/auth/password.service";
import { InMemoryIdentityRepository } from "../src/auth/testing/in-memory-identity.repository";
import { TokenService } from "../src/auth/token.service";
import { AccessTokenGuard } from "../src/common/auth/access-token.guard";
import { RolesGuard } from "../src/common/auth/roles.guard";
import { AdminOwnerApplicationsController } from "../src/owner-applications/admin-owner-applications.controller";
import { OWNER_APPLICATION_REPOSITORY } from "../src/owner-applications/owner-application.repository";
import { OwnerApplicationsController } from "../src/owner-applications/owner-applications.controller";
import { OwnerApplicationsService } from "../src/owner-applications/owner-applications.service";
import { InMemoryOwnerApplicationRepository } from "../src/owner-applications/testing/in-memory-owner-application.repository";

describe("owner application API", () => {
  let app: INestApplication;
  let customerToken: string;
  let adminToken: string;
  let applications: InMemoryOwnerApplicationRepository;
  let identity: InMemoryIdentityRepository;

  beforeAll(async () => {
    identity = new InMemoryIdentityRepository();
    applications = new InMemoryOwnerApplicationRepository();
    const passwords = new PasswordService();
    const tokens = new TokenService("a".repeat(40), "b".repeat(40));
    const customer = await identity.createUser({
      email: "applicant@example.com",
      phone: "+84901234567",
      displayName: "Applicant",
      passwordHash: await passwords.hash("StrongPass123!"),
    });
    const admin = await identity.createUser({
      email: "admin@example.com",
      phone: "+84901234568",
      displayName: "Admin",
      passwordHash: await passwords.hash("StrongPass123!"),
    });
    await identity.addRole(admin.id, "ADMIN");
    customerToken = (
      await tokens.issue({
        userId: customer.id,
        roles: customer.roles,
        securityVersion: 1,
      })
    ).accessToken;
    adminToken = (
      await tokens.issue({
        userId: admin.id,
        roles: ["CUSTOMER", "ADMIN"],
        securityVersion: 1,
      })
    ).accessToken;
    const moduleRef = await Test.createTestingModule({
      controllers: [
        OwnerApplicationsController,
        AdminOwnerApplicationsController,
      ],
      providers: [
        OwnerApplicationsService,
        AccessTokenGuard,
        RolesGuard,
        Reflector,
        PasswordService,
        { provide: TokenService, useValue: tokens },
        { provide: IDENTITY_REPOSITORY, useValue: identity },
        { provide: OWNER_APPLICATION_REPOSITORY, useValue: applications },
        AuthService,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => app.close());

  it("forbids a customer from admin review endpoints", async () => {
    expect(
      (
        await request(app.getHttpServer())
          .get("/api/v1/admin/owner-applications")
          .set("Authorization", `Bearer ${customerToken}`)
      ).status,
    ).toBe(403);
  });

  it("submits and approves an application with role and audit side effects", async () => {
    const submitted = await request(app.getHttpServer())
      .post("/api/v1/owner-applications")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ businessName: "Sân E2E", experience: "Ba năm" });
    expect(submitted.status).toBe(201);

    const approved = await request(app.getHttpServer())
      .post(
        `/api/v1/admin/owner-applications/${submitted.body.id as string}/approve`,
      )
      .set("Authorization", `Bearer ${adminToken}`);
    expect(approved.status).toBe(201);
    expect(applications.audits).toHaveLength(1);
    expect(applications.roles.get(submitted.body.userId)).toContain("OWNER");
  });
});
