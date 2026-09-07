import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export interface SubscriptionStatus {
  hasAccess: boolean; // true if active/trial and not expired — gates write access
  tier: "trial" | "monthly" | "six_month" | null;
  expiresAt: Date | null;
  daysUntilExpiry: number | null;
  loading: boolean;
}

const RENEWAL_WARNING_DAYS = 5; // banner starts showing 5 days before expiry, per decision
const POLL_INTERVAL_MS = 30_000;

// Refetches on mount, on window focus, and periodically while mounted —
// not just once. Without this, a payment confirmed by the webhook
// (which happens asynchronously, server-side, with no client push
// notification) would sit invisible until the user manually reloaded
// the page. This is the fix for the "have to refresh to see it
// activated" symptom.
export function useSubscriptionStatus(profileId: string | undefined): SubscriptionStatus {
  const [state, setState] = useState<SubscriptionStatus>({
    hasAccess: false,
    tier: null,
    expiresAt: null,
    daysUntilExpiry: null,
    loading: true,
  });

  const load = useCallback(async () => {
    if (!profileId) return;

    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("profile_id", profileId)
      .eq("status", "active")
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

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
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;

    load();

    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    const interval = setInterval(load, POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(interval);
    };
  }, [profileId, load]);

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
