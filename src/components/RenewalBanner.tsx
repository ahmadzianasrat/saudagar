import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import type { SubscriptionStatus } from "../lib/useSubscriptionStatus";
import { shouldShowRenewalBanner } from "../lib/useSubscriptionStatus";
import { useTranslation } from "../i18n/useTranslation";

// Two distinct states, per earlier decisions:
//   - 0–5 days left: renewal warning, ledger/inventory still fully usable
//   - already expired: read-only notice (subscription.expired in i18n),
//     writes are blocked by RLS regardless of what the UI shows —
//     this banner is about clarity, not the actual enforcement.
export default function RenewalBanner({ status }: { status: SubscriptionStatus }) {
  const navigate = useNavigate();
  const { tr } = useTranslation();

  if (status.loading) return null;

  const isExpired = !status.hasAccess && status.tier !== null;
  const showRenewalWarning = shouldShowRenewalBanner(status);

  if (isExpired) {
    return (
      <div style={bannerStyle("#fdecea", "#b3261e")} onClick={() => navigate("/subscription")}>
        {tr("subscription.expired")}
      </div>
    );
  }

  if (showRenewalWarning) {
    return (
      <div style={bannerStyle("#fff4e5", "#8a5300")} onClick={() => navigate("/subscription")}>
        {tr("subscription.renewalWarning", { days: status.daysUntilExpiry ?? 0 })}
      </div>
    );
  }

  return null;
}

function bannerStyle(bg: string, fg: string): CSSProperties {
  return {
    background: bg,
    color: fg,
    padding: "10px 16px",
    fontSize: 13,
    cursor: "pointer",
    textAlign: "center",
  };
}
