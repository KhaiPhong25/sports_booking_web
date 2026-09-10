import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../src/bootstrap";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("notification ownership API", () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const suffix = randomUUID();
  let app: INestApplication;
  let firstUserId: string;
  let secondUserId: string;
  let firstToken: string;
  let secondNotificationId: string;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    const first = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: `notification-first-${suffix}@example.com`,
        password: "StrongPassword123!",
        phone: "+84901111111",
        displayName: "Khách nhận thông báo",
      });
    const second = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: `notification-second-${suffix}@example.com`,
        password: "StrongPassword123!",
        phone: "+84902222222",
        displayName: "Khách khác",
      });
    firstUserId = first.body.user.id as string;
    secondUserId = second.body.user.id as string;
    firstToken = first.body.accessToken as string;
    await prisma.notification.createMany({
      data: [
        {
          userId: firstUserId,
          type: "BOOKING_CONFIRMED",
          payload: { bookingId: randomUUID() },
        },
        {
          userId: firstUserId,
          type: "BOOKING_CANCELLED",
          payload: { bookingId: randomUUID() },
          readAt: new Date(),
        },
      ],
    });
    secondNotificationId = (
      await prisma.notification.create({
        data: {
          userId: secondUserId,
          type: "BOOKING_EXPIRED",
          payload: { bookingId: randomUUID() },
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({
      where: { userId: { in: [firstUserId, secondUserId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [firstUserId, secondUserId] } },
    });
    await app.close();
    await prisma.$disconnect();
  });

  it("lists only the principal's unread notifications", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/notifications?unread=true&page=1&pageSize=10")
      .set("Authorization", `Bearer ${firstToken}`)
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toEqual(
      expect.objectContaining({
        userId: firstUserId,
        type: "BOOKING_CONFIRMED",
        readAt: null,
      }),
    );
  });

  it("marks only an owned notification as read", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/notifications/${secondNotificationId}/read`)
      .set("Authorization", `Bearer ${firstToken}`)
      .expect(404);

    const own = await prisma.notification.findFirstOrThrow({
      where: { userId: firstUserId, readAt: null },
    });
    const response = await request(app.getHttpServer())
      .post(`/api/v1/notifications/${own.id}/read`)
      .set("Authorization", `Bearer ${firstToken}`)
      .expect(200);
    expect(response.body.readAt).toEqual(expect.any(String));
  });

  it("rejects a malformed notification id before querying PostgreSQL", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/notifications/not-a-uuid/read")
      .set("Authorization", `Bearer ${firstToken}`)
      .expect(400);
  });
});
