import { useState } from "react";
import { supabase } from "./supabaseClient";

// Admins use ordinary email/password auth (created via Supabase
// Dashboard → Authentication → Add user), NOT the phone + synthetic-
// email + generated-password scheme used for shop owners. Admins are
// a small, trusted, manually-managed population — no need to
// replicate the no-SMS workaround built for the consumer app.
export default function AdminLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (signInError) {
      setError("Email or password is incorrect.");
    }
    // No need to manually redirect — App.tsx's auth-state listener
    // picks up the new session and re-renders automatically.
  }

  return (
    <div style={{ maxWidth: 320, margin: "60px auto", padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>Saudagar Admin</h1>
      <form onSubmit={handleLogin} style={{ display: "grid", gap: 8, marginTop: 16 }}>
        {error && <p style={{ color: "crimson", fontSize: 13 }}>{error}</p>}
        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "..." : "Log In"}
        </button>
      </form>
    </div>
  );
}
