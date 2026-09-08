import { INestApplication, ServiceUnavailableException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { HealthController } from "../src/health/health.controller";
import { ReadinessService } from "../src/health/readiness.service";

describe("readiness API", () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it("returns 503 when PostgreSQL or Redis is unavailable", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: ReadinessService,
          useValue: {
            assertReady: () =>
              Promise.reject(
                new ServiceUnavailableException({
                  code: "DEPENDENCY_UNAVAILABLE",
                  message: "Dịch vụ phụ thuộc chưa sẵn sàng.",
                }),
              ),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();

    const response = await request(app.getHttpServer())
      .get("/api/v1/ready")
      .expect(503);
    expect(response.body.code).toBe("DEPENDENCY_UNAVAILABLE");
  });
});
