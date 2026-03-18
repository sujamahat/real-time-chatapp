import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { getOnlineUserIds } from "../lib/socketState.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (request, response) => {
  const currentUserId = (request as AuthenticatedRequest).user.id;

  const users = await prisma.user.findMany({
    where: {
      id: {
        not: currentUserId
      }
    },
    orderBy: {
      name: "asc"
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true
    }
  });
  const onlineUserIds = new Set(getOnlineUserIds());

  return response.json({
    users: users.map((user) => ({
      ...user,
      isOnline: onlineUserIds.has(user.id)
    }))
  });
});

export const usersRouter = router;
