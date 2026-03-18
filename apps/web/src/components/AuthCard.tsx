import { useState, type FormEvent } from "react";

type AuthMode = "login" | "register";

type AuthCardProps = {
  onSubmit: (values: {
    email: string;
    password: string;
    name?: string;
    mode: AuthMode;
  }) => Promise<void>;
  onResetSession: () => void;
};

export function AuthCard({ onSubmit, onResetSession }: AuthCardProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await onSubmit({ email, password, name, mode });
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to continue."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="hero-copy">
        <span className="eyebrow">Realtime systems portfolio piece</span>
        <h1>Pulse Chat</h1>
        <p>
          Ship a room-based chat app with authentication, live presence, and
          low-latency messaging.
        </p>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-toggle">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Log in
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Create account
          </button>
        </div>

        {mode === "register" ? (
          <label>
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Sam Lee"
              required
            />
          </label>
        ) : null}

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="demo@chatapp.dev"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimum 8 characters"
            required
          />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <button className="primary-button" disabled={loading} type="submit">
          {loading
            ? "Loading..."
            : mode === "login"
              ? "Enter workspace"
              : "Create account"}
        </button>

        <button
          className="secondary-button"
          onClick={onResetSession}
          type="button"
        >
          Reset session
        </button>

        <p className="helper-copy">
          If the demo accounts ever feel stuck, this clears the saved login state
          for this browser and lets you start fresh.
        </p>
      </form>
    </div>
  );
}
