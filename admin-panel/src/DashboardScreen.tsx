import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { colors, radius } from "./theme";
import { Card, LoadingRows, StatCard } from "./ui";
import {
  ClipboardIcon,
  ClockIcon,
  CreditCardIcon,
  TrendingIcon,
  UserPlusIcon,
  UsersIcon,
} from "./icons";

interface Stats {
  pendingRequests: number;
  pendingPayments: number;
  totalUsers: number;
  pricesToday: number;
}

interface ActivityItem {
  id: string;
  kind: "request" | "payment" | "user" | "price";
  title: string;
  subtitle: string;
  created_at: string;
}

export default function DashboardScreen({
  adminName,
  canApprove,
  canUploadPrices,
}: {
  adminName: string;
  canApprove: boolean;
  canUploadPrices: boolean;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setError(null);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [requestsRes, paymentsRes, usersRes, pricesTodayRes] = await Promise.all([
        canApprove
          ? supabase.from("account_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
          : Promise.resolve({ count: 0, error: null } as any),
        canApprove
          ? supabase.from("manual_payment_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
          : Promise.resolve({ count: 0, error: null } as any),
        canApprove
          ? supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active")
          : Promise.resolve({ count: 0, error: null } as any),
        canUploadPrices
          ? supabase.from("prices").select("id", { count: "exact", head: true }).gte("created_at", todayStart.toISOString())
          : Promise.resolve({ count: 0, error: null } as any),
      ]);

      setStats({
        pendingRequests: requestsRes.count ?? 0,
        pendingPayments: paymentsRes.count ?? 0,
        totalUsers: usersRes.count ?? 0,
        pricesToday: pricesTodayRes.count ?? 0,
      });

      // Recent activity is derived from existing tables (there's no
      // dedicated activity_log table) — merge the latest few requests,
      // payments, and newly-active users into one feed, client-side.
      const items: ActivityItem[] = [];

      if (canApprove) {
        const { data: recentRequests } = await supabase
          .from("account_requests")
          .select("id, shop_name, status, created_at")
          .order("created_at", { ascending: false })
          .limit(5);
        for (const r of recentRequests ?? []) {
          items.push({
            id: `request-${r.id}`,
            kind: "request",
            title: r.status === "pending" ? "New account request" : `Account request ${r.status}`,
            subtitle: `Shop: ${r.shop_name}`,
            created_at: r.created_at,
          });
        }

        const { data: recentPayments } = await supabase
          .from("manual_payment_requests")
          .select("id, status, created_at, profiles(shop_name)")
          .order("created_at", { ascending: false })
          .limit(5);
        for (const p of (recentPayments ?? []) as any[]) {
          items.push({
            id: `payment-${p.id}`,
            kind: "payment",
            title: p.status === "pending" ? "Payment submitted" : `Payment ${p.status}`,
            subtitle: `Shop: ${p.profiles?.shop_name ?? "—"}`,
            created_at: p.created_at,
          });
        }

        const { data: recentUsers } = await supabase
          .from("profiles")
          .select("id, owner_name, created_at")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(5);
        for (const u of recentUsers ?? []) {
          items.push({
            id: `user-${u.id}`,
            kind: "user",
            title: "New user registered",
            subtitle: `User: ${u.owner_name}`,
            created_at: u.created_at,
          });
        }
      }

      items.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setActivity(items.slice(0, 6));
    } catch (err) {
      console.error("dashboard load failed:", err);
      setError("Couldn't load dashboard data.");
      setStats({ pendingRequests: 0, pendingPayments: 0, totalUsers: 0, pricesToday: 0 });
      setActivity([]);
    }
  }

  return (
    <div>
      <Card style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: radius.pill, background: colors.primarySoft, color: colors.primary, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <UsersIcon size={22} />
        </div>
        <div>
          <div style={{ fontSize: 13, color: colors.textSecondary }}>Welcome back,</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: colors.textPrimary }}>{adminName}</div>
        </div>
      </Card>

      {error && (
        <p style={{ color: colors.danger, fontSize: 13, background: colors.dangerSoft, padding: "10px 14px", borderRadius: radius.md }}>{error}</p>
      )}

      {stats === null ? (
        <LoadingRows count={4} />
      ) : (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          {canApprove && (
            <StatCard
              icon={<ClipboardIcon size={19} />}
              iconBg={colors.amberSoft}
              iconFg={colors.amber}
              label="Account Requests"
              value={stats.pendingRequests}
              sublabel="Pending"
              sublabelColor={colors.amber}
            />
          )}
          {canApprove && (
            <StatCard
              icon={<CreditCardIcon size={19} />}
              iconBg={colors.purpleSoft}
              iconFg={colors.purple}
              label="Manual Payments"
              value={stats.pendingPayments}
              sublabel="Pending"
              sublabelColor={colors.purple}
            />
          )}
          {canApprove && (
            <StatCard
              icon={<UsersIcon size={19} />}
              iconBg={colors.successSoft}
              iconFg={colors.success}
              label="Users"
              value={stats.totalUsers}
              sublabel="Total"
              sublabelColor={colors.success}
            />
          )}
          {canUploadPrices && (
            <StatCard
              icon={<TrendingIcon size={19} />}
              iconBg={colors.primarySoft}
              iconFg={colors.primary}
              label="Upload Prices"
              value={stats.pricesToday}
              sublabel="Today"
              sublabelColor={colors.primary}
            />
          )}
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 700, color: colors.textSecondary, marginBottom: 8 }}>Recent Activity</div>
      <Card style={{ padding: 4 }}>
        {activity === null && <div style={{ padding: 14 }}><LoadingRows count={3} /></div>}
        {activity !== null && activity.length === 0 && (
          <div style={{ padding: "24px 14px", textAlign: "center", color: colors.textFaint, fontSize: 13 }}>No recent activity.</div>
        )}
        {activity !== null &&
          activity.map((item, i) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 12px", borderTop: i === 0 ? "none" : `1px solid ${colors.border}` }}>
              <ActivityIcon kind={item.kind} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: colors.textPrimary }}>{item.title}</div>
                <div style={{ fontSize: 12, color: colors.textFaint }}>{item.subtitle}</div>
              </div>
              <div style={{ fontSize: 11.5, color: colors.textFaint, whiteSpace: "nowrap" }}>{timeAgo(item.created_at)}</div>
            </div>
          ))}
      </Card>
    </div>
  );
}

function ActivityIcon({ kind }: { kind: ActivityItem["kind"] }) {
  const map: Record<ActivityItem["kind"], { icon: JSX.Element; bg: string; fg: string }> = {
    request: { icon: <ClipboardIcon size={16} />, bg: colors.amberSoft, fg: colors.amber },
    payment: { icon: <CreditCardIcon size={16} />, bg: colors.purpleSoft, fg: colors.purple },
    user: { icon: <UserPlusIcon size={16} />, bg: colors.successSoft, fg: colors.success },
    price: { icon: <ClockIcon size={16} />, bg: colors.primarySoft, fg: colors.primary },
  };
  const { icon, bg, fg } = map[kind];
  return (
    <div style={{ width: 34, height: 34, borderRadius: radius.md, background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {icon}
    </div>
  );
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
