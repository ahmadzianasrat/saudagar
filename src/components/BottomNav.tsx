import { NavLink } from "react-router-dom";
import { useTranslation } from "../i18n/useTranslation";

const TABS = [
  { path: "/ledger", labelKey: "nav.ledger" },
  { path: "/inventory", labelKey: "nav.inventory" },
  { path: "/prices", labelKey: "nav.prices" },
  { path: "/settings", labelKey: "nav.settings" },
];

export default function BottomNav() {
  const { tr } = useTranslation();

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
          {tr(tab.labelKey)}
        </NavLink>
      ))}
    </nav>
  );
}
