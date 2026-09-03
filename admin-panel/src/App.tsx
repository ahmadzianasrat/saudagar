import { useState } from "react";
import AccountRequestsScreen from "./AccountRequestsScreen";
import PriceUploadScreen from "./PriceUploadScreen";

// Two screens only, matching the two independent admin permissions
// modeled in the schema (can_approve_accounts, allowed_markets).
// A staff member might only ever see one tab populate with anything
// useful, depending on which permission they were granted — both
// screens query their own permission and render an empty/blocked
// state if the logged-in admin isn't authorized for that action,
// since the real enforcement is server-side (RLS + Edge Function
// checks), not this tab switcher.
export default function App() {
  const [tab, setTab] = useState<"requests" | "prices">("requests");

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ display: "flex", borderBottom: "1px solid #ddd" }}>
        <button style={{ flex: 1, padding: 12 }} onClick={() => setTab("requests")}>
          Account Requests
        </button>
        <button style={{ flex: 1, padding: 12 }} onClick={() => setTab("prices")}>
          Upload Prices
        </button>
      </div>
      {tab === "requests" ? <AccountRequestsScreen /> : <PriceUploadScreen />}
    </div>
  );
}
