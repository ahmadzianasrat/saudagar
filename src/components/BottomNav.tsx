import { NavLink } from "react-router-dom";
import { useTranslation } from "../i18n/useTranslation";
import { colors, shadow } from "../theme";
import { HomeIcon, BoxIcon, TrendingIcon, SettingsIcon } from "./icons";

const TABS = [
  { path: "/ledger", labelKey: "nav.ledger", Icon: HomeIcon },
  { path: "/inventory", labelKey: "nav.inventory", Icon: BoxIcon },
  { path: "/prices", labelKey: "nav.prices", Icon: TrendingIcon },
  { path: "/settings", labelKey: "nav.settings", Icon: SettingsIcon },
];

export default function BottomNav() {
  const { tr } = useTranslation();

  return (
    <nav
      style={{
        display: "flex",
        background: colors.surface,
        boxShadow: shadow.nav,
        padding: "8px 4px",
        paddingBottom: "max(8px, env(safe-area-inset-bottom))",
        flexShrink: 0,
      }}
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          style={({ isActive }) => ({
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            padding: "4px 0",
            fontSize: 11,
            fontWeight: 600,
            color: isActive ? colors.primary : colors.textFaint,
            textDecoration: "none",
          })}
        >
          {({ isActive }) => (
            <>
              <tab.Icon size={22} color={isActive ? colors.primary : colors.textFaint} />
              {tr(tab.labelKey)}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
