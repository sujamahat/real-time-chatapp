import { useEffect, useRef, useState, type FormEvent } from "react";
import clsx from "clsx";
import type {
  AppUser,
  ChatMessage,
  ChatRoom,
  MessageAttachment,
  TypingState
} from "@chatapp/shared";

type ChatPanelProps = {
  user: AppUser;
  room: ChatRoom | null;
  messages: ChatMessage[];
  typingState: TypingState | null;
  onSendMessage: (content: string, attachment: MessageAttachment | null) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onLoadOlder: () => Promise<void>;
  onUploadAttachment: (file: File) => Promise<MessageAttachment>;
  presenceByUserId: Record<string, boolean>;
};

export function ChatPanel({
  user,
  room,
  messages,
  typingState,
  onSendMessage,
  onTypingStart,
  onTypingStop,
  onLoadOlder,
  onUploadAttachment,
  presenceByUserId
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<MessageAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const typingTimeout = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, room?.id]);

  function handleChange(value: string) {
    setDraft(value);
    onTypingStart();

    if (typingTimeout.current) {
      window.clearTimeout(typingTimeout.current);
    }

    typingTimeout.current = window.setTimeout(() => {
      onTypingStop();
    }, 1200);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.trim() && !attachment) {
      return;
    }

    onSendMessage(draft, attachment);
    setDraft("");
    setAttachment(null);
    onTypingStop();
  }

  async function handleFileChange(file: File | null) {
    if (!file) {
      return;
    }

    setUploading(true);

    try {
      const nextAttachment = await onUploadAttachment(file);
      setAttachment(nextAttachment);
    } finally {
      setUploading(false);
    }
  }

  if (!room) {
    return (
      <section className="chat-panel empty-state">
        <h3>Select a room</h3>
        <p>Join the conversation by choosing a room from the left sidebar.</p>
      </section>
    );
  }

  return (
    <section className="chat-panel">
      <header className="chat-header">
        <div>
          <span className="eyebrow">Active room</span>
          <h3>{room.name}</h3>
          <p>{room.description ?? "Live conversation with your team."}</p>
        </div>
        {room.kind === "DIRECT" && room.partnerUserId ? (
          <div className="presence-chip">
            <span
              className={clsx(
                "presence-dot",
                presenceByUserId[room.partnerUserId] && "online"
              )}
            />
            {presenceByUserId[room.partnerUserId] ? "Online now" : "Away"}
          </div>
        ) : null}
        <button className="ghost-button" onClick={onLoadOlder} type="button">
          Load older
        </button>
      </header>

      <div className="message-list">
        {messages.map((message) => (
          <article
            key={message.id}
            className={clsx(
              "message-bubble",
              message.authorId === user.id && "is-self"
            )}
          >
            <div className="message-meta">
              <strong>{message.authorId === user.id ? "You" : message.authorName}</strong>
              <time>{new Date(message.createdAt).toLocaleTimeString()}</time>
            </div>
            <p>{message.content}</p>
            {message.attachment ? (
              <a
                className="attachment-card"
                href={message.attachment.url}
                target="_blank"
                rel="noreferrer"
              >
                <strong>{message.attachment.fileName}</strong>
                <span>{message.attachment.mimeType ?? "Attachment"}</span>
              </a>
            ) : null}
            {message.authorId === user.id ? (
              <span className="receipt-line">
                {message.readByUserIds.length
                  ? `Seen by ${message.readByUserIds.length}`
                  : "Sent"}
              </span>
            ) : null}
          </article>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="typing-line">
        {typingState?.users.length
          ? `${typingState.users.map((typingUser) => typingUser.name).join(", ")} ${
              typingState.users.length === 1 ? "is" : "are"
            } typing...`
          : " "}
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        {attachment ? (
          <div className="attachment-preview">
            <span>{attachment.fileName}</span>
            <button type="button" className="ghost-button" onClick={() => setAttachment(null)}>
              Remove
            </button>
          </div>
        ) : null}
        <input
          value={draft}
          onChange={(event) => handleChange(event.target.value)}
          placeholder={
            room.kind === "DIRECT"
              ? `Message ${room.name}`
              : `Message #${room.name.toLowerCase()}`
          }
        />
        <label className="upload-button">
          {uploading ? "Uploading..." : "Attach file"}
          <input
            type="file"
            onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
            hidden
          />
        </label>
        <button className="primary-button" type="submit" disabled={uploading}>
          Send
        </button>
      </form>
    </section>
  );
}
