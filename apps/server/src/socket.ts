import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import cookie from "cookie";
import { prisma } from "./lib/prisma.js";
import { env } from "./env.js";
import { getTokenFromAuthorizationHeader, verifyToken } from "./lib/auth.js";
import { enforceRateLimit } from "./lib/rateLimit.js";
import { markRoomAsRead } from "./lib/readReceipts.js";
import { serializeMessage } from "./lib/serializers.js";
import {
  clearTypingForUser,
  getOnlineUserIds,
  markUserOffline,
  markUserOnline,
  removeTyping,
  upsertTyping
} from "./lib/socketState.js";

type SocketUser = {
  id: string;
  name: string;
  email: string;
};

export function createSocketServer(server: HttpServer) {
  const io = new Server(server, {
    cors: {
      origin: env.CLIENT_ORIGIN,
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      const parsedCookie = cookieHeader ? cookie.parse(cookieHeader) : {};
      const socketAuthToken =
        typeof socket.handshake.auth.token === "string"
          ? socket.handshake.auth.token
          : null;
      const token =
        parsedCookie[env.COOKIE_NAME] ??
        socketAuthToken ??
        getTokenFromAuthorizationHeader(socket.handshake.headers.authorization);

      if (!token) {
        return next(new Error("Authentication required."));
      }

      const payload = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          name: true,
          email: true
        }
      });

      if (!user) {
        return next(new Error("Authentication required."));
      }

      socket.data.user = user;
      next();
    } catch {
      next(new Error("Authentication required."));
    }
  });

  io.on("connection", async (socket) => {
    const user = socket.data.user as SocketUser;
    const wentOnline = markUserOnline(user.id);

    socket.emit("presence:snapshot", {
      userIds: getOnlineUserIds()
    });

    if (wentOnline) {
      io.emit("presence:update", {
        userId: user.id,
        isOnline: true
      });
    }

    const memberships = await prisma.roomMember.findMany({
      where: { userId: user.id },
      select: { roomId: true }
    });

    for (const membership of memberships) {
      await socket.join(membership.roomId);
    }

    socket.on("room:join", async (roomId: string) => {
      const membership = await prisma.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId: user.id
          }
        }
      });

      if (!membership) {
        socket.emit("error:event", {
          message: "You must join the room first."
        });
        return;
      }

      await socket.join(roomId);
      socket.emit("room:joined", { roomId });
    });

    socket.on("typing:start", ({ roomId }: { roomId: string }) => {
      const users = upsertTyping(roomId, {
        userId: user.id,
        name: user.name
      });

      io.to(roomId).emit("typing:update", {
        roomId,
        users: users.filter((typingUser) => typingUser.userId !== user.id)
      });
    });

    socket.on("typing:stop", ({ roomId }: { roomId: string }) => {
      const users = removeTyping(roomId, user.id);

      io.to(roomId).emit("typing:update", {
        roomId,
        users
      });
    });

    socket.on("message:send", async ({
      roomId,
      content,
      attachment
    }: {
      roomId: string;
      content: string;
      attachment?: {
        url: string;
        fileName: string;
        mimeType: string | null;
        size: number | null;
      } | null;
    }) => {
      const rateLimit = await enforceRateLimit({
        key: `message:${user.id}`,
        limit: env.MESSAGE_RATE_LIMIT_MAX,
        windowMs: env.MESSAGE_RATE_LIMIT_WINDOW_MS
      });

      if (!rateLimit.allowed) {
        socket.emit("error:event", {
          message: "You are sending messages too quickly. Please slow down."
        });
        return;
      }

      const trimmed = content.trim();

      if (!trimmed && !attachment) {
        return;
      }

      const membership = await prisma.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId: user.id
          }
        }
      });

      if (!membership) {
        socket.emit("error:event", {
          message: "You must join the room first."
        });
        return;
      }

      const message = await prisma.message.create({
        data: {
          roomId,
          authorId: user.id,
          content: trimmed,
          attachmentUrl: attachment?.url,
          attachmentFileName: attachment?.fileName,
          attachmentMimeType: attachment?.mimeType ?? null,
          attachmentSize: attachment?.size ?? null
        },
        include: {
          author: {
            select: {
              id: true,
              name: true
            }
          },
          reads: {
            select: {
              userId: true,
              readAt: true,
              id: true,
              messageId: true
            }
          }
        }
      });

      await prisma.room.update({
        where: { id: roomId },
        data: {
          lastMessageAt: message.createdAt
        }
      });

      const typingUsers = removeTyping(roomId, user.id);

      io.to(roomId).emit("typing:update", {
        roomId,
        users: typingUsers
      });

      io.to(roomId).emit("message:new", serializeMessage(message));
    });

    socket.on("message:read", async ({ roomId }: { roomId: string }) => {
      const membership = await prisma.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId: user.id
          }
        }
      });

      if (!membership) {
        return;
      }

      const receipts = await markRoomAsRead(roomId, user.id);

      if (receipts.length) {
        io.to(roomId).emit("receipt:update", {
          roomId,
          receipts
        });
      }
    });

    socket.on("disconnect", () => {
      const typingUpdates = clearTypingForUser(user.id);

      for (const update of typingUpdates) {
        io.to(update.roomId).emit("typing:update", update);
      }

      const wentOffline = markUserOffline(user.id);

      if (wentOffline) {
        io.emit("presence:update", {
          userId: user.id,
          isOnline: false
        });
      }
    });
  });

  return io;
}
