import { useState } from "react";
import AccountRequestsScreen from "./AccountRequestsScreen";
import PriceUploadScreen from "./PriceUploadScreen";
import ManualPaymentsScreen from "./ManualPaymentsScreen";
import AdminLoginScreen from "./AdminLoginScreen";
import { useAdminAuth } from "./useAdminAuth";

export default function App() {
  const { isAuthenticated, isAuthorizedAdmin, notAnAdmin, admin, loading, signOut } = useAdminAuth();
  const [tab, setTab] = useState<"requests" | "prices" | "payments">("requests");

  if (loading) {
    return <div style={{ padding: 16 }}>Loading…</div>;
  }

  if (!isAuthenticated) {
    return <AdminLoginScreen />;
  }

  if (notAnAdmin || !isAuthorizedAdmin) {
    return (
      <div style={{ padding: 16 }}>
        <p>This account isn't set up as an admin. Contact the super admin.</p>
        <button onClick={signOut}>Log Out</button>
      </div>
    );
  }

  const canApprove = admin!.can_approve_accounts;
  const canUploadPrices = admin!.allowed_markets.length > 0;

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px" }}>
        <span style={{ fontSize: 13, color: "#888" }}>{admin!.name} ({admin!.role})</span>
        <button onClick={signOut} style={{ fontSize: 12 }}>Log Out</button>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid #ddd" }}>
        {canApprove && (
          <button style={{ flex: 1, padding: 12 }} onClick={() => setTab("requests")}>
            Account Requests
          </button>
        )}
        {canApprove && (
          <button style={{ flex: 1, padding: 12 }} onClick={() => setTab("payments")}>
            Manual Payments
          </button>
        )}
        {canUploadPrices && (
          <button style={{ flex: 1, padding: 12 }} onClick={() => setTab("prices")}>
            Upload Prices
          </button>
        )}
      </div>

      {!canApprove && !canUploadPrices && (
        <p style={{ padding: 16, color: "#888" }}>
          You don't have any admin permissions assigned yet. Ask the super admin to set
          can_approve_accounts or allowed_markets on your admin_users row.
        </p>
      )}

      {tab === "requests" && canApprove && <AccountRequestsScreen />}
      {tab === "payments" && canApprove && <ManualPaymentsScreen />}
      {tab === "prices" && canUploadPrices && <PriceUploadScreen />}
    </div>
  );
}
