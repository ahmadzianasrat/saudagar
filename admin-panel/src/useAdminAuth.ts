import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export interface AdminProfile {
  id: string;
  name: string;
  role: "super_admin" | "staff";
  can_approve_accounts: boolean;
  allowed_markets: string[];
}

export function useAdminAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notAnAdmin, setNotAnAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadAdminProfile(data.session.user.id);
      else setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) loadAdminProfile(newSession.user.id);
      else {
        setAdmin(null);
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // A logged-in Supabase user is not automatically an admin — this
  // checks for a matching admin_users row, since that's what the
  // permission checks (can_approve_accounts, allowed_markets) and the
  // Edge Functions actually rely on. A regular shop-owner account
  // logging in here (unlikely, different app/URL, but not impossible)
  // should NOT get through to the admin screens.
  async function loadAdminProfile(userId: string) {
    const { data, error } = await supabase
      .from("admin_users")
      .select("id, name, role, can_approve_accounts, allowed_markets")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) {
      setAdmin(null);
      setNotAnAdmin(true);
    } else {
      setAdmin(data);
      setNotAnAdmin(false);
    }
    setLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return {
    session,
    admin,
    isAuthenticated: !!session,
    isAuthorizedAdmin: !!admin,
    notAnAdmin,
    loading,
    signOut,
  };
}
