import jwt from "jsonwebtoken";
import type { Response } from "express";
import { env } from "../env.js";

type TokenPayload = {
  userId: string;
};

export function signToken(userId: string) {
  return jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: "7d"
  });
}

export function verifyToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}

export function setAuthCookie(response: Response, token: string) {
  response.cookie(env.COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

export function clearAuthCookie(response: Response) {
  response.clearCookie(env.COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production"
  });
}

