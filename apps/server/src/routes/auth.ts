import { Router } from "express";
import bcrypt from "bcrypt";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { env } from "../env.js";
import { prisma } from "../lib/prisma.js";
import { clearAuthCookie, setAuthCookie, signToken } from "../lib/auth.js";
import { createRateLimitMiddleware } from "../lib/rateLimit.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();
const authRateLimit = createRateLimitMiddleware({
  keyPrefix: "auth",
  limit: env.AUTH_RATE_LIMIT_MAX,
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  getKey: (request) => request.ip
});

const authSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(30).optional(),
  password: z.string().min(8).max(128)
});

router.post("/register", authRateLimit, async (request, response) => {
  const parsed = authSchema.safeParse(request.body);

  if (!parsed.success || !parsed.data.name) {
    return response.status(StatusCodes.BAD_REQUEST).json({
      message: "A valid name, email, and password are required."
    });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.data.email }
  });

  if (existingUser) {
    return response.status(StatusCodes.CONFLICT).json({
      message: "An account with that email already exists."
    });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true
    }
  });

  const generalRoom = await prisma.room.findFirst({
    where: { name: "General" }
  });

  if (generalRoom) {
    await prisma.roomMember.create({
      data: {
        roomId: generalRoom.id,
        userId: user.id
      }
    });
  }

  const token = signToken(user.id);
  setAuthCookie(response, token);

  return response.status(StatusCodes.CREATED).json({ user });
});

router.post("/login", authRateLimit, async (request, response) => {
  const parsed = authSchema.omit({ name: true }).safeParse(request.body);

  if (!parsed.success) {
    return response.status(StatusCodes.BAD_REQUEST).json({
      message: "A valid email and password are required."
    });
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email }
  });

  if (!user) {
    return response.status(StatusCodes.UNAUTHORIZED).json({
      message: "Invalid credentials."
    });
  }

  const isPasswordValid = await bcrypt.compare(
    parsed.data.password,
    user.passwordHash
  );

  if (!isPasswordValid) {
    return response.status(StatusCodes.UNAUTHORIZED).json({
      message: "Invalid credentials."
    });
  }

  const token = signToken(user.id);
  setAuthCookie(response, token);

  return response.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt
    }
  });
});

router.post("/logout", (_request, response) => {
  clearAuthCookie(response);
  return response.status(StatusCodes.NO_CONTENT).send();
});

router.get("/me", requireAuth, (request, response) => {
  const user = (request as AuthenticatedRequest).user;
  return response.json({
    user
  });
});

export const authRouter = router;
