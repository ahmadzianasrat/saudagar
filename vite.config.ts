import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Saudagar",
        short_name: "Saudagar",
        description: "Ledger, inventory, and market prices for grain, cotton, and fertilizer traders",
        theme_color: "#1e6f5c",
        background_color: "#faf8f3",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      // Offline app-shell caching. Note this is separate from the
      // offline DATA layer (src/lib/offlineQueue.ts) — this just
      // caches the app's own code/assets so it loads at all with no
      // connection; the queue handles the actual ledger/inventory writes.
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        // jsPDF (added for receipts) ships optional support for an
        // .html()-to-PDF method that pulls in html2canvas + DOMPurify
        // as separate chunks — code we never call (receipts are built
        // from plain data with jsPDF's text/line drawing APIs, not
        // from DOM screenshots). It's also dynamically imported only
        // when a receipt is actually opened, but Workbox precaches by
        // file glob regardless of import style, so without this
        // exclusion the PWA installer would still eagerly download
        // ~500KB of jsPDF + its dependency chunk to every device on
        // install, whether or not that shop ever uses receipts.
        // Excluding it means: viewing/downloading a receipt for the
        // first time needs a network connection (same as sending it
        // via WhatsApp already would); core offline ledger/inventory
        // entry — the actual offline-first requirement — is
        // unaffected, since that goes through offlineQueue.ts, not
        // through anything precached here.
        globIgnores: ["**/html2canvas*.js", "**/purify*.js", "**/jspdf*.js", "**/index.es-*.js"],
      },
    }),
  ],
});
