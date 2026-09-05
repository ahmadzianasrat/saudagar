import type { FormEvent } from "react";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { phoneToSyntheticEmail } from "../../lib/authHelpers";
import { useTranslation } from "../../i18n/useTranslation";

// "Phone-number + admin-created login": the shop owner never chooses
// their own password or receives an OTP. An admin approves their
// account_requests row (via admin-approve-account), which generates
// a password and relays it manually (call/WhatsApp) — the owner just
// enters their phone number and that password here.
export default function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
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
    <form onSubmit={handleLogin} style={{ padding: 16, display: "grid", gap: 8 }}>
      <h2>{tr("auth.login")}</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <input
        placeholder={tr("auth.phoneNumber")}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        inputMode="tel"
      />
      <input
        placeholder={tr("auth.password")}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit" disabled={loading}>
        {loading ? "..." : tr("auth.loginButton")}
      </button>
      {/* TODO: link to RequestAccessScreen for users who haven't been approved yet */}
    </form>
  );
}
