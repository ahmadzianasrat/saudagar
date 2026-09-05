import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { phoneToSyntheticEmail } from "../../lib/authHelpers";
import { useTranslation } from "../../i18n/useTranslation";

// Re-verifies the CURRENT password before allowing a change, even
// though a valid session alone would let Supabase's updateUser()
// succeed without it. Worth the extra step specifically because
// admin-issued passwords are shared once via WhatsApp/call and the
// device may stay logged in for a long time — re-confirming the
// current password here guards against someone with brief physical
// access to an unlocked phone silently locking the real owner out.
export default function ChangePasswordScreen() {
  const navigate = useNavigate();
  const { tr } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError(tr("password.mismatch"));
      return;
    }
    if (newPassword.length < 6) {
      setError(tr("password.tooShort"));
      return;
    }

    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const phoneNumber = userData.user?.phone;
    if (!phoneNumber) {
      setError(tr("password.error"));
      setLoading(false);
      return;
    }

    // Re-verify current password via a fresh sign-in attempt.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: phoneToSyntheticEmail(phoneNumber),
      password: currentPassword,
    });

    if (reauthError) {
      setError(tr("password.incorrectCurrent"));
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

    setLoading(false);
    if (updateError) {
      setError(tr("password.error"));
      return;
    }

    setSuccess(true);
    setTimeout(() => navigate("/settings"), 1200);
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>{tr("password.title")}</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {success && <p style={{ color: "#2e7d32" }}>{tr("password.success")}</p>}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 8, marginTop: 12 }}>
        <input
          type="password"
          placeholder={tr("password.current")}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder={tr("password.new")}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder={tr("password.confirm")}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "..." : tr("password.save")}
        </button>
      </form>
    </div>
  );
}
