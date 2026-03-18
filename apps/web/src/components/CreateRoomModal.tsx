import { useEffect, useState, type FormEvent } from "react";

type CreateRoomModalProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (values: { name: string; description: string }) => Promise<void>;
};

export function CreateRoomModal({
  isOpen,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit
}: CreateRoomModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setDescription("");
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      name: name.trim(),
      description: description.trim()
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section
        className="modal-card"
        onClick={(event) => event.stopPropagation()}
        aria-modal="true"
        role="dialog"
        aria-labelledby="create-room-title"
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">Create channel</span>
            <h3 id="create-room-title">Start a new conversation space</h3>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <label>
            Channel name
            <input
              autoFocus
              maxLength={40}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Product launch"
              required
            />
          </label>

          <label>
            Short description
            <textarea
              maxLength={140}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this room for?"
              rows={4}
            />
          </label>

          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

          <div className="modal-actions">
            <button className="ghost-button" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create channel"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
