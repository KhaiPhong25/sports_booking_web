import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { MinioObjectStorage } from "../src/storage/minio-object-storage";

const describeStorage =
  process.env.TEST_OBJECT_STORAGE === "true" ? describe : describe.skip;

describeStorage("MinIO S3-compatible storage", () => {
  it("uploads a venue image object and returns its stable URL", async () => {
    const storage = new MinioObjectStorage(new ConfigService(process.env));
    const key = `integration/${randomUUID()}.png`;
    await storage.putObject(key, Buffer.from("not-a-real-image"), "image/png");
    const stored = await storage.getObject(key);
    expect(stored.contentType).toBe("image/png");
    expect(stored.data.toString()).toBe("not-a-real-image");
  });
});
