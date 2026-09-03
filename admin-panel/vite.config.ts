import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Deliberately a SEPARATE app from the main PWA, per the earlier
// decision — less risk of an admin action being exposed in the
// consumer-facing bundle, and permission scoping (can_approve_accounts,
// allowed_markets) is enforced purely server-side by RLS/Edge Functions
// regardless, so this separation is about attack-surface hygiene, not
// the only line of defense.
export default defineConfig({
  plugins: [react()],
});
