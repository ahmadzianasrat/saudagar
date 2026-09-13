import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import type { SubscriptionStatus } from "../lib/useSubscriptionStatus";
import { shouldShowRenewalBanner } from "../lib/useSubscriptionStatus";
import { useTranslation } from "../i18n/useTranslation";
import { colors } from "../theme";
import { AlertIcon } from "./icons";

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
      <div style={bannerStyle(colors.dangerSoft, colors.danger)} onClick={() => navigate("/subscription")}>
        <AlertIcon size={16} color={colors.danger} />
        {tr("subscription.expired")}
      </div>
    );
  }

  if (showRenewalWarning) {
    return (
      <div style={bannerStyle(colors.amberSoft, colors.amber)} onClick={() => navigate("/subscription")}>
        <AlertIcon size={16} color={colors.amber} />
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
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flexShrink: 0,
  };
}
