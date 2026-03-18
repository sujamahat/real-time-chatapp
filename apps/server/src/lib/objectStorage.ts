import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Express } from "express";
import { env } from "../env.js";

let s3Client: S3Client | null = null;

function getS3Client() {
  if (s3Client) {
    return s3Client;
  }

  if (
    !env.S3_BUCKET ||
    !env.S3_ENDPOINT ||
    !env.S3_ACCESS_KEY_ID ||
    !env.S3_SECRET_ACCESS_KEY
  ) {
    throw new Error("S3 storage is enabled but the S3 environment variables are incomplete.");
  }

  s3Client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY
    }
  });

  return s3Client;
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function uploadToObjectStorage(file: Express.Multer.File) {
  const client = getS3Client();
  const key = `chat-assets/${Date.now()}-${sanitizeFileName(file.originalname)}`;

  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype
    })
  );

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

