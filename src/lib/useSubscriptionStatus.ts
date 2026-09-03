import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export interface SubscriptionStatus {
  hasAccess: boolean; // true if active/trial and not expired — gates write access
  tier: "trial" | "monthly" | "six_month" | null;
  expiresAt: Date | null;
  daysUntilExpiry: number | null;
  loading: boolean;
}

const RENEWAL_WARNING_DAYS = 5; // banner starts showing 5 days before expiry, per decision

export function useSubscriptionStatus(profileId: string | undefined): SubscriptionStatus {
  const [state, setState] = useState<SubscriptionStatus>({
    hasAccess: false,
    tier: null,
    expiresAt: null,
    daysUntilExpiry: null,
    loading: true,
  });

  useEffect(() => {
    if (!profileId) return;

    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("profile_id", profileId)
        .eq("status", "active")
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setState({ hasAccess: false, tier: null, expiresAt: null, daysUntilExpiry: null, loading: false });
        return;
      }

      const expiresAt = new Date(data.expires_at);
      const msRemaining = expiresAt.getTime() - Date.now();
      const daysUntilExpiry = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));

      setState({
        hasAccess: msRemaining > 0,
        tier: data.tier,
        expiresAt,
        daysUntilExpiry,
        loading: false,
      });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  return state;
}

export function shouldShowRenewalBanner(status: SubscriptionStatus): boolean {
  return (
    status.hasAccess &&
    status.daysUntilExpiry !== null &&
    status.daysUntilExpiry <= RENEWAL_WARNING_DAYS &&
    status.daysUntilExpiry >= 0
  );
}
