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
import { OBJECT_STORAGE } from "../src/storage/object-storage";
import { AdminVenuesController } from "../src/venues/admin-venues.controller";
import { OwnerVenuesController } from "../src/venues/owner-venues.controller";
import { PublicVenuesController } from "../src/venues/public-venues.controller";
import { InMemoryVenueRepository } from "../src/venues/testing/in-memory-venue.repository";
import { VENUE_REPOSITORY } from "../src/venues/venue.repository";
import { VenuesService } from "../src/venues/venues.service";

const venueInput = {
  areaId: "10000000-0000-4000-8000-000000000001",
  name: "Sân E2E",
  address: "12 Nguyễn Huệ, Quận 1",
  description: "Cụm sân phục vụ kiểm thử end to end",
  latitude: 10.7731,
  longitude: 106.7031,
};

describe("venue inventory API", () => {
  let app: INestApplication;
  let ownerToken: string;
  let otherOwnerToken: string;
  let customerToken: string;
  let adminToken: string;
  const storedKeys: string[] = [];

  beforeAll(async () => {
    const identity = new InMemoryIdentityRepository();
    const venues = new InMemoryVenueRepository();
    const passwords = new PasswordService();
    const tokens = new TokenService("a".repeat(40), "b".repeat(40));
    async function user(email: string, roles: Array<"OWNER" | "ADMIN"> = []) {
      const record = await identity.createUser({
        email,
        phone: "+84901234567",
        displayName: email,
        passwordHash: await passwords.hash("StrongPass123!"),
      });
      for (const role of roles) await identity.addRole(record.id, role);
      const current = await identity.findUserById(record.id);
      if (!current) throw new Error("test user missing");
      return (
        await tokens.issue({
          userId: current.id,
          roles: current.roles,
          securityVersion: 1,
        })
      ).accessToken;
    }
    [ownerToken, otherOwnerToken, customerToken, adminToken] =
      await Promise.all([
        user("owner@example.com", ["OWNER"]),
        user("other@example.com", ["OWNER"]),
        user("customer@example.com"),
        user("admin@example.com", ["ADMIN"]),
      ]);
    const moduleRef = await Test.createTestingModule({
      controllers: [
        PublicVenuesController,
        OwnerVenuesController,
        AdminVenuesController,
      ],
      providers: [
        VenuesService,
        AccessTokenGuard,
        RolesGuard,
        Reflector,
        PasswordService,
        AuthService,
        { provide: TokenService, useValue: tokens },
        { provide: IDENTITY_REPOSITORY, useValue: identity },
        { provide: VENUE_REPOSITORY, useValue: venues },
        {
          provide: OBJECT_STORAGE,
          useValue: {
            putObject: async (key: string) => {
              storedKeys.push(key);
            },
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

  it("allows anonymous browsing but never exposes a venue before approval", async () => {
    expect(
      (await request(app.getHttpServer()).get("/api/v1/venues")).status,
    ).toBe(200);
    const forbidden = await request(app.getHttpServer())
      .post("/api/v1/owner/venues")
      .set("Authorization", `Bearer ${customerToken}`)
      .send(venueInput);
    expect(forbidden.status).toBe(403);

    const created = await request(app.getHttpServer())
      .post("/api/v1/owner/venues")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(venueInput);
    expect(created.status).toBe(201);
    expect(
      (await request(app.getHttpServer()).get("/api/v1/venues")).body.items,
    ).toEqual([]);

    const crossOwner = await request(app.getHttpServer())
      .patch(`/api/v1/owner/venues/${created.body.id as string}`)
      .set("Authorization", `Bearer ${otherOwnerToken}`)
      .send({ name: "Không được phép" });
    expect(crossOwner.status).toBe(403);

    expect(
      (
        await request(app.getHttpServer())
          .post(`/api/v1/admin/venues/${created.body.id as string}/approve`)
          .set("Authorization", `Bearer ${adminToken}`)
      ).status,
    ).toBe(201);
    expect(
      (await request(app.getHttpServer()).get("/api/v1/venues")).body.items,
    ).toHaveLength(1);

    await request(app.getHttpServer())
      .patch(`/api/v1/owner/venues/${created.body.id as string}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ address: "99 Lê Lợi, Quận 1" })
      .expect(200);
    expect(
      (await request(app.getHttpServer()).get("/api/v1/venues")).body.items,
    ).toEqual([]);
  });

  it("checks venue ownership before writing an uploaded image", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/owner/venues")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ ...venueInput, name: "Sân upload" })
      .expect(201);
    const before = storedKeys.length;

    await request(app.getHttpServer())
      .post(`/api/v1/owner/venues/${created.body.id as string}/images`)
      .set("Authorization", `Bearer ${otherOwnerToken}`)
      .field("altText", "Ảnh sân")
      .attach("image", Buffer.from("fake jpeg"), {
        filename: "venue.jpg",
        contentType: "image/jpeg",
      })
      .expect(403);

    expect(storedKeys).toHaveLength(before);
  });
});
