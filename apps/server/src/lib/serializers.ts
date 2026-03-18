import type { Message, MessageRead, Room, RoomMember, User } from "@prisma/client";

type RoomWithMemberships = Room & {
  members: Array<
    RoomMember & {
      user: Pick<User, "id" | "name">;
    }
  >;
  unreadCount?: number;
};

type MessageWithRelations = Message & {
  author: Pick<User, "id" | "name">;
  reads: MessageRead[];
};

export function serializeRoom(room: RoomWithMemberships, currentUserId: string) {
  const unreadCount = typeof room.unreadCount === "number" ? room.unreadCount : 0;
  const partner = room.kind === "DIRECT"
    ? room.members.find((membership) => membership.userId !== currentUserId)?.user ?? null
    : null;

  return {
    id: room.id,
    name: room.kind === "DIRECT" ? partner?.name ?? room.name : room.name,
    description:
      room.kind === "DIRECT"
        ? partner
          ? `Private conversation with ${partner.name}`
          : "Private conversation"
        : room.description,
    createdAt: room.createdAt,
    membersCount: room.members.length,
    lastMessageAt: room.lastMessageAt,
    unreadCount,
    kind: room.kind,
    partnerUserId: partner?.id ?? null,
    partnerName: partner?.name ?? null
  };
}

export function serializeMessage(message: MessageWithRelations) {
  return {
    id: message.id,
    roomId: message.roomId,
    authorId: message.authorId,
    authorName: message.author.name,
    content: message.content,
    createdAt: message.createdAt,
    attachment: message.attachmentUrl
      ? {
          url: message.attachmentUrl,
          fileName: message.attachmentFileName ?? "Attachment",
          mimeType: message.attachmentMimeType,
          size: message.attachmentSize
        }
      : null,
    readByUserIds: message.reads.map((read) => read.userId)
  };
}
