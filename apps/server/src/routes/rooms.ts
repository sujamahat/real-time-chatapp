import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getAuthenticatedUser, requireAuth } from "../middleware/auth.js";
import { serializeRoom } from "../lib/serializers.js";

const router = Router();

const createRoomSchema = z.object({
  name: z.string().min(2).max(40),
  description: z.string().max(140).optional()
});

router.use(requireAuth);

router.get("/", async (request, response) => {
  const userId = getAuthenticatedUser(request).id;
  const unreadGroups = await prisma.message.groupBy({
    by: ["roomId"],
    where: {
      authorId: {
        not: userId
      },
      room: {
        members: {
          some: {
            userId
          }
        }
      },
      reads: {
        none: {
          userId
        }
      }
    },
    _count: {
      _all: true
    }
  });

  const unreadCountByRoomId = unreadGroups.reduce<Record<string, number>>(
    (accumulator, group) => {
      accumulator[group.roomId] = group._count._all;
      return accumulator;
    },
    {}
  );

  const memberships = await prisma.roomMember.findMany({
    where: { userId },
    include: {
      room: {
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
      }
    }
  });

  const rooms = memberships
    .map(({ room }) =>
      serializeRoom(
        {
          ...room,
          unreadCount: unreadCountByRoomId[room.id] ?? 0
        },
        userId
      )
    )
    .sort((leftRoom, rightRoom) => {
      const leftTime = leftRoom.lastMessageAt
        ? new Date(leftRoom.lastMessageAt).getTime()
        : 0;
      const rightTime = rightRoom.lastMessageAt
        ? new Date(rightRoom.lastMessageAt).getTime()
        : 0;

      return rightTime - leftTime;
    });

  return response.json({ rooms });
});

router.post("/", async (request, response) => {
  const parsed = createRoomSchema.safeParse(request.body);

  if (!parsed.success) {
    return response.status(StatusCodes.BAD_REQUEST).json({
      message: "Room name must be between 2 and 40 characters."
    });
  }

  const userId = getAuthenticatedUser(request).id;

  const room = await prisma.room.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      createdById: userId,
      kind: "CHANNEL",
      members: {
        create: {
          userId
        }
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
    room: serializeRoom(room, userId)
  });
});

router.post("/:roomId/join", async (request, response) => {
  const userId = getAuthenticatedUser(request).id;
  const { roomId } = request.params;

  const room = await prisma.room.findUnique({
    where: { id: roomId }
  });

  if (!room) {
    return response.status(StatusCodes.NOT_FOUND).json({
      message: "Room not found."
    });
  }

  await prisma.roomMember.upsert({
    where: {
      roomId_userId: {
        roomId,
        userId
      }
    },
    update: {},
    create: {
      roomId,
      userId
    }
  });

  return response.status(StatusCodes.NO_CONTENT).send();
});

export const roomsRouter = router;
