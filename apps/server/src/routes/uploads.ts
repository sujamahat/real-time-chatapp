import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { env } from "../env.js";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimitMiddleware } from "../lib/rateLimit.js";
import { persistUploadedFile, upload } from "../lib/uploads.js";

const router = Router();

router.use(requireAuth);
router.use(
  createRateLimitMiddleware({
    keyPrefix: "upload",
    limit: env.UPLOAD_RATE_LIMIT_MAX,
    windowMs: env.UPLOAD_RATE_LIMIT_WINDOW_MS,
    getKey: (request) => request.ip
  })
);

router.post("/", upload.single("file"), async (request, response) => {
  if (!request.file) {
    return response.status(StatusCodes.BAD_REQUEST).json({
      message: "No file uploaded."
    });
  }

  const attachment = await persistUploadedFile(
    request.protocol,
    request.get("host") ?? "localhost:4000",
    request.file
  );

  return response.status(StatusCodes.CREATED).json({
    attachment
  });
});

export const uploadsRouter = router;
