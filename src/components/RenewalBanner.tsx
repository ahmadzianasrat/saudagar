import { useNavigate } from "react-router-dom";
import type { SubscriptionStatus } from "../lib/useSubscriptionStatus";
import { shouldShowRenewalBanner } from "../lib/useSubscriptionStatus";

// Two distinct states, per earlier decisions:
//   - 0–5 days left: renewal warning, ledger/inventory still fully usable
//   - already expired: read-only notice (subscription.expired in i18n),
//     writes are blocked by RLS regardless of what the UI shows —
//     this banner is about clarity, not the actual enforcement.
export default function RenewalBanner({ status }: { status: SubscriptionStatus }) {
  const navigate = useNavigate();

  if (status.loading) return null;

  const isExpired = !status.hasAccess && status.tier !== null;
  const showRenewalWarning = shouldShowRenewalBanner(status);

  if (isExpired) {
    return (
      <div style={bannerStyle("#fdecea", "#b3261e")} onClick={() => navigate("/subscription")}>
        {/* TODO: swap for t("subscription.expired", language) once i18n lookup exists */}
        Your subscription has expired. You can view your data, but adding new entries requires renewal.
      </div>
    );
  }

  if (showRenewalWarning) {
    return (
      <div style={bannerStyle("#fff4e5", "#8a5300")} onClick={() => navigate("/subscription")}>
        Your {status.tier === "trial" ? "trial" : "subscription"} ends in {status.daysUntilExpiry}{" "}
        day{status.daysUntilExpiry === 1 ? "" : "s"}. Tap to renew.
      </div>
    );
  }

  return null;
}

function bannerStyle(bg: string, fg: string): React.CSSProperties {
  return {
    background: bg,
    color: fg,
    padding: "10px 16px",
    fontSize: 13,
    cursor: "pointer",
    textAlign: "center",
  };
}
