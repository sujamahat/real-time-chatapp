import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../lib/prisma.js";
import { getTokenFromAuthorizationHeader, verifyToken } from "../lib/auth.js";
import { env } from "../env.js";

export type AuthenticatedRequest = Request & {
  user: {
    id: string;
    email: string;
    name: string;
  };
};

export function getAuthenticatedUser(request: Request) {
  return (request as Request & AuthenticatedRequest).user;
}

function getRequestToken(request: Request) {
  return (
    request.cookies?.[env.COOKIE_NAME] ??
    getTokenFromAuthorizationHeader(request.headers.authorization)
  );
}

export async function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const token = getRequestToken(request);

    if (!token) {
      return response.status(StatusCodes.UNAUTHORIZED).json({
        message: "Authentication required."
      });
    }

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true }
    });

    if (!user) {
      return response.status(StatusCodes.UNAUTHORIZED).json({
        message: "Session is no longer valid."
      });
    }

    (request as AuthenticatedRequest).user = user;
    next();
  } catch {
    return response.status(StatusCodes.UNAUTHORIZED).json({
      message: "Authentication required."
    });
  }
}
