import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { LanguageProvider } from "./contexts/LanguageContext";
import { initSyncListeners } from "./lib/offlineQueue";

// "Sync eagerly, not lazily" — start listening for reconnects and
// periodic retry as soon as the app boots, not on first ledger action.
initSyncListeners();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LanguageProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </LanguageProvider>
  </React.StrictMode>
);
