import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import RenewalBanner from "./components/RenewalBanner";
import LedgerHome from "./features/ledger/LedgerHome";
import CounterpartyLedgerDetail from "./features/ledger/CounterpartyLedgerDetail";
import InventoryHome from "./features/inventory/InventoryHome";
import PricesHome from "./features/prices/PricesHome";
import SubscriptionScreen from "./features/subscription/SubscriptionScreen";
import RequestAccessScreen from "./features/profile/RequestAccessScreen";
import LoginScreen from "./features/auth/LoginScreen";
import SettingsScreen from "./features/settings/SettingsScreen";
import ChangePasswordScreen from "./features/settings/ChangePasswordScreen";
import CurrencyConverterScreen from "./features/tools/CurrencyConverterScreen";
import { useAuth } from "./lib/useAuth";
import { useSubscriptionStatus } from "./lib/useSubscriptionStatus";
import { useTranslation } from "./i18n/useTranslation";

export default function App() {
  const { session, isAuthenticated, loading } = useAuth();
  const [showRequestAccess, setShowRequestAccess] = useState(false);
  const subscriptionStatus = useSubscriptionStatus(session?.user.id);
  const { tr } = useTranslation();

  if (loading) {
    return <div style={{ padding: 16 }}>{tr("auth.loading")}</div>;
  }

  if (!isAuthenticated) {
    if (showRequestAccess) {
      return <RequestAccessScreen />;
    }
    return (
      <div>
        <LoginScreen onLoggedIn={() => {}} />
        <button style={{ margin: "0 16px" }} onClick={() => setShowRequestAccess(true)}>
          {tr("auth.newHere")}
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
          <Route path="/ledger/:counterpartyId" element={<CounterpartyLedgerDetail />} />
          <Route path="/inventory" element={<InventoryHome />} />
          <Route path="/prices" element={<PricesHome />} />
          <Route path="/subscription" element={<SubscriptionScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/settings/change-password" element={<ChangePasswordScreen />} />
          <Route path="/tools/currency-converter" element={<CurrencyConverterScreen />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  );
}
