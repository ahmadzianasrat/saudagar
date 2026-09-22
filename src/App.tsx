import { useState, useEffect } from "react";
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
import ShopProfileScreen from "./features/settings/ShopProfileScreen";
import ManageSecretariesScreen from "./features/settings/ManageSecretariesScreen";
import CurrencyConverterScreen from "./features/tools/CurrencyConverterScreen";
import LegalScreen from "./features/legal/LegalScreen";
import ReportsScreen from "./features/reports/ReportsScreen";
import { useAuth } from "./lib/useAuth";
import { getShopContext } from "./lib/authSession";
import { useSubscriptionStatus } from "./lib/useSubscriptionStatus";
import { useTranslation } from "./i18n/useTranslation";
import { colors } from "./theme";
import { WalletIcon } from "./components/icons";

export default function App() {
  const { session, isAuthenticated, loading } = useAuth();
  const [showRequestAccess, setShowRequestAccess] = useState(false);
  // The shop's own profile id, not necessarily session.user.id — a
  // secretary login (see migrations/020_shop_secretaries.sql) has a
  // different auth id than the shop's subscription is filed under.
  const [shopProfileId, setShopProfileId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!isAuthenticated) {
      setShopProfileId(undefined);
      return;
    }
    getShopContext().then(({ shopProfileId }) => setShopProfileId(shopProfileId ?? undefined));
  }, [isAuthenticated, session?.user.id]);
  const subscriptionStatus = useSubscriptionStatus(shopProfileId);
  const { tr } = useTranslation();

  if (loading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          background: colors.bg,
          color: colors.textSecondary,
        }}
      >
        <WalletIcon size={36} color={colors.primary} />
        <span style={{ fontSize: 13 }}>{tr("auth.loading")}</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (showRequestAccess) {
      return <RequestAccessScreen onBack={() => setShowRequestAccess(false)} />;
    }
    return (
      <div style={{ minHeight: "100vh", background: colors.bg }}>
        <LoginScreen onLoggedIn={() => {}} onRequestAccess={() => setShowRequestAccess(true)} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: colors.bg }}>
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
          <Route path="/settings/shop-profile" element={<ShopProfileScreen />} />
          <Route path="/settings/secretaries" element={<ManageSecretariesScreen />} />
          <Route path="/tools/currency-converter" element={<CurrencyConverterScreen />} />
          <Route path="/legal/:doc" element={<LegalScreen />} />
          <Route path="/reports" element={<ReportsScreen />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  );
}
