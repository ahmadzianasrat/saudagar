import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import RenewalBanner from "./components/RenewalBanner";
import LedgerHome from "./features/ledger/LedgerHome";
import InventoryHome from "./features/inventory/InventoryHome";
import PricesHome from "./features/prices/PricesHome";
import SubscriptionScreen from "./features/subscription/SubscriptionScreen";
import RequestAccessScreen from "./features/profile/RequestAccessScreen";
import LoginScreen from "./features/auth/LoginScreen";
import { useAuth } from "./lib/useAuth";
import { useSubscriptionStatus } from "./lib/useSubscriptionStatus";

// Real auth state, replacing the earlier IS_AUTHENTICATED stub.
export default function App() {
  const { session, isAuthenticated, loading } = useAuth();
  const [showRequestAccess, setShowRequestAccess] = useState(false);
  const subscriptionStatus = useSubscriptionStatus(session?.user.id);

  if (loading) {
    return <div style={{ padding: 16 }}>Loading…</div>;
  }

  if (!isAuthenticated) {
    if (showRequestAccess) {
      return <RequestAccessScreen />;
    }
    return (
      <div>
        <LoginScreen onLoggedIn={() => {}} />
        <button
          style={{ margin: "0 16px" }}
          onClick={() => setShowRequestAccess(true)}
        >
          New here? Request access
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <RenewalBanner status={subscriptionStatus} />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <Routes>
          <Route path="/" element={<Navigate to="/ledger" replace />} />
          <Route path="/ledger" element={<LedgerHome />} />
          <Route path="/inventory" element={<InventoryHome />} />
          <Route path="/prices" element={<PricesHome />} />
          <Route path="/subscription" element={<SubscriptionScreen />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  );
}
