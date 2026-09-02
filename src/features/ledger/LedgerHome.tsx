import { useLanguage } from "../../contexts/LanguageContext";
// TODO: import { enqueueWrite, getSyncStatus } from "../../lib/offlineQueue";
// TODO: import { supabase } from "../../lib/supabaseClient";

// STUB — replace with real data once:
//   1. Auth is wired up (need a logged-in profile.id to query by)
//   2. A `useLedgerEntries(profileId)` hook is built that reads from
//      IndexedDB first (for instant offline render) and reconciles
//      with Supabase in the background.
export default function LedgerHome() {
  const { formatNumber } = useLanguage();

  return (
    <div style={{ padding: 16 }}>
      <h2>{formatNumber(0)}</h2>
      <p>Ledger screen — see mockup from earlier in the build discussion for target layout.</p>
      {/* TODO: balance summary, given/received cards, recent entries list,
          "+ New Entry" button wired to enqueueWrite("ledger_entries", ...) */}
    </div>
  );
}
