import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Tier = "monthly" | "six_month";

// Calls the create-payment-session Edge Function and redirects the
// user to HesabPay's checkout. Mirrors the flow documented on
// HesabPay's Get Started page: create session -> redirect to
// payment_url -> user pays -> webhook confirms -> subscription active.
export default function SubscriptionScreen() {
  const [loading, setLoading] = useState<Tier | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <h2>Subscription</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <button disabled={loading !== null} onClick={() => subscribe("monthly")}>
        {loading === "monthly" ? "..." : "Monthly — 250 AFN"}
      </button>
      <button disabled={loading !== null} onClick={() => subscribe("six_month")}>
        {loading === "six_month" ? "..." : "6 Months — 1,250 AFN (save ~17%)"}
      </button>
      {/* TODO: show current subscription status / expiry, pulled from
          the `subscriptions` table, and the read-only banner text
          (subscription.expired in i18n) when lapsed. */}
    </div>
  );
}
