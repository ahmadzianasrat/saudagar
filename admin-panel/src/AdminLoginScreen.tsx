import type { FormEvent } from "react";
import { useState } from "react";
import { supabase } from "./supabaseClient";
import { colors, inputStyle, primaryButtonStyle, radius, shadow } from "./theme";
import { EyeIcon, LockIcon, MailIcon, StoreIcon } from "./icons";

// Admins use ordinary email/password auth (created via Supabase
// Dashboard → Authentication → Add user), NOT the phone + synthetic-
// email + generated-password scheme used for shop owners. Admins are
// a small, trusted, manually-managed population — no need to
// replicate the no-SMS workaround built for the consumer app.
export default function AdminLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: FormEvent) {
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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: colors.bg,
        position: "relative",
        overflow: "hidden",
        padding: 20,
      }}
    >
      <div style={{ position: "absolute", top: -60, insetInlineStart: -60, width: 220, height: 220, borderRadius: radius.pill, background: "rgba(30,99,214,0.06)" }} />
      <div style={{ position: "absolute", bottom: -80, insetInlineEnd: -60, width: 260, height: 260, borderRadius: radius.pill, background: "rgba(30,99,214,0.05)" }} />

      <div style={{ width: "100%", maxWidth: 380, position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 26 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: radius.xl,
              background: colors.primarySoft,
              color: colors.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <StoreIcon size={34} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: colors.textPrimary }}>Saudagar Admin</div>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>Sign in to manage your store</div>
        </div>

        <form
          onSubmit={handleLogin}
          style={{ background: colors.surface, borderRadius: radius.lg, boxShadow: shadow.card, padding: 22, display: "grid", gap: 14 }}
        >
          {error && (
            <p style={{ color: colors.danger, fontSize: 13, margin: 0, background: colors.dangerSoft, padding: "9px 12px", borderRadius: radius.sm }}>
              {error}
            </p>
          )}

          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: colors.textSecondary, marginBottom: 6, display: "block" }}>Email</label>
            <div style={{ position: "relative" }}>
              <MailIcon size={16} color={colors.textFaint} style={{ position: "absolute", insetInlineStart: 13, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ ...inputStyle, paddingInlineStart: 38 }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: colors.textSecondary, marginBottom: 6, display: "block" }}>Password</label>
            <div style={{ position: "relative" }}>
              <LockIcon size={16} color={colors.textFaint} style={{ position: "absolute", insetInlineStart: 13, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ ...inputStyle, paddingInlineStart: 38, paddingInlineEnd: 38 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{ position: "absolute", insetInlineEnd: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: colors.textFaint, cursor: "pointer", padding: 4 }}
              >
                <EyeIcon size={16} />
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} style={{ ...primaryButtonStyle, width: "100%", padding: "12px 16px", fontSize: 15, opacity: loading ? 0.7 : 1 }}>
            {loading ? "…" : "Log In"}
          </button>
        </form>

        <div style={{ textAlign: "center", fontSize: 11.5, color: colors.textFaint, marginTop: 22 }}>© 2025 Saudagar. All rights reserved.</div>
      </div>
    </div>
  );
}
