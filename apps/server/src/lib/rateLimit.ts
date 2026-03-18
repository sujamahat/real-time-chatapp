import type { NextFunction, Request, Response } from "express";
import Redis from "ioredis";
import { StatusCodes } from "http-status-codes";
import { env } from "../env.js";

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();
let redisClient: Redis | null = null;

function getRedisClient() {
  if (!env.REDIS_URL) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1
    });
  }

  return redisClient;
}

function consumeInMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const current = memoryBuckets.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    memoryBuckets.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(limit - 1, 0),
      resetAt
    };
  }

  current.count += 1;
  memoryBuckets.set(key, current);

  return {
    allowed: current.count <= limit,
    remaining: Math.max(limit - current.count, 0),
    resetAt: current.resetAt
  };
}

async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const redis = getRedisClient();

  if (!redis) {
    return consumeInMemoryRateLimit(key, limit, windowMs);
  }

  try {
    if (redis.status === "wait") {
      await redis.connect();
    }

    const current = await redis.incr(key);
    if (current === 1) {
      await redis.pexpire(key, windowMs);
    }

    const ttl = await redis.pttl(key);
    return {
      allowed: current <= limit,
      remaining: Math.max(limit - current, 0),
      resetAt: Date.now() + Math.max(ttl, 0)
    };
  } catch {
    return consumeInMemoryRateLimit(key, limit, windowMs);
  }
}

export function createRateLimitMiddleware(options: {
  keyPrefix: string;
  limit: number;
  windowMs: number;
  getKey: (request: Request) => string;
}) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const result = await consumeRateLimit(
      `${options.keyPrefix}:${options.getKey(request)}`,
      options.limit,
      options.windowMs
    );

    response.setHeader("X-RateLimit-Remaining", String(result.remaining));
    response.setHeader("X-RateLimit-Reset", String(result.resetAt));

    if (!result.allowed) {
      return response.status(StatusCodes.TOO_MANY_REQUESTS).json({
        message: "Too many requests. Please slow down and try again shortly."
      });
    }

    next();
  };
}

export async function enforceRateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  return consumeRateLimit(options.key, options.limit, options.windowMs);
}
