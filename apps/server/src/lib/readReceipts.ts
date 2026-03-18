import { prisma } from "./prisma.js";

export async function markRoomAsRead(roomId: string, userId: string) {
  const unreadMessages = await prisma.message.findMany({
    where: {
      roomId,
      authorId: {
        not: userId
      },
      reads: {
        none: {
          userId
        }
      }
    },
    select: {
      id: true,
      reads: {
        select: {
          userId: true
        }
      }
    }
  });

  if (!unreadMessages.length) {
    return [];
  }

  await prisma.messageRead.createMany({
    data: unreadMessages.map((message) => ({
      messageId: message.id,
      userId
    })),
    skipDuplicates: true
  });

  return unreadMessages.map((message) => ({
    messageId: message.id,
    userIds: [...message.reads.map((read) => read.userId), userId]
  }));
}

