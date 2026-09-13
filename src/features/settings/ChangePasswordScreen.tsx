import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { phoneToSyntheticEmail } from "../../lib/authHelpers";
import { useTranslation } from "../../i18n/useTranslation";
import { colors, inputStyle, primaryButtonStyle, radius } from "../../theme";
import { Card, PageHeader } from "../../components/ui";
import { LockIcon } from "../../components/icons";

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
    if (!userData.user) {
      setError(tr("password.error"));
      setLoading(false);
      return;
    }

    // Read from profiles.phone_number, not auth.users.phone — the
    // latter is intentionally left unset at account creation (see
    // admin-approve-account), since login uses synthetic email +
    // password only, not Supabase's own phone-auth field.
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone_number")
      .eq("id", userData.user.id)
      .single();

    const phoneNumber = profile?.phone_number;
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
    <div style={{ padding: 16, paddingBottom: 28 }}>
      <PageHeader title={tr("password.title")} onBack={() => navigate("/settings")} />

      <Card style={{ textAlign: "center", marginBottom: 16, paddingTop: 22, paddingBottom: 18 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: radius.pill,
            background: colors.primarySoft,
            color: colors.primary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 10px",
          }}
        >
          <LockIcon size={24} />
        </div>
        <div style={{ fontSize: 13, color: colors.textSecondary, maxWidth: 260, margin: "0 auto" }}>
          {tr("password.title")}
        </div>
      </Card>

      {error && (
        <p style={{ color: colors.danger, fontSize: 13, background: colors.dangerSoft, padding: "8px 10px", borderRadius: radius.sm }}>
          {error}
        </p>
      )}
      {success && (
        <p style={{ color: colors.success, fontSize: 13, background: colors.successSoft, padding: "8px 10px", borderRadius: radius.sm }}>
          {tr("password.success")}
        </p>
      )}

      <Card>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <input
            type="password"
            placeholder={tr("password.current")}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder={tr("password.new")}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder={tr("password.confirm")}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            style={inputStyle}
          />
          <button type="submit" disabled={loading} style={{ ...primaryButtonStyle, opacity: loading ? 0.7 : 1 }}>
            {loading ? "…" : tr("password.save")}
          </button>
        </form>
      </Card>
    </div>
  );
}
