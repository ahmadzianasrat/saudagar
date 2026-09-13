import type { FormEvent } from "react";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useTranslation } from "../../i18n/useTranslation";
import { colors, inputStyle, primaryButtonStyle, radius, shadow } from "../../theme";
import { CheckCircleIcon } from "../../components/icons";
import { BackButton } from "../../components/ui";

// Shop owner submits basic info, an admin reviews and approves/declines
// from the separate admin panel. No account exists in `profiles` until
// approved — this only writes to `account_requests`.
export default function RequestAccessScreen({ onBack }: { onBack: () => void }) {
  const { tr } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ownerName: "", shopName: "", phoneNumber: "" });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // TODO: also collect market_id once a market picker exists — for
    // launch with a single market this can default to that market's id.
    const { error: insertError } = await supabase.from("account_requests").insert({
      owner_name: form.ownerName,
      shop_name: form.shopName,
      phone_number: form.phoneNumber,
    });

    setLoading(false);

    // Previously this didn't check for an error at all, so a silently
    // failed insert (e.g. an RLS policy blocking it) still showed the
    // "pending approval" success message with nothing actually saved.
    if (insertError) {
      console.error("account_requests insert failed:", insertError);
      setError("Something went wrong submitting your request. Please try again.");
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.pill,
            background: colors.successSoft,
            color: colors.success,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CheckCircleIcon size={30} />
        </div>
        <p style={{ color: colors.textPrimary, fontSize: 15, maxWidth: 280 }}>{tr("onboarding.pendingApproval")}</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <BackButton onClick={onBack} />
      </div>
      <form
        onSubmit={handleSubmit}
        style={{
          background: colors.surface,
          borderRadius: radius.lg,
          boxShadow: shadow.card,
          padding: 20,
          display: "grid",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, color: colors.textPrimary }}>{tr("onboarding.requestAccess")}</h2>
        {error && (
          <p style={{ color: colors.danger, fontSize: 13, margin: 0, background: colors.dangerSoft, padding: "8px 10px", borderRadius: radius.sm }}>
            {error}
          </p>
        )}
        <input
          placeholder={tr("onboarding.ownerName")}
          value={form.ownerName}
          onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
          style={inputStyle}
        />
        <input
          placeholder={tr("onboarding.shopName")}
          value={form.shopName}
          onChange={(e) => setForm({ ...form, shopName: e.target.value })}
          style={inputStyle}
        />
        <input
          placeholder={tr("ledger.phoneNumber")}
          value={form.phoneNumber}
          onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
          inputMode="tel"
          style={inputStyle}
        />
        <button type="submit" disabled={loading} style={{ ...primaryButtonStyle, opacity: loading ? 0.7 : 1 }}>
          {loading ? "…" : tr("onboarding.submit")}
        </button>
      </form>
    </div>
  );
}
