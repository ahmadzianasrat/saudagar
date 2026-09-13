import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useSubscriptionStatus } from "../../lib/useSubscriptionStatus";
import { useTranslation } from "../../i18n/useTranslation";
import { colors, inputStyle, primaryButtonStyle, radius, secondaryButtonStyle, shadow } from "../../theme";
import { Card, Pill, PageHeader } from "../../components/ui";
import { CameraIcon, CheckCircleIcon, CrownIcon } from "../../components/icons";

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
  const navigate = useNavigate();
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
    <div style={{ padding: 16, paddingBottom: 28 }}>
      <PageHeader title={tr("subscription.title")} onBack={() => navigate("/settings")} />

      {!status.loading && status.hasAccess && (
        <Card style={{ marginBottom: 14, background: colors.successSoft, boxShadow: "none", display: "flex", alignItems: "center", gap: 10 }}>
          <CheckCircleIcon size={22} color={colors.success} />
          <div style={{ fontSize: 13, color: colors.success }}>
            {status.tier === "trial" ? "Trial" : status.tier === "monthly" ? "Monthly" : "6-month"} — {status.daysUntilExpiry} day(s) remaining
            <div style={{ fontSize: 11.5, opacity: 0.85 }}>expires {status.expiresAt?.toLocaleDateString()}</div>
          </div>
        </Card>
      )}
      {!status.loading && !status.hasAccess && status.tier !== null && (
        <Card style={{ marginBottom: 14, background: colors.dangerSoft, boxShadow: "none" }}>
          <div style={{ fontSize: 13, color: colors.danger }}>{tr("subscription.expired")}</div>
        </Card>
      )}

      {error && (
        <p style={{ color: colors.danger, fontSize: 13, background: colors.dangerSoft, padding: "8px 10px", borderRadius: radius.sm }}>{error}</p>
      )}
      {notice && (
        <p style={{ color: colors.primary, fontSize: 13, background: colors.primarySoft, padding: "8px 10px", borderRadius: radius.sm }}>{notice}</p>
      )}
      {manualSubmitted && (
        <p style={{ color: colors.success, fontSize: 13, background: colors.successSoft, padding: "8px 10px", borderRadius: radius.sm }}>
          Your payment claim has been submitted for review. You'll be able to use the app once an admin approves it.
        </p>
      )}

      <div style={{ display: "grid", gap: 12, marginTop: 6 }}>
        <PlanCard
          title={tr("subscription.monthly")}
          price={`${TIER_AMOUNTS.monthly} AFN`}
          period="/ month"
          onClick={() => subscribe("monthly")}
          loading={loading === "monthly"}
          disabled={loading !== null}
        />
        <PlanCard
          title={tr("subscription.sixMonth")}
          price={`${TIER_AMOUNTS.six_month} AFN`}
          period="/ 6 months"
          badge="Save ~17%"
          onClick={() => subscribe("six_month")}
          loading={loading === "six_month"}
          disabled={loading !== null}
          highlighted
        />
      </div>

      <button
        onClick={() => setShowManual((v) => !v)}
        style={{ ...secondaryButtonStyle, marginTop: 14 }}
      >
        Pay another way (cash / mobile top-up)
      </button>

      {showManual && (
        <Card style={{ marginTop: 12 }}>
          <form onSubmit={submitManualPayment} style={{ display: "grid", gap: 10 }}>
            <select value={manualTier} onChange={(e) => setManualTier(e.target.value as Tier)} style={inputStyle}>
              <option value="monthly">Monthly — 250 AFN</option>
              <option value="six_month">6 Months — 1,250 AFN</option>
            </select>
            <textarea
              placeholder="How did you pay? (e.g. cash to shop, mobile top-up reference)"
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" as const }}
            />
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 14px",
                borderRadius: radius.md,
                border: `1px dashed ${colors.border}`,
                color: colors.textSecondary,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <CameraIcon size={18} color={colors.primary} />
              {manualFile ? manualFile.name : "Attach a screenshot (optional)"}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setManualFile(e.target.files?.[0] ?? null)}
                style={{ display: "none" }}
              />
            </label>
            <p style={{ fontSize: 11, color: colors.textFaint, margin: 0 }}>
              A screenshot is optional but helps get your request approved faster.
            </p>
            <button type="submit" disabled={manualSubmitting} style={{ ...primaryButtonStyle, opacity: manualSubmitting ? 0.7 : 1 }}>
              {manualSubmitting ? "Submitting..." : "Submit for Review"}
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}

function PlanCard({
  title,
  price,
  period,
  badge,
  onClick,
  loading,
  disabled,
  highlighted,
}: {
  title: string;
  price: string;
  period: string;
  badge?: string;
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  highlighted?: boolean;
}) {
  return (
    <div
      style={{
        background: colors.surface,
        borderRadius: radius.lg,
        boxShadow: highlighted ? shadow.raised : shadow.card,
        border: highlighted ? `1.5px solid ${colors.primary}` : `1px solid transparent`,
        padding: 16,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: radius.pill,
          background: highlighted ? colors.primary : colors.primarySoft,
          color: highlighted ? colors.white : colors.primary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <CrownIcon size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: colors.textPrimary }}>{title}</div>
          {badge && <Pill bg={colors.successSoft} fg={colors.success}>{badge}</Pill>}
        </div>
        <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
          <strong style={{ color: colors.textPrimary }}>{price}</strong> {period}
        </div>
      </div>
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          padding: "9px 16px",
          borderRadius: radius.md,
          border: "none",
          background: highlighted ? colors.primary : colors.primarySoft,
          color: highlighted ? colors.white : colors.primary,
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
          opacity: disabled ? 0.7 : 1,
          flexShrink: 0,
        }}
      >
        {loading ? "…" : "Choose"}
      </button>
    </div>
  );
}
