import type { Session } from "@supabase/supabase-js";
import { supabase, SUPABASE_URL } from "./supabaseClient";
import { cachedQuery } from "./offlineQueue";

// ============================================================
// Offline-safe session/user access.
// ------------------------------------------------------------
// supabase.auth.getUser() ALWAYS makes a network round-trip to
// revalidate the token server-side — that's the right call for a
// security-sensitive action (changing a password, re-authenticating
// before deleting ledger entries), but every screen that reached for
// it purely to read "whose data do I load?" was accidentally making
// its entire initial data fetch depend on connectivity, even though
// the actual list/table query that followed would otherwise have
// worked fine offline. That's the root cause of screens showing only
// empty/placeholder state offline even after the app itself finishes
// loading: profileId never got set, so every query gated on it never
// even ran.
//
// getSession() only reads (and opportunistically refreshes) the
// locally persisted token — no forced round-trip — so it's the right
// primitive for "who's logged in" on a read path. See useAuth.ts for
// why a raw getSession() call still isn't quite enough on its own
// (it can hang offline against an expired token) — the same
// timeout + cached-session fallback used there is reused here.
// ============================================================

const GET_SESSION_TIMEOUT_MS = 4000;

function localStorageSessionKey(): string {
  try {
    const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
    return `sb-${ref}-auth-token`;
  } catch {
    return "";
  }
}

export function readCachedSession(): Session | null {
  try {
    const key = localStorageSessionKey();
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const session = (parsed?.currentSession ?? parsed) as Session | null;
    return session?.access_token ? session : null;
  } catch {
    return null;
  }
}

/**
 * Resolves to the current session, same as `supabase.auth.getSession()`,
 * but never hangs offline and never forces a network round-trip: skips
 * straight to a cached-from-localStorage session when already offline,
 * and falls back to it if the real call doesn't return within a few
 * seconds (a stalled connection, not full offline).
 */
export async function getOfflineSafeSession(): Promise<Session | null> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return readCachedSession();
  }
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) resolve(readCachedSession());
    }, GET_SESSION_TIMEOUT_MS);
    supabase.auth.getSession().then(({ data }) => {
      settled = true;
      clearTimeout(timer);
      resolve(data.session);
    });
  });
}

/** Convenience wrapper — the id most screens actually need. */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getOfflineSafeSession();
  return session?.user.id ?? null;
}

// ============================================================
// Shop context — resolves "whose data should this login see" for
// BOTH an owner and a secretary (see migrations/020_shop_secretaries.sql).
// ------------------------------------------------------------
// An owner's own auth id IS the shop's profile_id everywhere in the
// schema, so historically every screen just used getCurrentUserId()
// directly as `profileId`. A secretary's auth id is different from
// the shop's profile_id — this resolves which one to actually use,
// so the rest of the app can keep working with a single `profileId`
// concept unchanged, while gaining role information for screens that
// need to hide/disable owner-only actions (RLS is what actually
// enforces the restriction — see the migration — this is only for
// the UI to not show a button that would just fail).
// ============================================================
export type ShopRole = "owner" | "secretary" | null;

export interface ShopContext {
  shopProfileId: string | null;
  role: ShopRole;
  secretaryName: string | null;
}

const NO_SHOP_CONTEXT: ShopContext = { shopProfileId: null, role: null, secretaryName: null };

export async function getShopContext(): Promise<ShopContext> {
  const userId = await getCurrentUserId();
  if (!userId) return NO_SHOP_CONTEXT;

  // Cheap, single-row lookup — most logins are owners, so this
  // resolves in one query for the common case.
  const { data: ownerRow } = await cachedQuery<{ id: string }>(`shop:owner-check:${userId}`, () =>
    supabase.from("profiles").select("id").eq("id", userId).maybeSingle()
  );
  if (ownerRow) {
    return { shopProfileId: ownerRow.id, role: "owner", secretaryName: null };
  }

  const { data: secRow } = await cachedQuery<{ owner_profile_id: string; name: string; status: string }>(
    `shop:secretary-check:${userId}`,
    () =>
      supabase
        .from("shop_secretaries")
        .select("owner_profile_id, name, status")
        .eq("secretary_user_id", userId)
        .maybeSingle()
  );
  if (secRow && secRow.status === "active") {
    return { shopProfileId: secRow.owner_profile_id, role: "secretary", secretaryName: secRow.name };
  }

  return NO_SHOP_CONTEXT;
}
