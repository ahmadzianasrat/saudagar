import { useEffect, useState, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { enqueueWrite, getSyncStatus } from "../../lib/offlineQueue";
import { generateClientId } from "../../lib/uuid";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTranslation } from "../../i18n/useTranslation";
import { dateGroupLabel, formatDateTime, timeAgo } from "../../lib/dateFormat";
import Pagination from "../../components/Pagination";

const PAGE_SIZE = 10;

interface ContactProfile {
  name: string;
  phone_number: string; // mobile number
  whatsapp_number: string | null;
  address: string | null;
}

interface LedgerEntry {
  id: string;
  client_id: string;
  entry_type: "credit" | "debit";
  amount: number;
  note: string | null;
  entry_date: string;
  syncStatus?: "pending" | "synced" | "not_found";
}

export default function CounterpartyLedgerDetail() {
  const { counterpartyId } = useParams<{ counterpartyId: string }>();
  const navigate = useNavigate();
  const { formatNumber, dateSystem, digitStyle } = useLanguage();
  const { tr } = useTranslation();

  const [profileId, setProfileId] = useState<string | null>(null);
  const [contact, setContact] = useState<ContactProfile | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [entryType, setEntryType] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Contact editing
  const [editingContact, setEditingContact] = useState(false);
  const [editName, setEditName] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editAddress, setEditAddress] = useState("");

  // Entry editing
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editEntryType, setEditEntryType] = useState<"credit" | "debit">("credit");
  const [editEntryAmount, setEditEntryAmount] = useState("");
  const [editEntryNote, setEditEntryNote] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setProfileId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (profileId && counterpartyId) {
      loadContact();
      loadEntries();
    }
  }, [profileId, counterpartyId]);

  async function loadContact() {
    const { data } = await supabase
      .from("counterparties")
      .select("name, phone_number, whatsapp_number, address")
      .eq("id", counterpartyId)
      .single();
    if (data) {
      setContact(data);
      setEditName(data.name);
      setEditMobile(data.phone_number);
      setEditWhatsapp(data.whatsapp_number ?? "");
      setEditAddress(data.address ?? "");
    }
  }

  async function loadEntries() {
    const { data, error: loadErr } = await supabase
      .from("ledger_entries")
      .select("id, client_id, entry_type, amount, note, entry_date")
      .eq("profile_id", profileId)
      .eq("counterparty_id", counterpartyId)
      .order("entry_date", { ascending: false });

    if (loadErr) {
      console.error("failed to load entries:", loadErr);
      setError("Couldn't load entries.");
      return;
    }

    const withStatus = await Promise.all(
      (data ?? []).map(async (row) => ({ ...row, syncStatus: await getSyncStatus(row.client_id) }))
    );
    setEntries(withStatus);
  }

  const balance = entries.reduce((sum, e) => sum + (e.entry_type === "credit" ? e.amount : -e.amount), 0);
  const given = entries.filter((e) => e.entry_type === "credit").reduce((s, e) => s + e.amount, 0);
  const received = entries.filter((e) => e.entry_type === "debit").reduce((s, e) => s + e.amount, 0);

  async function handleAddEntry(e: FormEvent) {
    e.preventDefault();
    if (!profileId || !counterpartyId || !amount) return;

    const clientId = generateClientId();
    await enqueueWrite("ledger_entries", clientId, {
      client_id: clientId,
      profile_id: profileId,
      counterparty_id: counterpartyId,
      entry_type: entryType,
      amount: Number(amount),
      note: note || null,
      entry_date: new Date().toISOString(),
    });

    // enqueueWrite now awaits the actual sync attempt (see
    // offlineQueue.ts) — re-check status immediately instead of
    // hardcoding "pending", so the indicator is correct without
    // needing a page reload.
    const syncStatus = await getSyncStatus(clientId);

    setEntries((prev) => [
      {
        id: clientId,
        client_id: clientId,
        entry_type: entryType,
        amount: Number(amount),
        note,
        entry_date: new Date().toISOString(),
        syncStatus,
      },
      ...prev,
    ]);

    setAmount("");
    setNote("");
    setShowNewEntry(false);
    setPage(1);
  }

  async function handleSaveContact(e: FormEvent) {
    e.preventDefault();
    if (!counterpartyId) return;

    const { error: updateErr } = await supabase
      .from("counterparties")
      .update({
        name: editName,
        phone_number: editMobile,
        whatsapp_number: editWhatsapp || null,
        address: editAddress || null,
      })
      .eq("id", counterpartyId);

    if (updateErr) {
      console.error("failed to update contact:", updateErr);
      setError("Couldn't save contact changes.");
      return;
    }

    setContact({ name: editName, phone_number: editMobile, whatsapp_number: editWhatsapp || null, address: editAddress || null });
    setEditingContact(false);
  }

  function startEditEntry(entry: LedgerEntry) {
    setEditingEntryId(entry.client_id);
    setEditEntryType(entry.entry_type);
    setEditEntryAmount(String(entry.amount));
    setEditEntryNote(entry.note ?? "");
  }

  async function handleSaveEntry(entry: LedgerEntry) {
    // Edits go straight to Supabase (not through the offline queue) —
    // correcting an existing entry is a less time-critical action than
    // recording a new one, and this keeps the offline-write path
    // simple (insert-only, no update-merge logic to get right).
    const { error: updateErr } = await supabase
      .from("ledger_entries")
      .update({
        entry_type: editEntryType,
        amount: Number(editEntryAmount),
        note: editEntryNote || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entry.id);

    if (updateErr) {
      console.error("failed to update entry:", updateErr);
      setError("Couldn't save changes — check your connection and try again.");
      return;
    }

    setEntries((prev) =>
      prev.map((e) =>
        e.client_id === entry.client_id
          ? { ...e, entry_type: editEntryType, amount: Number(editEntryAmount), note: editEntryNote }
          : e
      )
    );
    setEditingEntryId(null);
  }

  const pagedEntries = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  let lastGroupLabel: string | null = null;

  return (
    <div style={{ padding: 16 }}>
      <button onClick={() => navigate("/ledger")} style={{ marginBottom: 12 }}>
        ← {tr("nav.ledger")}
      </button>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {contact && !editingContact && (
        <div style={{ background: "#f7f7f5", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
            <h2 style={{ margin: 0 }}>{contact.name}</h2>
            <button onClick={() => setEditingContact(true)} style={{ fontSize: 12 }}>{tr("common.edit")}</button>
          </div>
          <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>{tr("ledger.profileInfo")}</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>{tr("ledger.mobileNumber")}: {contact.phone_number}</div>
          {contact.whatsapp_number && (
            <div style={{ fontSize: 13, color: "#25D366" }}>{tr("ledger.whatsappNumber")}: {contact.whatsapp_number}</div>
          )}
          {contact.address && <div style={{ fontSize: 13 }}>{tr("ledger.address")}: {contact.address}</div>}
        </div>
      )}

      {editingContact && (
        <form onSubmit={handleSaveContact} style={{ display: "grid", gap: 8, background: "#f7f7f5", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <input placeholder={tr("ledger.name")} value={editName} onChange={(e) => setEditName(e.target.value)} />
          <input placeholder={tr("ledger.mobileNumber")} value={editMobile} onChange={(e) => setEditMobile(e.target.value)} />
          <input placeholder={tr("ledger.whatsappNumber")} value={editWhatsapp} onChange={(e) => setEditWhatsapp(e.target.value)} />
          <input placeholder={tr("ledger.address")} value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit">{tr("common.save")}</button>
            <button type="button" onClick={() => setEditingContact(false)}>{tr("common.cancel")}</button>
          </div>
        </form>
      )}

      <div style={{ fontSize: 28, fontWeight: 500 }}>{formatNumber(Math.abs(balance))} AFN</div>

      <div style={{ display: "flex", gap: 10, margin: "12px 0" }}>
        <div style={{ flex: 1, background: "#e8f5e9", padding: 10, borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "#2e7d32" }}>{tr("ledger.given")}</div>
          <div style={{ fontWeight: 500 }}>{formatNumber(given)}</div>
        </div>
        <div style={{ flex: 1, background: "#fdecea", padding: 10, borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "#b3261e" }}>{tr("ledger.received")}</div>
          <div style={{ fontWeight: 500 }}>{formatNumber(received)}</div>
        </div>
      </div>

      <button onClick={() => setShowNewEntry((v) => !v)} style={{ width: "100%", padding: 10 }}>
        {tr("ledger.newEntry")}
      </button>

      {showNewEntry && (
        <form onSubmit={handleAddEntry} style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <div>
            <label><input type="radio" checked={entryType === "credit"} onChange={() => setEntryType("credit")} /> {tr("ledger.givenRadio")}</label>
            <label style={{ marginLeft: 12 }}><input type="radio" checked={entryType === "debit"} onChange={() => setEntryType("debit")} /> {tr("ledger.receivedRadio")}</label>
          </div>
          <input placeholder={tr("ledger.amount")} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input placeholder={tr("ledger.note")} value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="submit">{tr("ledger.save")}</button>
        </form>
      )}

      <div style={{ marginTop: 16 }}>
        {pagedEntries.map((entry) => {
          const groupLabel = dateGroupLabel(entry.entry_date, dateSystem, digitStyle, tr);
          const showHeader = groupLabel !== lastGroupLabel;
          lastGroupLabel = groupLabel;
          const isEditing = editingEntryId === entry.client_id;

          return (
            <div key={entry.client_id}>
              {showHeader && (
                <div style={{ fontSize: 12, color: "#1e6f5c", fontWeight: 500, marginTop: 10, marginBottom: 2 }}>
                  {groupLabel}
                </div>
              )}

              {!isEditing && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #eee" }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#999" }}>
                      {formatDateTime(entry.entry_date, dateSystem, digitStyle)} · {timeAgo(entry.entry_date, tr)}
                    </div>
                    {entry.note && <div style={{ fontSize: 12 }}>{entry.note}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: entry.entry_type === "credit" ? "#2e7d32" : "#b3261e" }}>
                      {entry.entry_type === "credit" ? "+" : "-"}{formatNumber(entry.amount)}
                    </div>
                    <div style={{ fontSize: 10, color: entry.syncStatus === "synced" ? "#2e7d32" : "#999" }}>
                      {entry.syncStatus === "synced" ? tr("ledger.synced") : tr("ledger.pending")}
                    </div>
                    <button onClick={() => startEditEntry(entry)} style={{ fontSize: 11, marginTop: 4 }}>{tr("common.edit")}</button>
                  </div>
                </div>
              )}

              {isEditing && (
                <div style={{ display: "grid", gap: 6, padding: "8px 0", borderBottom: "1px solid #eee" }}>
                  <div>
                    <label><input type="radio" checked={editEntryType === "credit"} onChange={() => setEditEntryType("credit")} /> {tr("ledger.givenRadio")}</label>
                    <label style={{ marginLeft: 12 }}><input type="radio" checked={editEntryType === "debit"} onChange={() => setEditEntryType("debit")} /> {tr("ledger.receivedRadio")}</label>
                  </div>
                  <input type="number" value={editEntryAmount} onChange={(e) => setEditEntryAmount(e.target.value)} />
                  <input value={editEntryNote} onChange={(e) => setEditEntryNote(e.target.value)} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => handleSaveEntry(entry)}>{tr("common.save")}</button>
                    <button onClick={() => setEditingEntryId(null)}>{tr("common.cancel")}</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <Pagination page={page} totalItems={entries.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  );
}
