import type { FormEvent } from "react";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useTranslation } from "../../i18n/useTranslation";

// Shop owner submits basic info, an admin reviews and approves/declines
// from the separate admin panel. No account exists in `profiles` until
// approved — this only writes to `account_requests`.
export default function RequestAccessScreen() {
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
      <div style={{ padding: 16 }}>
        <p>{tr("onboarding.pendingApproval")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: 16, display: "grid", gap: 8 }}>
      <h2>{tr("onboarding.requestAccess")}</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <input
        placeholder={tr("onboarding.ownerName")}
        value={form.ownerName}
        onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
      />
      <input
        placeholder={tr("onboarding.shopName")}
        value={form.shopName}
        onChange={(e) => setForm({ ...form, shopName: e.target.value })}
      />
      <input
        placeholder={tr("ledger.phoneNumber")}
        value={form.phoneNumber}
        onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
      />
      <button type="submit" disabled={loading}>
        {loading ? "..." : tr("onboarding.submit")}
      </button>
    </form>
  );
}
