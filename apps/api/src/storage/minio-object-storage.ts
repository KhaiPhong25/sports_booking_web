import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { ObjectStorage } from "./object-storage";

@Injectable()
export class MinioObjectStorage implements ObjectStorage {
  private readonly client: S3Client;
  private readonly bucket: string;
  private bucketReady?: Promise<void>;

  constructor(config: ConfigService) {
    const endPoint = config.getOrThrow<string>("MINIO_ENDPOINT");
    const port = Number(config.getOrThrow<number>("MINIO_PORT"));
    const useSSL = config.get<string>("MINIO_USE_SSL") === "true";
    this.bucket = config.getOrThrow<string>("MINIO_BUCKET");
    const endpoint = `${useSSL ? "https" : "http"}://${endPoint}:${port}`;
    this.client = new S3Client({
      endpoint,
      region: "us-east-1",
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.getOrThrow<string>("MINIO_ACCESS_KEY"),
        secretAccessKey: config.getOrThrow<string>("MINIO_SECRET_KEY"),
      },
    });
  }

  async putObject(
    key: string,
    data: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      }),
    );
  }

  async getObject(key: string): Promise<{ data: Buffer; contentType: string }> {
    await this.ensureBucket();
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!result.Body) throw new Error("Object body is missing");
    return {
      data: Buffer.from(await result.Body.transformToByteArray()),
      contentType: result.ContentType ?? "application/octet-stream",
    };
  }

  private ensureBucket(): Promise<void> {
    this.bucketReady ??= (async () => {
      try {
        await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      } catch {
        await this.client.send(
          new CreateBucketCommand({ Bucket: this.bucket }),
        );
      }
    })();
    return this.bucketReady;
  }
}
