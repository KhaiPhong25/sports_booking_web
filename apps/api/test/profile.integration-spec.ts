import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../src/bootstrap";
import { OBJECT_STORAGE, ObjectStorage } from "../src/storage/object-storage";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("user profile with PostgreSQL and MinIO", () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const emails: string[] = [];
  const avatarKeys: string[] = [];
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    const storage = app.get<ObjectStorage>(OBJECT_STORAGE);
    await Promise.all(avatarKeys.map((key) => storage.deleteObject(key)));
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
    await prisma.$disconnect();
  });

  it("persists safe profile and avatar metadata through real adapters", async () => {
    const email = `profile-${randomUUID()}@example.com`;
    emails.push(email);
    const registration = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email,
        password: "LocalDemo123!",
        phone: "0901234567",
        displayName: "Profile Integration",
      })
      .expect(201);
    const userId = registration.body.user.id as string;
    avatarKeys.push(`user-avatars/${userId}/avatar`);
    const accessToken = registration.body.accessToken as string;

    const updated = await request(app.getHttpServer())
      .patch("/api/v1/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ displayName: "Nguyễn An", phone: "090 987 6543" })
      .expect(200);
    expect(updated.body).toMatchObject({
      id: userId,
      email,
      displayName: "Nguyễn An",
      phone: "+84909876543",
      avatarUrl: null,
    });
    expect(updated.body).not.toHaveProperty("passwordHash");
    expect(updated.body).not.toHaveProperty("securityVersion");
    expect(updated.body).not.toHaveProperty("avatarObjectKey");

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

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { avatarObjectKey: true, avatarUpdatedAt: true },
    });
    expect(stored.avatarObjectKey).toBe(`user-avatars/${userId}/avatar`);
    expect(stored.avatarUpdatedAt).toBeInstanceOf(Date);

    const image = await request(app.getHttpServer())
      .get(`/api/v1/users/${userId}/avatar`)
      .expect(200);
    expect(image.headers["content-type"]).toContain("image/png");
    expect(image.body).toEqual(png);

    await request(app.getHttpServer())
      .delete("/api/v1/me/avatar")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);
    expect(
      await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { avatarObjectKey: true, avatarUpdatedAt: true },
      }),
    ).toEqual({ avatarObjectKey: null, avatarUpdatedAt: null });
  });

  it("invalidates database sessions and old credentials after password change", async () => {
    const email = `password-${randomUUID()}@example.com`;
    emails.push(email);
    const agent = request.agent(app.getHttpServer());
    const registration = await agent
      .post("/api/v1/auth/register")
      .send({
        email,
        password: "LocalDemo123!",
        phone: "0901234568",
        displayName: "Password Integration",
      })
      .expect(201);
    const userId = registration.body.user.id as string;
    const oldAccessToken = registration.body.accessToken as string;

    const changed = await agent
      .patch("/api/v1/me/password")
      .set("Authorization", `Bearer ${oldAccessToken}`)
      .send({
        currentPassword: "LocalDemo123!",
        newPassword: "ChangedDemo123!",
      })
      .expect(204);
    expect(changed.headers["set-cookie"]?.[0] ?? "").toContain(
      "sports_refresh=;",
    );

    const persisted = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        securityVersion: true,
        refreshSessions: { where: { revokedAt: null }, select: { id: true } },
      },
    });
    expect(persisted.securityVersion).toBe(2);
    expect(persisted.refreshSessions).toEqual([]);
    await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${oldAccessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: "LocalDemo123!" })
      .expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: "ChangedDemo123!" })
      .expect(200);
  });
});
