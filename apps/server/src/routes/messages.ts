import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../lib/prisma.js";
import { getAuthenticatedUser, requireAuth } from "../middleware/auth.js";
import { serializeMessage } from "../lib/serializers.js";
import { markRoomAsRead } from "../lib/readReceipts.js";

const router = Router();

router.use(requireAuth);

router.get("/:roomId", async (request, response) => {
  const userId = getAuthenticatedUser(request).id;
  const { roomId } = request.params;
  const cursor = typeof request.query.cursor === "string" ? request.query.cursor : null;

  const membership = await prisma.roomMember.findUnique({
    where: {
      roomId_userId: {
        roomId,
        userId
      }
    }
  });

  if (!membership) {
    return response.status(StatusCodes.FORBIDDEN).json({
      message: "Join the room before loading messages."
    });
  }

  const messages = await prisma.message.findMany({
    where: { roomId },
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
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 25,
    ...(cursor
      ? {
          skip: 1,
          cursor: { id: cursor }
        }
      : {})
  });

  const orderedMessages = messages.reverse().map(serializeMessage);

  return response.json({
    messages: orderedMessages,
    nextCursor: messages.length === 25 ? messages[messages.length - 1]?.id ?? null : null
  });
});

router.post("/:roomId/read", async (request, response) => {
  const userId = getAuthenticatedUser(request).id;
  const { roomId } = request.params;

  const membership = await prisma.roomMember.findUnique({
    where: {
      roomId_userId: {
        roomId,
        userId
      }
    }
  });

  if (!membership) {
    return response.status(StatusCodes.FORBIDDEN).json({
      message: "Join the room before marking messages as read."
    });
  }

  const receipts = await markRoomAsRead(roomId, userId);
  return response.json({ roomId, receipts });
});

export const messagesRouter = router;
