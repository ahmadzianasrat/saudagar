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
}

let dbPromise: Promise<IDBPDatabase<SaudagarDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<SaudagarDB>("saudagar-offline", 1, {
      upgrade(db) {
        const store = db.createObjectStore("writeQueue", { keyPath: "id" });
        store.createIndex("by-synced", "syncedFlag");
      },
    });
  }
  return dbPromise;
}

// Call this whenever the user performs a ledger or inventory action.
// It writes locally immediately (so the UI can update instantly and
// offline), then attempts to sync immediately — AWAITED, not
// fire-and-forget. Previously this was `void flushQueue()`, which
// meant the caller had no way to know when the sync attempt actually
// finished, so the UI's "pending" indicator never updated to "synced"
// until a full page reload re-checked every item from scratch. This
// is the fix for "only synced after a refresh" — callers can now
// await enqueueWrite and immediately re-check getSyncStatus for the
// entry they just wrote.
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

  await flushQueue();
}

// Attempts to push every unsynced item to Supabase. Safe to call
// repeatedly/concurrently — items already synced are skipped, and
// the server-side unique(profile_id, client_id) / unique(inventory_item_id,
// client_id) constraints make retried pushes idempotent.
export async function flushQueue(): Promise<void> {
  if (!navigator.onLine) return;

  const db = await getDB();
  const all = await db.getAll("writeQueue");
  const pending = all.filter((item) => !item.synced);

  for (const item of pending) {
    try {
      const { error } = await supabase.from(item.table).upsert(item.payload, {
        onConflict: item.table === "ledger_entries" ? "profile_id,client_id" : "inventory_item_id,client_id",
      });

      if (error) {
        item.lastError = error.message;
        await db.put("writeQueue", item);
        continue; // leave as pending, will retry on next flush
      }

      item.synced = true;
      item.lastError = undefined;
      await db.put("writeQueue", item);
    } catch (err) {
      // Network error mid-flight — leave pending, next trigger will retry.
      item.lastError = err instanceof Error ? err.message : String(err);
      await db.put("writeQueue", item);
    }
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
