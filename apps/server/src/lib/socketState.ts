type TypingUser = {
  userId: string;
  name: string;
};

const typingByRoom = new Map<string, Map<string, TypingUser>>();
const connectionsByUser = new Map<string, number>();

export function markUserOnline(userId: string) {
  const nextCount = (connectionsByUser.get(userId) ?? 0) + 1;
  connectionsByUser.set(userId, nextCount);
  return nextCount === 1;
}

export function markUserOffline(userId: string) {
  const currentCount = connectionsByUser.get(userId) ?? 0;
  const nextCount = Math.max(currentCount - 1, 0);

  if (nextCount === 0) {
    connectionsByUser.delete(userId);
    return true;
  }

  connectionsByUser.set(userId, nextCount);
  return false;
}

export function upsertTyping(roomId: string, user: TypingUser) {
  const roomTyping = typingByRoom.get(roomId) ?? new Map<string, TypingUser>();
  roomTyping.set(user.userId, user);
  typingByRoom.set(roomId, roomTyping);
  return Array.from(roomTyping.values());
}

export function removeTyping(roomId: string, userId: string) {
  const roomTyping = typingByRoom.get(roomId);

  if (!roomTyping) {
    return [];
  }

  roomTyping.delete(userId);

  if (roomTyping.size === 0) {
    typingByRoom.delete(roomId);
    return [];
  }

  return Array.from(roomTyping.values());
}

export function clearTypingForUser(userId: string) {
  const updates: Array<{
    roomId: string;
    users: TypingUser[];
  }> = [];

  for (const [roomId, roomTyping] of typingByRoom.entries()) {
    if (!roomTyping.has(userId)) {
      continue;
    }

    roomTyping.delete(userId);

    if (roomTyping.size === 0) {
      typingByRoom.delete(roomId);
      updates.push({ roomId, users: [] });
      continue;
    }

    updates.push({
      roomId,
      users: Array.from(roomTyping.values())
    });
  }

  return updates;
}

export function getOnlineUserIds() {
  return Array.from(connectionsByUser.keys());
}
