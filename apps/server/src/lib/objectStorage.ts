import type { Express } from "express";
import { Client as MinioClient } from "minio";
import { env } from "../env.js";

let objectStorageClient: MinioClient | null = null;

function getObjectStorageClient() {
  if (objectStorageClient) {
    return objectStorageClient;
  }

  if (
    !env.S3_BUCKET ||
    !env.S3_ENDPOINT ||
    !env.S3_ACCESS_KEY_ID ||
    !env.S3_SECRET_ACCESS_KEY
  ) {
    throw new Error("S3 storage is enabled but the S3 environment variables are incomplete.");
  }

  const endpoint = new URL(env.S3_ENDPOINT);
  objectStorageClient = new MinioClient({
    endPoint: endpoint.hostname,
    port: endpoint.port ? Number(endpoint.port) : undefined,
    useSSL: endpoint.protocol === "https:",
    accessKey: env.S3_ACCESS_KEY_ID,
    secretKey: env.S3_SECRET_ACCESS_KEY,
    region: env.S3_REGION,
    pathStyle: true
  });

  return objectStorageClient;
}

function getRequiredS3Config() {
  if (
    !env.S3_BUCKET ||
    !env.S3_ENDPOINT ||
    !env.S3_ACCESS_KEY_ID ||
    !env.S3_SECRET_ACCESS_KEY
  ) {
    throw new Error("S3 storage is enabled but the S3 environment variables are incomplete.");
  }

  return {
    bucket: env.S3_BUCKET,
    endpoint: env.S3_ENDPOINT,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY
  };
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function uploadToObjectStorage(file: Express.Multer.File) {
  const config = getRequiredS3Config();
  const client = getObjectStorageClient();
  const key = `chat-assets/${Date.now()}-${sanitizeFileName(file.originalname)}`;

  await client.putObject(config.bucket, key, file.buffer, file.size, {
    "Content-Type": file.mimetype
  });

  const publicBaseUrl = env.S3_PUBLIC_BASE_URL ?? env.S3_ENDPOINT;
  if (!publicBaseUrl) {
    throw new Error("Missing S3 public URL configuration.");
  }

  return {
    url: `${publicBaseUrl.replace(/\/$/, "")}/${key}`,
    fileName: file.originalname,
    mimeType: file.mimetype,
    size: file.size
  };
}
