import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useSubscriptionStatus } from "../../lib/useSubscriptionStatus";
import { useTranslation } from "../../i18n/useTranslation";

type Tier = "monthly" | "six_month";
const TIER_AMOUNTS: Record<Tier, number> = { monthly: 250, six_month: 1250 };

// Calls the create-payment-session Edge Function and redirects the
// user to HesabPay's checkout. Mirrors the flow documented on
// HesabPay's Get Started page: create session -> redirect to
// payment_url -> user pays -> webhook confirms -> subscription active.
//
// Also offers a manual-payment path (cash in hand or mobile top-up)
// for customers who don't use HesabPay — submits a claim for admin
// review rather than activating anything automatically.
export default function SubscriptionScreen() {
  const { tr } = useTranslation();
  const [profileId, setProfileId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<Tier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const status = useSubscriptionStatus(profileId);

  const [showManual, setShowManual] = useState(false);
  const [manualTier, setManualTier] = useState<Tier>("monthly");
  const [manualNote, setManualNote] = useState("");
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualSubmitted, setManualSubmitted] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setProfileId(data.user?.id));

    // HesabPay redirects back here after checkout — actual confirmation
    // comes from the webhook independently, so this redirect is purely
    // informational (the subscription may not be active yet the instant
    // this page loads if the webhook hasn't landed).
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      setNotice("Payment received — your subscription will activate shortly.");
    } else if (params.get("payment") === "failure") {
      setNotice("Payment was not completed. You can try again below.");
    }
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
        throw new Error(
          result.error
            ? `${result.error}${result.detail ? " — " + JSON.stringify(result.detail) : ""}`
            : "Could not start payment"
        );
      }

      window.location.href = result.payment_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  async function submitManualPayment(e: FormEvent) {
    e.preventDefault();
    if (!profileId) return;
    setManualSubmitting(true);
    setError(null);

    let proofImagePath: string | null = null;

    if (manualFile) {
      const path = `${profileId}/${Date.now()}-${manualFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(path, manualFile);

      if (uploadError) {
        console.error("proof upload failed:", uploadError);
        setError("Couldn't upload the screenshot. You can still submit without it.");
      } else {
        proofImagePath = path;
      }
    }

    const { error: insertError } = await supabase.from("manual_payment_requests").insert({
      profile_id: profileId,
      tier: manualTier,
      amount: TIER_AMOUNTS[manualTier],
      note: manualNote || null,
      proof_image_path: proofImagePath,
    });

    setManualSubmitting(false);

    if (insertError) {
      console.error("manual payment request failed:", insertError);
      setError("Couldn't submit your request. Please try again.");
      return;
    }

    setManualSubmitted(true);
    setShowManual(false);
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
      {notice && <p style={{ color: "#1e6f5c" }}>{notice}</p>}
      {manualSubmitted && (
        <p style={{ color: "#1e6f5c" }}>
          Your payment claim has been submitted for review. You'll be able to use the app once an admin approves it.
        </p>
      )}

      <button disabled={loading !== null} onClick={() => subscribe("monthly")} style={{ display: "block", width: "100%", marginBottom: 8, padding: 10 }}>
        {loading === "monthly" ? "..." : tr("subscription.monthly")}
      </button>
      <button disabled={loading !== null} onClick={() => subscribe("six_month")} style={{ display: "block", width: "100%", marginBottom: 8, padding: 10 }}>
        {loading === "six_month" ? "..." : tr("subscription.sixMonth")}
      </button>

      <button onClick={() => setShowManual((v) => !v)} style={{ display: "block", width: "100%", padding: 10, background: "none", border: "1px solid #ccc" }}>
        Pay another way (cash / mobile top-up)
      </button>

      {showManual && (
        <form onSubmit={submitManualPayment} style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <select value={manualTier} onChange={(e) => setManualTier(e.target.value as Tier)}>
            <option value="monthly">Monthly — 250 AFN</option>
            <option value="six_month">6 Months — 1,250 AFN</option>
          </select>
          <textarea
            placeholder="How did you pay? (e.g. cash to shop, mobile top-up reference)"
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
            rows={3}
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setManualFile(e.target.files?.[0] ?? null)}
          />
          <p style={{ fontSize: 11, color: "#888" }}>
            A screenshot is optional but helps get your request approved faster.
          </p>
          <button type="submit" disabled={manualSubmitting}>
            {manualSubmitting ? "Submitting..." : "Submit for Review"}
          </button>
        </form>
      )}
    </div>
  );
}
