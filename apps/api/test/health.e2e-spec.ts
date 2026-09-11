import request from "supertest";
import { createApp } from "../src/bootstrap";

describe("health API", () => {
  it("reports process health under the versioned prefix", async () => {
    const app = await createApp();
    await app.init();

    const response = await request(app.getHttpServer())
      .get("/api/v1/health")
      .expect(200)
      .expect({ status: "ok" });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.headers["content-security-policy"]).toContain(
      "default-src 'self'",
    );

    await app.close();
  });

  it("publishes the health operation in OpenAPI", async () => {
    const app = await createApp();
    await app.init();

    const response = await request(app.getHttpServer())
      .get("/docs-json")
      .expect(200);
    expect(response.body.paths["/api/v1/health"]).toBeDefined();

    await app.close();
  });
});
