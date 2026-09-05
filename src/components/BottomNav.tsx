import { NavLink } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";

const TABS = [
  { path: "/ledger", labelKey: "nav.ledger" as const },
  { path: "/inventory", labelKey: "nav.inventory" as const },
  { path: "/prices", labelKey: "nav.prices" as const },
  { path: "/subscription", labelKey: "nav.settings" as const },
];

// TODO: wire labelKey lookups to the actual i18n JSON files once a
// translation-loading utility exists (src/i18n/*.json are in place,
// just need a t() helper reading the active language from context).
export default function BottomNav() {
  useLanguage(); // subscribes to language changes so this re-renders once i18n lookup is wired in (see TODO)

  return (
    <nav style={{ display: "flex", borderTop: "1px solid #ddd", padding: "8px 0" }}>
      {TABS.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          style={({ isActive }) => ({
            flex: 1,
            textAlign: "center",
            fontSize: 12,
            color: isActive ? "#1e6f5c" : "#888",
            textDecoration: "none",
          })}
        >
          {tab.labelKey} {/* placeholder text — swap for t(tab.labelKey, language) */}
        </NavLink>
      ))}
    </nav>
  );
}
