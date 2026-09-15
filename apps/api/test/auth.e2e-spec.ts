import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AuthController } from "../src/auth/auth.controller";
import { AuthService } from "../src/auth/auth.service";
import { IDENTITY_REPOSITORY } from "../src/auth/identity.repository";
import { PasswordService } from "../src/auth/password.service";
import { InMemoryIdentityRepository } from "../src/auth/testing/in-memory-identity.repository";
import { TokenService } from "../src/auth/token.service";
import { AccessTokenGuard } from "../src/common/auth/access-token.guard";
import { RolesGuard } from "../src/common/auth/roles.guard";
import { UsersController } from "../src/users/users.controller";
import { UsersService } from "../src/users/users.service";
import { AuthRateLimitGuard } from "../src/auth/auth-rate-limit.guard";
import { AuthRateLimitService } from "../src/auth/auth-rate-limit.service";

describe("authentication API", () => {
  let app: INestApplication;
  let repository: InMemoryIdentityRepository;

  beforeAll(async () => {
    repository = new InMemoryIdentityRepository();
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      controllers: [AuthController, UsersController],
      providers: [
        AuthService,
        PasswordService,
        UsersService,
        AccessTokenGuard,
        RolesGuard,
        AuthRateLimitService,
        AuthRateLimitGuard,
        { provide: IDENTITY_REPOSITORY, useValue: repository },
        {
          provide: TokenService,
          inject: [ConfigService],
          useFactory: (config: ConfigService) =>
            new TokenService(
              config.getOrThrow<string>("JWT_ACCESS_SECRET"),
              config.getOrThrow<string>("JWT_REFRESH_SECRET"),
            ),
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.use(cookieParser());
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

  it("registers, logs in, rotates the HttpOnly refresh cookie and logs out", async () => {
    const agent = request.agent(app.getHttpServer());
    const registration = await agent.post("/api/v1/auth/register").send({
      email: "e2e@example.com",
      password: "StrongPass123!",
      phone: "0901234567",
      displayName: "E2E User",
    });
    expect(registration.status).toBe(201);
    const refreshCookie = registration.headers["set-cookie"]?.[0] ?? "";
    expect(refreshCookie).toContain("HttpOnly");
    expect(refreshCookie).toContain("SameSite=Strict");
    expect(refreshCookie).toContain("Path=/api/v1/auth");
    expect(refreshCookie).not.toContain("; Secure");
    expect(registration.body.refreshToken).toBeUndefined();

    await agent
      .post("/api/v1/auth/login")
      .send({ email: "e2e@example.com", password: "StrongPass123!" })
      .expect(200);

    const refreshed = await agent
      .post("/api/v1/auth/refresh")
      .set("Origin", "http://localhost:5173");
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toEqual(expect.any(String));

    expect(
      (
        await agent
          .post("/api/v1/auth/logout")
          .set("Origin", "http://localhost:5173")
      ).status,
    ).toBe(204);
    expect(
      (
        await agent
          .post("/api/v1/auth/refresh")
          .set("Origin", "http://localhost:5173")
      ).status,
    ).toBe(401);
  });

  it("rejects duplicate emails and invalid foreign origins", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/api/v1/auth/register").send({
      email: "origin@example.com",
      password: "StrongPass123!",
      phone: "0901234569",
      displayName: "Origin User",
    });
    const foreignOrigin = await agent
      .post("/api/v1/auth/refresh")
      .set("Origin", "https://attacker.example");
    expect(foreignOrigin.status).toBe(401);
    expect(foreignOrigin.body.message).toBe("Untrusted request origin");

    const duplicate = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: "ORIGIN@example.com",
        password: "StrongPass123!",
        phone: "0901234570",
        displayName: "Duplicate",
      });
    expect(duplicate.status).toBe(409);
  });

  it("rejects unknown registration fields instead of silently trusting them", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: "forged-role@example.com",
        password: "StrongPass123!",
        phone: "0901234568",
        displayName: "Forged Role",
        roles: ["ADMIN"],
      })
      .expect(400);
  });

  it("invalidates an already-issued access token when the account is locked", async () => {
    const registration = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: "locked@example.com",
        password: "StrongPass123!",
        phone: "0901234571",
        displayName: "Locked User",
      })
      .expect(201);
    const user = [...repository.users.values()].find(
      (item) => item.email === "locked@example.com",
    );
    if (!user) throw new Error("test user missing");
    await repository.setLocked(user.id, true);

    const response = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set(
        "Authorization",
        `Bearer ${registration.body.accessToken as string}`,
      );
    expect(response.status).toBe(401);
  });

  it("changes a password, clears the refresh cookie and invalidates old credentials", async () => {
    const agent = request.agent(app.getHttpServer());
    const registration = await agent
      .post("/api/v1/auth/register")
      .send({
        email: "change-password@example.com",
        password: "StrongPass123!",
        phone: "0901234575",
        displayName: "Password User",
      })
      .expect(201);
    const oldAccessToken = registration.body.accessToken as string;

    const changed = await agent
      .patch("/api/v1/me/password")
      .set("Authorization", `Bearer ${oldAccessToken}`)
      .send({
        currentPassword: "StrongPass123!",
        newPassword: "NewStrongPass123!",
      })
      .expect(204);

    const clearedCookie = changed.headers["set-cookie"]?.[0] ?? "";
    expect(clearedCookie).toContain("sports_refresh=;");
    expect(clearedCookie).toContain("Path=/api/v1/auth");
    await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${oldAccessToken}`)
      .expect(401);
    await agent
      .post("/api/v1/auth/refresh")
      .set("Origin", "http://localhost:5173")
      .expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: "change-password@example.com",
        password: "StrongPass123!",
      })
      .expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: "change-password@example.com",
        password: "NewStrongPass123!",
      })
      .expect(200);
  });
});
