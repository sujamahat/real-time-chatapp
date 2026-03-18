import fs from "node:fs";
import path from "node:path";
import type { Express } from "express";
import multer from "multer";
import { env } from "../env.js";
import { uploadToObjectStorage } from "./objectStorage.js";

const uploadsDirectory = path.resolve(process.cwd(), "uploads");

fs.mkdirSync(uploadsDirectory, { recursive: true });

const localStorage = multer.diskStorage({
  destination: (_request, _file, callback) => {
    callback(null, uploadsDirectory);
  },
  filename: (_request, file, callback) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-");
    callback(null, `${Date.now()}-${safeName}`);
  }
});

export const upload = multer({
  storage: env.STORAGE_PROVIDER === "s3" ? multer.memoryStorage() : localStorage,
  limits: {
    fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024
  }
});

export function getPublicFileUrl(requestProtocol: string, requestHost: string, fileName: string) {
  const baseUrl = env.PUBLIC_FILE_BASE_URL ?? `${requestProtocol}://${requestHost}`;
  return `${baseUrl}/uploads/${fileName}`;
}

export async function persistUploadedFile(
  requestProtocol: string,
  requestHost: string,
  file: Express.Multer.File
) {
  if (env.STORAGE_PROVIDER === "s3") {
    return uploadToObjectStorage(file);
  }

  return {
    url: getPublicFileUrl(requestProtocol, requestHost, file.filename),
    fileName: file.originalname,
    mimeType: file.mimetype,
    size: file.size
  };
}
