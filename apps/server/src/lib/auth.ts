import jwt from "jsonwebtoken";
import type { CookieOptions, Response } from "express";
import { env } from "../env.js";

type TokenPayload = {
  userId: string;
};

function getCookieOptions(): CookieOptions {
  const isProduction = env.NODE_ENV === "production";

  return {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
}

export function signToken(userId: string) {
  return jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: "7d"
  });
}

export function verifyToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}

export function getTokenFromAuthorizationHeader(headerValue?: string | null) {
  if (!headerValue) {
    return null;
  }

  const [scheme, token] = headerValue.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export function setAuthCookie(response: Response, token: string) {
  response.cookie(env.COOKIE_NAME, token, getCookieOptions());
}

export function clearAuthCookie(response: Response) {
  const { maxAge: _maxAge, ...cookieOptions } = getCookieOptions();
  response.clearCookie(env.COOKIE_NAME, cookieOptions);
}
