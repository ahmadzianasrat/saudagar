import { Routes, Route, Navigate } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import LedgerHome from "./features/ledger/LedgerHome";
import InventoryHome from "./features/inventory/InventoryHome";
import PricesHome from "./features/prices/PricesHome";
import SubscriptionScreen from "./features/subscription/SubscriptionScreen";
import RequestAccessScreen from "./features/profile/RequestAccessScreen";

// TODO: replace with real Supabase auth-state check once auth is wired up.
// This stub always treats the user as logged out, so the request-access
// screen is what renders first when you start filling in real logic.
const IS_AUTHENTICATED = false;

export default function App() {
  if (!IS_AUTHENTICATED) {
    return <RequestAccessScreen />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
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
