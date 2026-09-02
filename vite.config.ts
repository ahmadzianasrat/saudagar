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
      },
    }),
  ],
});
