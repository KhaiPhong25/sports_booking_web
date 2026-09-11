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
import { OBJECT_STORAGE } from "../src/storage/object-storage";
import { AdminUsersController } from "../src/users/admin-users.controller";
import { UsersService } from "../src/users/users.service";
import { AdminVenuesController } from "../src/venues/admin-venues.controller";
import { OwnerVenuesController } from "../src/venues/owner-venues.controller";
import { PublicVenuesController } from "../src/venues/public-venues.controller";
import { InMemoryVenueRepository } from "../src/venues/testing/in-memory-venue.repository";
import { VENUE_REPOSITORY } from "../src/venues/venue.repository";
import { VenuesService } from "../src/venues/venues.service";

describe("authorization matrix at the HTTP boundary", () => {
  let app: INestApplication;
  const tokens: Record<"customer" | "owner" | "otherOwner" | "admin", string> =
    {
      customer: "",
      owner: "",
      otherOwner: "",
      admin: "",
    };
  let applicationId = "";
  let venueId = "";

  beforeAll(async () => {
    const identity = new InMemoryIdentityRepository();
    const applications = new InMemoryOwnerApplicationRepository();
    const venues = new InMemoryVenueRepository();
    const passwords = new PasswordService();
    const tokenService = new TokenService("a".repeat(40), "b".repeat(40));
    const users: Record<string, string> = {};
    for (const [name, extraRoles] of [
      ["customer", []],
      ["owner", ["OWNER"]],
      ["otherOwner", ["OWNER"]],
      ["admin", ["ADMIN"]],
    ] as const) {
      const user = await identity.createUser({
        email: `${name}@matrix.example`,
        phone: "+84901234567",
        displayName: name,
        passwordHash: await passwords.hash("StrongPass123!"),
      });
      for (const role of extraRoles) await identity.addRole(user.id, role);
      const current = await identity.findUserById(user.id);
      if (!current) throw new Error("Matrix fixture user missing");
      users[name] = current.id;
      tokens[name] = (
        await tokenService.issue({
          userId: current.id,
          roles: current.roles,
          securityVersion: current.securityVersion,
        })
      ).accessToken;
    }
    const application = await applications.create(users.customer!, {
      businessName: "Matrix application",
      experience: "Ba năm vận hành",
    });
    applicationId = application.id;
    const venue = await venues.createVenue(users.owner!, {
      areaId: "10000000-0000-4000-8000-000000000001",
      name: "Matrix venue",
      address: "12 Nguyễn Huệ, Quận 1",
      description: "Venue dùng kiểm tra ma trận phân quyền",
      latitude: 10.7731,
      longitude: 106.7031,
    });
    venueId = venue.id;

    const moduleRef = await Test.createTestingModule({
      controllers: [
        AdminUsersController,
        OwnerApplicationsController,
        AdminOwnerApplicationsController,
        PublicVenuesController,
        OwnerVenuesController,
        AdminVenuesController,
      ],
      providers: [
        AuthService,
        PasswordService,
        UsersService,
        OwnerApplicationsService,
        VenuesService,
        AccessTokenGuard,
        RolesGuard,
        Reflector,
        { provide: TokenService, useValue: tokenService },
        { provide: IDENTITY_REPOSITORY, useValue: identity },
        { provide: OWNER_APPLICATION_REPOSITORY, useValue: applications },
        { provide: VENUE_REPOSITORY, useValue: venues },
        {
          provide: OBJECT_STORAGE,
          useValue: {
            putObject: async () => undefined,
            getObject: async () => ({
              data: Buffer.from("image"),
              contentType: "image/jpeg",
            }),
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => app.close());

  it("allows public reads and denies anonymous protected access", async () => {
    await request(app.getHttpServer()).get("/api/v1/venues").expect(200);
    await request(app.getHttpServer()).get("/api/v1/admin/users").expect(401);
    await request(app.getHttpServer()).get("/api/v1/owner/venues").expect(401);
  });

  it("allows customer actions but denies owner and admin capabilities", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/owner-applications")
      .set("Authorization", bearer(tokens.customer))
      .expect(200);
    await request(app.getHttpServer())
      .post("/api/v1/owner/venues")
      .set("Authorization", bearer(tokens.customer))
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .get("/api/v1/admin/users")
      .set("Authorization", bearer(tokens.customer))
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/owner-applications/${applicationId}/approve`)
      .set("Authorization", bearer(tokens.customer))
      .expect(403);
  });

  it("allows only the owning owner to mutate a venue", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/owner/venues")
      .set("Authorization", bearer(tokens.owner))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/owner/venues/${venueId}`)
      .set("Authorization", bearer(tokens.otherOwner))
      .send({ name: "Không được phép" })
      .expect(403);
    await request(app.getHttpServer())
      .get("/api/v1/admin/users")
      .set("Authorization", bearer(tokens.owner))
      .expect(403);
  });

  it("allows admin moderation but not owner resource management", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/admin/users")
      .set("Authorization", bearer(tokens.admin))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/owner-applications/${applicationId}/approve`)
      .set("Authorization", bearer(tokens.admin))
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/venues/${venueId}/approve`)
      .set("Authorization", bearer(tokens.admin))
      .expect(201);
    await request(app.getHttpServer())
      .get("/api/v1/owner/venues")
      .set("Authorization", bearer(tokens.admin))
      .expect(403);
  });

  function bearer(token: string) {
    return `Bearer ${token}`;
  }
});
