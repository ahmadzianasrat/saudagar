import type { FormEvent } from "react";
import { useState } from "react";
import { supabase, SUPABASE_URL } from "../../lib/supabaseClient";
import { normalizeAfghanPhone, isValidAfghanPhone } from "../../lib/phone";
import { useTranslation } from "../../i18n/useTranslation";
import { colors, inputStyle, primaryButtonStyle, radius, shadow } from "../../theme";
import { WalletIcon } from "../../components/icons";
import { BackButton } from "../../components/ui";

const MIN_PASSWORD_LENGTH = 6;

// Self-serve signup: replaces the old "request access, wait for an
// admin to approve and relay a password over WhatsApp" flow. The
// owner picks their own phone number and password right here and is
// logged in immediately — no admin step, no waiting.
//
// The actual account creation (auth user + profiles row + first
// 30-day trial) happens in the self-signup Edge Function, not
// directly from the client, because it needs the service role to
// create an auth user with a synthetic email that's pre-confirmed
// (see that function's own header comment for the full reasoning).
// This screen just collects the two fields, calls it, and signs the
// owner in on success.
export default function SignupScreen({
  onSignedUp,
  onBack,
}: {
  onSignedUp: () => void;
  onBack: () => void;
}) {
  const { tr } = useTranslation();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidAfghanPhone(phone)) {
      setError(tr("auth.phoneInvalid"));
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(tr("auth.passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(tr("auth.passwordMismatch"));
      return;
    }

    setLoading(true);

    // Calling the Edge Function directly with the project's anon key
    // as the bearer token (rather than supabase.functions.invoke,
    // which would try to attach a user session that doesn't exist
    // yet) — the anon key is itself a valid signed JWT, so it clears
    // Supabase's gateway-level JWT check; the function itself is
    // deliberately public from there (see its own comments).
    let result: any;
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const response = await fetch(`${SUPABASE_URL}/functions/v1/self-signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ phone_number: phone, password }),
      });
      result = await response.json().catch(() => null);
      if (!response.ok || result?.error) {
        if (result?.error === "phone_already_registered") {
          setError(tr("auth.phoneTaken"));
        } else if (result?.error === "invalid_phone") {
          setError(tr("auth.phoneInvalid"));
        } else if (result?.error === "weak_password") {
          setError(tr("auth.passwordTooShort"));
        } else {
          setError(tr("common.somethingWentWrong"));
        }
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error("self-signup request failed:", err);
      setError(tr("common.somethingWentWrong"));
      setLoading(false);
      return;
    }

    // Account exists now — log the owner straight in with the
    // password they just chose, same synthetic-email mapping the
    // login screen uses.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: `${normalizeAfghanPhone(phone).replace(/\D/g, "")}@saudagar.local`,
      password,
    });

    setLoading(false);
    if (signInError) {
      // Account was created but the immediate sign-in failed (e.g. a
      // dropped connection right after signup) — send them to the
      // login screen with their new credentials rather than stalling
      // here with no way forward.
      console.error("post-signup sign-in failed:", signInError);
      setError(tr("auth.signupSucceededLoginManually"));
      return;
    }
    onSignedUp();
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
      <div style={{ marginBottom: 12 }}>
        <BackButton onClick={onBack} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: radius.xl,
            background: colors.primary,
            color: colors.white,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: shadow.raised,
            marginBottom: 12,
          }}
        >
          <WalletIcon size={28} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: colors.textPrimary }}>{tr("auth.createAccount")}</div>
      </div>

      <form
        onSubmit={handleSignup}
        style={{
          background: colors.surface,
          borderRadius: radius.lg,
          boxShadow: shadow.card,
          padding: 20,
          display: "grid",
          gap: 12,
        }}
      >
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
        <input
          placeholder={tr("auth.confirmPassword")}
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          style={inputStyle}
        />
        <button type="submit" disabled={loading} style={{ ...primaryButtonStyle, opacity: loading ? 0.7 : 1 }}>
          {loading ? "…" : tr("auth.createAccountButton")}
        </button>
      </form>
    </div>
  );
}
