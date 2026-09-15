import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { MinioObjectStorage } from "../src/storage/minio-object-storage";

const describeStorage =
  process.env.TEST_OBJECT_STORAGE === "true" ? describe : describe.skip;

describeStorage("MinIO S3-compatible storage", () => {
  it("uploads, reads and deletes an object", async () => {
    const storage = new MinioObjectStorage(new ConfigService(process.env));
    const key = `integration/${randomUUID()}.png`;
    await storage.putObject(key, Buffer.from("not-a-real-image"), "image/png");
    const stored = await storage.getObject(key);
    expect(stored.contentType).toBe("image/png");
    expect(stored.data.toString()).toBe("not-a-real-image");

    await storage.deleteObject(key);

    await expect(storage.getObject(key)).rejects.toBeDefined();
  });
});
