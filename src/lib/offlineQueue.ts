// ============================================================
// Offline-first write queue.
// ------------------------------------------------------------
// Design (per earlier decisions):
//   - Every ledger/inventory write is saved to IndexedDB FIRST,
//     with a client-generated id, before attempting a network call.
//     The UI reads from IndexedDB, so the app works fully offline.
//   - Sync is attempted eagerly: on every write, on reconnect
//     (via the browser's online event), and optionally on an
//     interval — NOT just when the user happens to open the app.
//   - Each queued item exposes a `synced` boolean so the UI can
//     render the per-entry synced/pending indicator discussed
//     earlier — this is a trust feature, not just a technical one.
//   - Conflict resolution: last-write-wins, compared by updated_at,
//     enforced server-side; the client doesn't need conflict logic
//     beyond retrying failed pushes.
//
// This is a skeleton: the table-specific push functions (pushLedgerEntry,
// pushInventoryTransaction) need to be filled in once the ledger/inventory
// features are built, but the queue mechanics below are complete and
// reusable across both.
// ============================================================

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { supabase } from "./supabaseClient";

interface QueueItem {
  id: string; // client-generated uuid, matches the `client_id` column server-side
  table: "ledger_entries" | "inventory_transactions";
  payload: Record<string, unknown>;
  createdAt: number;
  synced: boolean;
  lastError?: string;
}

interface SaudagarDB extends DBSchema {
  writeQueue: {
    key: string;
    value: QueueItem;
    indexes: { "by-synced": number }; // 0 = pending, 1 = synced, for quick filtering
  };
  readCache: {
    key: string;
    value: { key: string; data: unknown; updatedAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<SaudagarDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<SaudagarDB>("saudagar-offline", 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore("writeQueue", { keyPath: "id" });
          store.createIndex("by-synced", "syncedFlag");
        }
        if (oldVersion < 2) {
          db.createObjectStore("readCache", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

// ============================================================
// Read-through cache for GET queries.
// ------------------------------------------------------------
// The write queue above is only half of "works offline" — it covers
// writes, but every screen's initial data load was a plain Supabase
// query with no fallback, so opening the app offline (even after the
// auth/loading-screen fix) showed only empty-state placeholders: the
// query fails, the error handler sets the list to [], and that looks
// identical to "you have no data" even though the real data is just
// unreachable right now.
//
// cachedQuery() wraps a query: on success it remembers the result
// (keyed by table + whatever scopes it, e.g. the profile id) for next
// time; on failure it serves the last-remembered result instead of an
// error, so the screen shows the data as of the last successful sync
// rather than a false "empty." `fromCache` tells the caller whether
// what it got back might be stale, in case it wants to show that.
// ============================================================
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const db = await getDB();
    const row = await db.get("readCache", key);
    return (row?.data as T) ?? null;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, data: T): Promise<void> {
  try {
    const db = await getDB();
    await db.put("readCache", { key, data, updatedAt: Date.now() });
  } catch {
    // best-effort — a failed cache write shouldn't break the screen
  }
}

// Supabase's query client (postgrest-js) uses the browser's fetch()
// with no built-in timeout — same underlying issue as the
// getSession()-hangs-offline bug fixed in useAuth.ts/authSession.ts,
// just for table queries instead of auth. Without a bound, a query
// made while offline can sit unresolved far longer than any user
// would wait, which is what made screens look stuck on their loading
// skeletons offline even with a populated cache sitting right there
// ready to serve. Skip the network attempt entirely when already
// offline, and otherwise give it a few seconds before falling back.
const QUERY_TIMEOUT_MS = 4000;
const TIMEOUT_ERROR = { message: "cachedQuery: timed out" };

export async function cachedQuery<T>(
  key: string,
  run: () => PromiseLike<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any; fromCache: boolean }> {
  let result: { data: T | null; error: any };

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    result = { data: null, error: TIMEOUT_ERROR };
  } else {
    try {
      const queryPromise = Promise.resolve(run()).catch((err) => ({ data: null, error: err }));
      result = await Promise.race([
        queryPromise,
        new Promise<{ data: null; error: any }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: TIMEOUT_ERROR }), QUERY_TIMEOUT_MS)
        ),
      ]);
    } catch (err) {
      result = { data: null, error: err };
    }
  }

  const { data, error } = result;
  if (!error) {
    if (data !== null) await cacheSet(key, data);
    return { data, error: null, fromCache: false };
  }
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return { data: cached, error: null, fromCache: true };
  }
  return { data: null, error, fromCache: false };
}

// Call this whenever the user performs a ledger or inventory action.
// Writes locally to IndexedDB FIRST and resolves as soon as that
// local write lands — the caller (and its optimistic UI update) is
// never blocked on the network. A sync attempt is still kicked off
// immediately (fire-and-forget), and getSyncStatus()/SAUDAGAR_SYNCED_EVENT
// (see flushQueue below) are how a caller finds out once it actually
// lands, without needing to await it here.
//
// This was briefly `await flushQueue()` — awaiting the sync attempt
// so the caller could re-check getSyncStatus() and show "Synced"
// immediately when actually online, without a page reload. But
// flushQueue()'s network call had no timeout (postgrest-js's fetch()
// has none built in, same underlying issue as every other
// hangs-offline bug in this app), and awaiting it here meant that
// hang blocked the optimistic UI update that comes after this call in
// every caller — so on a flaky/fake-connected network (navigator.onLine
// still true, e.g. Wi-Fi with no real internet) the Save button
// looked completely unresponsive, and repeated taps queued repeated
// duplicate entries that only appeared once a real connection let one
// of the piled-up flush attempts finally resolve. SAUDAGAR_SYNCED_EVENT
// now covers the original "update without a reload" goal without
// blocking anything.
export async function enqueueWrite(
  table: QueueItem["table"],
  clientId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const db = await getDB();
  await db.put("writeQueue", {
    id: clientId,
    table,
    payload,
    createdAt: Date.now(),
    synced: false,
  });

  void flushQueue();
}

export const SAUDAGAR_SYNCED_EVENT = "saudagar:synced";

// How long a single item's sync attempt gets before flushQueue moves
// on and leaves it pending for the next trigger (online event / the
// interval below / the next write) to retry. Keeps one stuck item
// from holding up the rest of the queue, or the calling await in the
// (rare, deliberate) places that still await flushQueue() directly.
const FLUSH_ITEM_TIMEOUT_MS = 8000;

// Attempts to push every unsynced item to Supabase. Safe to call
// repeatedly/concurrently — items already synced are skipped, and
// the server-side unique(profile_id, client_id) / unique(inventory_item_id,
// client_id) constraints make retried pushes idempotent.
export async function flushQueue(): Promise<void> {
  if (!navigator.onLine) return;

  const db = await getDB();
  const all = await db.getAll("writeQueue");
  const pending = all.filter((item) => !item.synced);

  let anySynced = false;

  for (const item of pending) {
    try {
      const upsertPromise = supabase
        .from(item.table)
        .upsert(item.payload, {
          onConflict: item.table === "ledger_entries" ? "profile_id,client_id" : "inventory_item_id,client_id",
        })
        .then(
          (res) => res,
          (err) => ({ error: err })
        );
      const { error } = await Promise.race([
        upsertPromise,
        new Promise<{ error: any }>((resolve) =>
          setTimeout(() => resolve({ error: { message: "flushQueue: timed out" } }), FLUSH_ITEM_TIMEOUT_MS)
        ),
      ]);

      if (error) {
        item.lastError = error.message;
        await db.put("writeQueue", item);
        continue; // leave as pending, will retry on next flush
      }

      item.synced = true;
      item.lastError = undefined;
      await db.put("writeQueue", item);
      anySynced = true;
    } catch (err) {
      // Shouldn't happen (errors are caught above into `error`), but
      // leave pending and move on rather than let the whole loop die.
      item.lastError = err instanceof Error ? err.message : String(err);
      await db.put("writeQueue", item);
    }
  }

  // Lets screens refresh their server-computed data (item quantity/
  // avg_cost, ledger totals — anything a DB trigger recalculates)
  // once a queued write actually lands, rather than only ever
  // showing the client-side optimistic guess until the next manual
  // reload. See SAUDAGAR_SYNCED_EVENT usage in the feature screens.
  if (anySynced && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SAUDAGAR_SYNCED_EVENT));
  }
}

// Returns the current sync status for a given client-generated id,
// for rendering the per-entry pending/synced indicator in the UI.
export async function getSyncStatus(clientId: string): Promise<"pending" | "synced" | "not_found"> {
  const db = await getDB();
  const item = await db.get("writeQueue", clientId);
  if (!item) return "not_found";
  return item.synced ? "synced" : "pending";
}

// Wire this up once, e.g. in App.tsx, so reconnecting the device
// immediately attempts to flush anything queued while offline —
// this is the "sync eagerly" behavior, not waiting for the user to
// reopen a screen or the app to restart.
export function initSyncListeners(): void {
  window.addEventListener("online", () => void flushQueue());
  // Belt-and-suspenders: also retry periodically in case the browser's
  // online/offline events are unreliable on the device (common on
  // some Android WebViews).
  setInterval(() => void flushQueue(), 30_000);
}
