import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { serializeRoom } from "../lib/serializers.js";

const router = Router();

router.use(requireAuth);

router.post("/:userId", async (request, response) => {
  const currentUserId = (request as AuthenticatedRequest).user.id;
  const targetUserId = request.params.userId;

  if (currentUserId === targetUserId) {
    return response.status(StatusCodes.BAD_REQUEST).json({
      message: "You cannot create a direct message with yourself."
    });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true }
  });

  if (!targetUser) {
    return response.status(StatusCodes.NOT_FOUND).json({
      message: "User not found."
    });
  }

  const directKey = [currentUserId, targetUserId].sort().join(":");

  const room = await prisma.room.upsert({
    where: { directKey },
    update: {},
    create: {
      name: "Direct message",
      createdById: currentUserId,
      kind: "DIRECT",
      directKey,
      members: {
        create: [{ userId: currentUserId }, { userId: targetUserId }]
      }
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  });

  return response.status(StatusCodes.CREATED).json({
    room: serializeRoom(room, currentUserId)
  });
});

export const directsRouter = router;

