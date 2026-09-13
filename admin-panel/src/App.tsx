import { useState } from "react";
import AccountRequestsScreen from "./AccountRequestsScreen";
import PriceUploadScreen from "./PriceUploadScreen";
import ManualPaymentsScreen from "./ManualPaymentsScreen";
import UsersScreen from "./UsersScreen";
import AdminManagementScreen from "./AdminManagementScreen";
import AdminLoginScreen from "./AdminLoginScreen";
import DashboardScreen from "./DashboardScreen";
import { useAdminAuth } from "./useAdminAuth";
import { colors, layout, radius, shadow } from "./theme";
import { Avatar } from "./ui";
import {
  ClipboardIcon,
  CreditCardIcon,
  GridIcon,
  LogOutIcon,
  MenuIcon,
  MoreIcon,
  ShieldIcon,
  StoreIcon,
  TrendingIcon,
  UsersIcon,
} from "./icons";

type Tab = "dashboard" | "requests" | "prices" | "payments" | "users" | "admins";

export default function App() {
  const { isAuthenticated, isAuthorizedAdmin, notAnAdmin, admin, loading, signOut } = useAdminAuth();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showMore, setShowMore] = useState(false);

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: colors.bg, color: colors.textSecondary, gap: 10 }}>
        <StoreIcon size={28} color={colors.primary} />
        <span style={{ fontSize: 14 }}>Loading…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLoginScreen />;
  }

  if (notAnAdmin || !isAuthorizedAdmin) {
    return (
      <div style={{ minHeight: "100vh", background: colors.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: colors.surface, borderRadius: radius.lg, boxShadow: shadow.card, padding: 24, maxWidth: 360, textAlign: "center" }}>
          <p style={{ color: colors.textPrimary, fontSize: 14 }}>This account isn't set up as an admin. Contact the super administrator.</p>
          <button onClick={signOut} style={{ marginTop: 10, padding: "9px 18px", borderRadius: radius.md, border: "none", background: colors.primarySoft, color: colors.primary, fontWeight: 600, cursor: "pointer" }}>
            Log Out
          </button>
        </div>
      </div>
    );
  }

  // Super admin automatically has full authority in the UI too, not
  // just at the RLS/Edge Function level — no manual permission
  // assignment needed for the account that IS the super admin.
  const isSuperAdmin = admin!.role === "super_admin";
  const canApprove = isSuperAdmin || admin!.can_approve_accounts;
  const canUploadPrices = isSuperAdmin || admin!.allowed_markets.length > 0;

  const navItems: { key: Tab; label: string; icon: JSX.Element; show: boolean }[] = [
    { key: "dashboard", label: "Dashboard", icon: <GridIcon size={19} />, show: true },
    { key: "requests", label: "Account Requests", icon: <ClipboardIcon size={19} />, show: canApprove },
    { key: "payments", label: "Manual Payments", icon: <CreditCardIcon size={19} />, show: canApprove },
    { key: "users", label: "Users", icon: <UsersIcon size={19} />, show: canApprove },
    { key: "prices", label: "Upload Prices", icon: <TrendingIcon size={19} />, show: canUploadPrices },
    { key: "admins", label: "Admins", icon: <ShieldIcon size={19} />, show: isSuperAdmin },
  ];
  const visibleItems = navItems.filter((n) => n.show);
  // Bottom nav on mobile shows the first 4 items directly, the rest
  // (if any) behind a "More" popover.
  const primaryMobileItems = visibleItems.slice(0, 4);
  const overflowMobileItems = visibleItems.slice(4);

  return (
    <div style={{ minHeight: "100vh", background: colors.bg }}>
      {/* Top bar */}
      <div
        style={{
          height: layout.topbarHeight,
          background: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 18px",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="admin-sidebar-toggle"
          style={{ width: 36, height: 36, borderRadius: radius.pill, border: "none", background: colors.surfaceMuted, color: colors.textSecondary, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <MenuIcon size={19} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "end" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>{admin!.name}</div>
            <div style={{ fontSize: 11, color: colors.textFaint }}>{isSuperAdmin ? "super_admin" : "staff"}</div>
          </div>
          <Avatar label={admin!.name} size={34} />
          <button
            onClick={signOut}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: radius.md, border: "none", background: colors.dangerSoft, color: colors.danger, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}
          >
            <LogOutIcon size={15} />
            Log Out
          </button>
        </div>
      </div>

      <div style={{ display: "flex" }}>
        {/* Sidebar (desktop) */}
        {sidebarOpen && (
          <div
            className="admin-sidebar"
            style={{
              width: layout.sidebarWidth,
              minWidth: layout.sidebarWidth,
              background: colors.surface,
              borderInlineEnd: `1px solid ${colors.border}`,
              height: `calc(100vh - ${layout.topbarHeight}px)`,
              position: "sticky",
              top: layout.topbarHeight,
              flexDirection: "column",
              padding: "18px 12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 20px" }}>
              <div style={{ width: 32, height: 32, borderRadius: radius.md, background: colors.primary, color: colors.white, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <StoreIcon size={17} />
              </div>
              <span style={{ fontWeight: 800, fontSize: 15, color: colors.textPrimary }}>Saudagar Admin</span>
            </div>
            {visibleItems.map((item) => (
              <SidebarLink key={item.key} active={tab === item.key} icon={item.icon} label={item.label} onClick={() => setTab(item.key)} />
            ))}
          </div>
        )}

        {/* Main content */}
        <div className="admin-main" style={{ flex: 1, minWidth: 0, padding: 22 }}>
          {tab === "dashboard" && <DashboardScreen adminName={admin!.name} canApprove={canApprove} canUploadPrices={canUploadPrices} />}
          {tab !== "dashboard" && (
            <>
              {!canApprove && !canUploadPrices ? (
                <p style={{ padding: 16, color: colors.textFaint }}>
                  You don't have any admin permissions assigned yet. Ask the super admin to set can_approve_accounts or allowed_markets on your admin_users row.
                </p>
              ) : (
                <>
                  {tab === "requests" && canApprove && <AccountRequestsScreen />}
                  {tab === "payments" && canApprove && <ManualPaymentsScreen />}
                  {tab === "users" && canApprove && <UsersScreen />}
                  {tab === "prices" && canUploadPrices && <PriceUploadScreen />}
                  {tab === "admins" && isSuperAdmin && <AdminManagementScreen />}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bottom nav (mobile) */}
      <div
        className="admin-bottomnav"
        style={{
          position: "fixed",
          bottom: 0,
          insetInline: 0,
          background: colors.surface,
          borderTop: `1px solid ${colors.border}`,
          padding: "8px 4px",
          paddingBottom: "max(8px, env(safe-area-inset-bottom))",
          zIndex: 30,
        }}
      >
        {showMore && overflowMobileItems.length > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: "100%",
              insetInlineEnd: 8,
              marginBottom: 8,
              background: colors.surface,
              borderRadius: radius.md,
              boxShadow: shadow.raised,
              padding: 6,
              display: "grid",
              gap: 2,
              minWidth: 170,
            }}
          >
            {overflowMobileItems.map((item) => (
              <button
                key={item.key}
                onClick={() => { setTab(item.key); setShowMore(false); }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: radius.sm, border: "none", background: tab === item.key ? colors.primarySoft : "none", color: tab === item.key ? colors.primary : colors.textPrimary, fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "start" }}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: "flex" }}>
          {primaryMobileItems.map((item) => (
            <BottomNavButton key={item.key} active={tab === item.key} icon={item.icon} label={item.label} onClick={() => { setTab(item.key); setShowMore(false); }} />
          ))}
          {overflowMobileItems.length > 0 && (
            <BottomNavButton active={showMore} icon={<MoreIcon size={19} />} label="More" onClick={() => setShowMore((v) => !v)} />
          )}
        </div>
      </div>

      <div style={{ textAlign: "center", fontSize: 11, color: colors.textFaint, padding: "18px 0 22px" }}>© 2025 Saudagar. All rights reserved.</div>
    </div>
  );
}

function SidebarLink({ active, icon, label, onClick }: { active: boolean; icon: JSX.Element; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "10px 12px",
        borderRadius: radius.md,
        border: "none",
        background: active ? colors.primary : "transparent",
        color: active ? colors.white : colors.textSecondary,
        fontSize: 13.5,
        fontWeight: 600,
        cursor: "pointer",
        textAlign: "start",
        marginBottom: 2,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function BottomNavButton({ active, icon, label, onClick }: { active: boolean; icon: JSX.Element; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 0", background: "none", border: "none", color: active ? colors.primary : colors.textFaint, fontSize: 10.5, fontWeight: 600, cursor: "pointer" }}
    >
      {icon}
      {label}
    </button>
  );
}
