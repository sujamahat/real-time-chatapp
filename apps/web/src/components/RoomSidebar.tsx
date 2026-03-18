import clsx from "clsx";
import type { ChatRoom, DirectoryUser } from "@chatapp/shared";

type RoomSidebarProps = {
  rooms: ChatRoom[];
  users: DirectoryUser[];
  presenceByUserId: Record<string, boolean>;
  activeRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  onCreateRoom: () => void;
  onStartDirectMessage: (userId: string) => Promise<void>;
  onLogout: () => Promise<void>;
};

export function RoomSidebar({
  rooms,
  users,
  presenceByUserId,
  activeRoomId,
  onSelectRoom,
  onCreateRoom,
  onStartDirectMessage,
  onLogout
}: RoomSidebarProps) {
  const channelRooms = rooms.filter((room) => room.kind === "CHANNEL");
  const directRooms = rooms.filter((room) => room.kind === "DIRECT");

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div>
          <span className="eyebrow">Workspace</span>
          <h2>Conversations</h2>
        </div>
        <button className="ghost-button" onClick={onCreateRoom} type="button">
          New channel
        </button>
      </div>

      <div className="room-list">
        <div className="sidebar-section">
          <span className="section-label">Channels</span>
          {channelRooms.map((room) => (
            <button
              key={room.id}
              type="button"
              className={clsx("room-tile", room.id === activeRoomId && "active")}
              onClick={() => onSelectRoom(room.id)}
            >
              <div className="room-tile-top">
                <strong># {room.name}</strong>
                <div className="room-meta">
                  {room.unreadCount ? (
                    <span className="unread-badge">{room.unreadCount}</span>
                  ) : null}
                  <span>{room.membersCount} members</span>
                </div>
              </div>
              <p>{room.description ?? "No description yet."}</p>
            </button>
          ))}
        </div>

        <div className="sidebar-section">
          <span className="section-label">Direct messages</span>
          {directRooms.map((room) => (
            <button
              key={room.id}
              type="button"
              className={clsx("room-tile", room.id === activeRoomId && "active")}
              onClick={() => onSelectRoom(room.id)}
            >
              <div className="room-tile-top">
                <strong>{room.name}</strong>
                <div className="room-meta">
                  {room.unreadCount ? (
                    <span className="unread-badge">{room.unreadCount}</span>
                  ) : null}
                  <span
                    className={clsx(
                      "status-pill",
                      presenceByUserId[room.partnerUserId ?? ""] && "online"
                    )}
                  >
                    {presenceByUserId[room.partnerUserId ?? ""] ? "Online" : "Offline"}
                  </span>
                </div>
              </div>
              <p>{room.description ?? "Private thread"}</p>
            </button>
          ))}
        </div>

        <div className="sidebar-section">
          <span className="section-label">Start a DM</span>
          {users.map((person) => (
            <button
              key={person.id}
              type="button"
              className="user-tile"
              onClick={() => void onStartDirectMessage(person.id)}
            >
              <div>
                <strong>{person.name}</strong>
                <p>{person.email}</p>
              </div>
              <span
                className={clsx(
                  "status-pill",
                  presenceByUserId[person.id] && "online"
                )}
              >
                {presenceByUserId[person.id] ? "Online" : "Offline"}
              </span>
            </button>
          ))}
        </div>
      </div>

      <button className="logout-button" onClick={onLogout} type="button">
        Log out
      </button>
    </aside>
  );
}
