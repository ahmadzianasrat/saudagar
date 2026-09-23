import type { FormEvent } from "react";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { phoneToSyntheticEmail } from "../../lib/authHelpers";
import { useTranslation } from "../../i18n/useTranslation";
import { colors, inputStyle, primaryButtonStyle, radius, shadow } from "../../theme";
import { WalletIcon } from "../../components/icons";

// Phone-number + password login, no OTP/SMS. Since account creation
// is now self-serve (see SignupScreen.tsx / the self-signup Edge
// Function) the owner chose this password themselves at signup — the
// old "admin approves and relays a generated password over WhatsApp"
// flow is gone. phoneToSyntheticEmail() normalizes whatever format
// the phone was typed in (leading "0", "0093", or "+93", all
// followed by 9 digits) to the same login identifier regardless of
// which of those three the owner types here, so it doesn't have to
// match how they originally typed it at signup.
export default function LoginScreen({
  onLoggedIn,
  onRequestAccess,
}: {
  onLoggedIn: () => void;
  onRequestAccess: () => void;
}) {
  const { tr } = useTranslation();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: phoneToSyntheticEmail(phone),
      password,
    });

    setLoading(false);
    if (signInError) {
      setError(tr("auth.incorrect"));
      return;
    }
    onLoggedIn();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: radius.xl,
            background: colors.primary,
            color: colors.white,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: shadow.raised,
            marginBottom: 14,
          }}
        >
          <WalletIcon size={32} />
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: colors.textPrimary }}>{tr("auth.appName")}</div>
        <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{tr("auth.tagline")}</div>
      </div>

      <form
        onSubmit={handleLogin}
        style={{
          background: colors.surface,
          borderRadius: radius.lg,
          boxShadow: shadow.card,
          padding: 20,
          display: "grid",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 17, color: colors.textPrimary }}>{tr("auth.login")}</h2>
        {error && (
          <p style={{ color: colors.danger, fontSize: 13, margin: 0, background: colors.dangerSoft, padding: "8px 10px", borderRadius: radius.sm }}>
            {error}
          </p>
        )}
        <div>
          <input
            placeholder={tr("auth.phoneNumber")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            style={inputStyle}
          />
          <p style={{ fontSize: 10.5, color: colors.textFaint, margin: "4px 2px 0" }}>{tr("auth.phoneFormatHint")}</p>
        </div>
        <input
          placeholder={tr("auth.password")}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />
        <button type="submit" disabled={loading} style={{ ...primaryButtonStyle, opacity: loading ? 0.7 : 1 }}>
          {loading ? "…" : tr("auth.loginButton")}
        </button>
        <p style={{ fontSize: 12, color: colors.textFaint, textAlign: "center", margin: 0 }}>{tr("auth.forgotPassword")}</p>
      </form>

      <button
        onClick={onRequestAccess}
        style={{
          marginTop: 16,
          background: "none",
          border: "none",
          color: colors.primary,
          fontSize: 13.5,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {tr("auth.newHere")}
      </button>
    </div>
  );
}
