export type AppUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export type ChatRoom = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  membersCount: number;
  lastMessageAt: string | null;
  unreadCount: number;
  kind: "CHANNEL" | "DIRECT";
  partnerUserId: string | null;
  partnerName: string | null;
};

export type MessageAttachment = {
  url: string;
  fileName: string;
  mimeType: string | null;
  size: number | null;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  attachment: MessageAttachment | null;
  readByUserIds: string[];
};

export type TypingState = {
  roomId: string;
  users: Array<{
    userId: string;
    name: string;
  }>;
};

export type PresenceState = {
  userId: string;
  isOnline: boolean;
};

export type DirectoryUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  isOnline: boolean;
};

export type AuthResponse = {
  user: AppUser;
};

export type PaginatedMessages = {
  messages: ChatMessage[];
  nextCursor: string | null;
};

export type UploadedAttachment = MessageAttachment;

export type ReceiptUpdate = {
  roomId: string;
  receipts: Array<{
    messageId: string;
    userIds: string[];
  }>;
};
