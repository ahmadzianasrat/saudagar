import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useSubscriptionStatus } from "../../lib/useSubscriptionStatus";
import { useTranslation } from "../../i18n/useTranslation";

type Tier = "monthly" | "six_month";

// Calls the create-payment-session Edge Function and redirects the
// user to HesabPay's checkout. Mirrors the flow documented on
// HesabPay's Get Started page: create session -> redirect to
// payment_url -> user pays -> webhook confirms -> subscription active.
export default function SubscriptionScreen() {
  const { tr } = useTranslation();
  const [profileId, setProfileId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<Tier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = useSubscriptionStatus(profileId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setProfileId(data.user?.id));
  }, []);

  async function subscribe(tier: Tier) {
    setLoading(tier);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Not logged in");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ tier }),
        }
      );

      const result = await response.json();
      if (!response.ok || !result.payment_url) {
        throw new Error(result.error ?? "Could not start payment");
      }

      window.location.href = result.payment_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>{tr("subscription.title")}</h2>

      {!status.loading && status.hasAccess && (
        <div style={{ background: "#e8f5e9", padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          {status.tier === "trial" ? "Trial" : status.tier === "monthly" ? "Monthly" : "6-month"} —{" "}
          {status.daysUntilExpiry} day(s) remaining (expires {status.expiresAt?.toLocaleDateString()})
        </div>
      )}
      {!status.loading && !status.hasAccess && status.tier !== null && (
        <div style={{ background: "#fdecea", padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          {tr("subscription.expired")}
        </div>
      )}

      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <button disabled={loading !== null} onClick={() => subscribe("monthly")} style={{ display: "block", width: "100%", marginBottom: 8, padding: 10 }}>
        {loading === "monthly" ? "..." : tr("subscription.monthly")}
      </button>
      <button disabled={loading !== null} onClick={() => subscribe("six_month")} style={{ display: "block", width: "100%", padding: 10 }}>
        {loading === "six_month" ? "..." : tr("subscription.sixMonth")}
      </button>
    </div>
  );
}
