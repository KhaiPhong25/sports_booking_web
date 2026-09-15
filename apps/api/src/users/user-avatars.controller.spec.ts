import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AuthService } from "../auth/auth.service";
import { IDENTITY_REPOSITORY } from "../auth/identity.repository";
import { PasswordService } from "../auth/password.service";
import { InMemoryIdentityRepository } from "../auth/testing/in-memory-identity.repository";
import { TokenService } from "../auth/token.service";
import { AccessTokenGuard } from "../common/auth/access-token.guard";
import { OBJECT_STORAGE, ObjectStorage } from "../storage/object-storage";
import { UserAvatarsController } from "./user-avatars.controller";
import { UsersService } from "./users.service";

class MemoryObjectStorage implements ObjectStorage {
  readonly objects = new Map<string, { data: Buffer; contentType: string }>();

  async putObject(
    key: string,
    data: Buffer,
    contentType: string,
  ): Promise<void> {
    this.objects.set(key, { data: Buffer.from(data), contentType });
  }

  async getObject(key: string): Promise<{ data: Buffer; contentType: string }> {
    const value = this.objects.get(key);
    if (!value) throw new NotFoundException("Object not found");
    return { data: Buffer.from(value.data), contentType: value.contentType };
  }

  async deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
  }
}

describe("user avatar HTTP API", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let app: INestApplication;
  let accessToken: string;
  let userId: string;
  let repository: InMemoryIdentityRepository;
  let storage: MemoryObjectStorage;

  beforeAll(async () => {
    repository = new InMemoryIdentityRepository();
    storage = new MemoryObjectStorage();
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      controllers: [UserAvatarsController],
      providers: [
        AuthService,
        PasswordService,
        UsersService,
        AccessTokenGuard,
        { provide: IDENTITY_REPOSITORY, useValue: repository },
        { provide: OBJECT_STORAGE, useValue: storage },
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
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    const registration = await moduleRef.get(AuthService).register({
      email: "avatar@example.com",
      password: "StrongPass123!",
      phone: "0901234567",
      displayName: "Avatar User",
    });
    accessToken = registration.accessToken;
    userId = registration.user.id;
  });

  afterAll(async () => app.close());

  it("requires authentication before accepting an avatar", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/me/avatar")
      .attach("avatar", png, {
        filename: "avatar.png",
        contentType: "image/png",
      })
      .expect(401);
  });

  it("rejects a forged image before writing to object storage", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/me/avatar")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("avatar", Buffer.from("not-png!"), {
        filename: "avatar.png",
        contentType: "image/png",
      })
      .expect(400);

    expect(storage.objects.size).toBe(0);
  });

  it("stores and serves an avatar with safe response headers", async () => {
    const uploaded = await request(app.getHttpServer())
      .post("/api/v1/me/avatar")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("avatar", png, {
        filename: "avatar.png",
        contentType: "image/png",
      })
      .expect(201);

    expect(uploaded.body.avatarUrl).toMatch(
      new RegExp(`^/api/v1/users/${userId}/avatar\\?v=\\d+$`),
    );
    expect([...storage.objects.keys()]).toEqual([
      `user-avatars/${userId}/avatar`,
    ]);

    const image = await request(app.getHttpServer())
      .get(`/api/v1/users/${userId}/avatar`)
      .expect(200);
    expect(image.headers["content-type"]).toContain("image/png");
    expect(image.headers["x-content-type-options"]).toBe("nosniff");
    expect(image.headers["cache-control"]).toBe(
      "public, max-age=86400, immutable",
    );
    expect(image.body).toEqual(png);
  });

  it("removes an avatar idempotently", async () => {
    await request(app.getHttpServer())
      .delete("/api/v1/me/avatar")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);
    await request(app.getHttpServer())
      .delete("/api/v1/me/avatar")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    expect(storage.objects.size).toBe(0);
    expect((await repository.findUserById(userId))?.avatarObjectKey).toBeNull();
    await request(app.getHttpServer())
      .get(`/api/v1/users/${userId}/avatar`)
      .expect(404);
  });
});
