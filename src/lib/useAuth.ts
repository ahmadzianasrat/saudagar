import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { readCachedSession } from "./authSession";

// If the device is online but the network call genuinely stalls
// (flaky connection, not fully offline), we still don't want to wait
// forever — bounded to a few seconds before falling back.
const GET_SESSION_TIMEOUT_MS = 4000;

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    // THE OFFLINE-LOADING-FOREVER FIX:
    // supabase.auth.getSession() can hang indefinitely when the app
    // is opened offline and the previously-stored token has expired —
    // internally it tries to refresh over the network, and that fetch
    // has no built-in timeout, so it just never resolves while there's
    // no connection. That left App.tsx stuck on the "loading" screen
    // forever with no way out.
    //
    // Fix: race getSession() against a short timeout. If we're
    // offline already, skip the wait entirely. Either way, if the
    // real call doesn't win in time, fall back to whatever session is
    // still sitting in localStorage from the last successful login —
    // good enough to let the offline-first app shell (and the
    // IndexedDB write queue) load and work, since a stale-but-present
    // token is far better than an infinite spinner. Once connectivity
    // returns, the normal auth listener + the 'online' handler below
    // reconcile with a real session.
    function resolveWithCachedFallback() {
      if (cancelledRef.current) return;
      setSession(readCachedSession());
      setLoading(false);
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      resolveWithCachedFallback();
    } else {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) resolveWithCachedFallback();
      }, GET_SESSION_TIMEOUT_MS);

      supabase.auth.getSession().then(({ data }) => {
        settled = true;
        clearTimeout(timer);
        if (cancelledRef.current) return;
        setSession(data.session);
        setLoading(false);
      });
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!cancelledRef.current) setSession(newSession);
    });

    // Once the connection comes back, re-check for a real session in
    // case we started out on the cached fallback above (e.g. the
    // cached token had actually expired and needs a genuine refresh).
    function handleOnline() {
      supabase.auth.getSession().then(({ data }) => {
        if (!cancelledRef.current) setSession(data.session);
      });
    }
    window.addEventListener("online", handleOnline);

    return () => {
      cancelledRef.current = true;
      listener.subscription.unsubscribe();
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return { session, isAuthenticated: !!session, loading };
}
