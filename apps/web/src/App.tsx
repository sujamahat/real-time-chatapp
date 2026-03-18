import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AppUser,
  AuthResponse,
  ChatMessage,
  ChatRoom,
  DirectoryUser,
  PaginatedMessages,
  PresenceState,
  ReceiptUpdate,
  UploadedAttachment,
  TypingState
} from "@chatapp/shared";
import { AuthCard } from "./components/AuthCard";
import { RoomSidebar } from "./components/RoomSidebar";
import { ChatPanel } from "./components/ChatPanel";
import { apiFetch } from "./lib/api";
import { getSocket } from "./lib/socket";

export function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messagesByRoom, setMessagesByRoom] = useState<Record<string, ChatMessage[]>>({});
  const [cursorByRoom, setCursorByRoom] = useState<Record<string, string | null>>({});
  const [typingByRoom, setTypingByRoom] = useState<Record<string, TypingState>>({});
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, boolean>>({});
  const [loadingSession, setLoadingSession] = useState(true);
  const hasConnectedSocket = useRef(false);
  const activeRoomIdRef = useRef<string | null>(null);
  const userRef = useRef<AppUser | null>(null);

  const activeRoom = useMemo(
    () => rooms.find((room) => room.id === activeRoomId) ?? null,
    [activeRoomId, rooms]
  );

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (!user || hasConnectedSocket.current) {
      return;
    }

    const socket = getSocket();
    hasConnectedSocket.current = true;
    socket.connect();

    socket.on("message:new", (message: ChatMessage) => {
      setMessagesByRoom((current) => ({
        ...current,
        [message.roomId]: [...(current[message.roomId] ?? []), message]
      }));

      setRooms((current) =>
        current
          .map((room) => {
            if (room.id !== message.roomId) {
              return room;
            }

            const shouldIncrementUnread =
              message.authorId !== userRef.current?.id &&
              activeRoomIdRef.current !== message.roomId;

            return {
              ...room,
              lastMessageAt: message.createdAt,
              unreadCount: shouldIncrementUnread
                ? room.unreadCount + 1
                : room.unreadCount
            };
          })
          .sort((leftRoom, rightRoom) => {
            const leftTime = leftRoom.lastMessageAt
              ? new Date(leftRoom.lastMessageAt).getTime()
              : 0;
            const rightTime = rightRoom.lastMessageAt
              ? new Date(rightRoom.lastMessageAt).getTime()
              : 0;

            return rightTime - leftTime;
          })
      );

      if (
        activeRoomIdRef.current === message.roomId &&
        userRef.current &&
        message.authorId !== userRef.current.id
      ) {
        socket.emit("message:read", { roomId: message.roomId });
      }
    });

    socket.on("typing:update", (payload: TypingState) => {
      setTypingByRoom((current) => ({
        ...current,
        [payload.roomId]: payload
      }));
    });

    socket.on("presence:update", (payload: PresenceState) => {
      setPresenceByUserId((current) => ({
        ...current,
        [payload.userId]: payload.isOnline
      }));
    });

    socket.on("presence:snapshot", (payload: { userIds: string[] }) => {
      setPresenceByUserId(
        payload.userIds.reduce<Record<string, boolean>>((accumulator, userId) => {
          accumulator[userId] = true;
          return accumulator;
        }, {})
      );
    });

    socket.on("receipt:update", (payload: ReceiptUpdate) => {
      setMessagesByRoom((current) => ({
        ...current,
        [payload.roomId]: (current[payload.roomId] ?? []).map((message) => {
          const matchingReceipt = payload.receipts.find(
            (receipt) => receipt.messageId === message.id
          );

          return matchingReceipt
            ? {
                ...message,
                readByUserIds: matchingReceipt.userIds
              }
            : message;
        })
      }));
    });

    return () => {
      socket.off("message:new");
      socket.off("typing:update");
      socket.off("presence:update");
      socket.off("presence:snapshot");
      socket.off("receipt:update");
      socket.disconnect();
      hasConnectedSocket.current = false;
    };
  }, [user]);

  useEffect(() => {
    if (!activeRoomId || !user) {
      return;
    }

    void markRoomRead(activeRoomId);
    getSocket().emit("message:read", { roomId: activeRoomId });
  }, [activeRoomId, user]);

  async function bootstrap() {
    try {
      const session = await apiFetch<AuthResponse>("/auth/me");
      setUser(session.user);
      await Promise.all([loadRooms(), loadUsers()]);
    } catch {
      setUser(null);
    } finally {
      setLoadingSession(false);
    }
  }

  async function loadRooms() {
    const data = await apiFetch<{ rooms: ChatRoom[] }>("/rooms");
    setRooms(data.rooms);

    if (!activeRoomId && data.rooms.length) {
      await selectRoom(data.rooms[0].id);
    }
  }

  async function loadUsers() {
    const data = await apiFetch<{ users: DirectoryUser[] }>("/users");
    setUsers(data.users);
    setPresenceByUserId((current) => ({
      ...current,
      ...data.users.reduce<Record<string, boolean>>((accumulator, person) => {
        accumulator[person.id] = person.isOnline;
        return accumulator;
      }, {})
    }));
  }

  async function selectRoom(roomId: string) {
    setActiveRoomId(roomId);
    setRooms((current) =>
      current.map((room) =>
        room.id === roomId
          ? {
              ...room,
              unreadCount: 0
            }
          : room
      )
    );
    getSocket().emit("room:join", roomId);
    await loadMessages(roomId);
  }

  async function loadMessages(roomId: string, cursor?: string | null) {
    const query = cursor ? `?cursor=${cursor}` : "";
    const data = await apiFetch<PaginatedMessages>(`/messages/${roomId}${query}`);

    setMessagesByRoom((current) => ({
      ...current,
      [roomId]: cursor
        ? [...data.messages, ...(current[roomId] ?? [])]
        : data.messages
    }));
    setCursorByRoom((current) => ({
      ...current,
      [roomId]: data.nextCursor
    }));
  }

  async function markRoomRead(roomId: string) {
    const data = await apiFetch<ReceiptUpdate>(`/messages/${roomId}/read`, {
      method: "POST"
    });

    if (!data.receipts.length) {
      return;
    }

    setMessagesByRoom((current) => ({
      ...current,
      [roomId]: (current[roomId] ?? []).map((message) => {
        const receipt = data.receipts.find(
          (receiptItem) => receiptItem.messageId === message.id
        );

        return receipt
          ? {
              ...message,
              readByUserIds: receipt.userIds
            }
          : message;
      })
    }));
    setRooms((current) =>
      current.map((room) =>
        room.id === roomId
          ? {
              ...room,
              unreadCount: 0
            }
          : room
      )
    );
  }

  async function handleAuth(values: {
    email: string;
    password: string;
    name?: string;
    mode: "login" | "register";
  }) {
    const endpoint =
      values.mode === "login" ? "/auth/login" : "/auth/register";

    const session = await apiFetch<AuthResponse>(endpoint, {
      method: "POST",
      body: JSON.stringify(values)
    });

    setUser(session.user);
    await Promise.all([loadRooms(), loadUsers()]);
  }

  async function handleCreateRoom() {
    const name = window.prompt("Name your new room");

    if (!name) {
      return;
    }

    await apiFetch<{ room: ChatRoom }>("/rooms", {
      method: "POST",
      body: JSON.stringify({ name })
    });

    await loadRooms();
  }

  async function handleStartDirectMessage(targetUserId: string) {
    const data = await apiFetch<{ room: ChatRoom }>(`/directs/${targetUserId}`, {
      method: "POST"
    });

    await loadRooms();
    await selectRoom(data.room.id);
  }

  async function handleLogout() {
    await apiFetch("/auth/logout", {
      method: "POST"
    });

    getSocket().disconnect();
    setUser(null);
    setRooms([]);
    setUsers([]);
    setActiveRoomId(null);
    setMessagesByRoom({});
    setCursorByRoom({});
    setTypingByRoom({});
    setPresenceByUserId({});
  }

  function handleSendMessage(content: string, attachment: UploadedAttachment | null) {
    if (!activeRoomId) {
      return;
    }

    getSocket().emit("message:send", {
      roomId: activeRoomId,
      content,
      attachment
    });
  }

  function handleTypingStart() {
    if (!activeRoomId) {
      return;
    }

    getSocket().emit("typing:start", {
      roomId: activeRoomId
    });
  }

  function handleTypingStop() {
    if (!activeRoomId) {
      return;
    }

    getSocket().emit("typing:stop", {
      roomId: activeRoomId
    });
  }

  async function handleLoadOlder() {
    if (!activeRoomId) {
      return;
    }

    const cursor = cursorByRoom[activeRoomId];

    if (!cursor) {
      return;
    }

    await loadMessages(activeRoomId, cursor);
  }

  async function handleUploadAttachment(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const data = await apiFetch<{ attachment: UploadedAttachment }>("/uploads", {
      method: "POST",
      body: formData
    });

    return data.attachment;
  }

  if (loadingSession) {
    return <main className="loading-screen">Loading session...</main>;
  }

  if (!user) {
    return (
      <main className="app-shell">
        <AuthCard onSubmit={handleAuth} />
      </main>
    );
  }

  return (
    <main className="dashboard">
      <RoomSidebar
        rooms={rooms}
        users={users}
        presenceByUserId={presenceByUserId}
        activeRoomId={activeRoomId}
        onSelectRoom={(roomId) => void selectRoom(roomId)}
        onCreateRoom={() => void handleCreateRoom()}
        onStartDirectMessage={handleStartDirectMessage}
        onLogout={handleLogout}
      />

      <div className="workspace">
        <div className="workspace-header">
          <div>
            <span className="eyebrow">Signed in</span>
            <h1>{user.name}</h1>
          </div>
          <p>{user.email}</p>
        </div>

        <ChatPanel
          user={user}
          room={activeRoom}
          messages={activeRoomId ? messagesByRoom[activeRoomId] ?? [] : []}
          typingState={activeRoomId ? typingByRoom[activeRoomId] ?? null : null}
          onSendMessage={handleSendMessage}
          onTypingStart={handleTypingStart}
          onTypingStop={handleTypingStop}
          onLoadOlder={handleLoadOlder}
          onUploadAttachment={handleUploadAttachment}
          presenceByUserId={presenceByUserId}
        />
      </div>
    </main>
  );
}
