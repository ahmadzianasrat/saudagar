import { useEffect, useState, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { enqueueWrite, getSyncStatus } from "../../lib/offlineQueue";
import { generateClientId } from "../../lib/uuid";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTranslation } from "../../i18n/useTranslation";
import { dateGroupLabel, formatDateTime, timeAgo } from "../../lib/dateFormat";
import Pagination from "../../components/Pagination";
import { colors, inputStyle, primaryButtonStyle, radius, secondaryButtonStyle } from "../../theme";
import { Avatar, Card, DateGroupHeader, DirectionToggle, EmptyState, PageHeader, SyncDot } from "../../components/ui";
import { ArrowDownCircleIcon, ArrowUpCircleIcon, PencilIcon, PlusIcon } from "../../components/icons";

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
    <div style={{ padding: 16, paddingBottom: 28 }}>
      <PageHeader title={contact?.name ?? "…"} onBack={() => navigate("/ledger")} />

      {error && (
        <p style={{ color: colors.danger, fontSize: 13, background: colors.dangerSoft, padding: "8px 10px", borderRadius: radius.sm }}>
          {error}
        </p>
      )}

      {contact && !editingContact && (
        <Card style={{ marginBottom: 12, display: "flex", gap: 12, alignItems: "center" }}>
          <Avatar label={contact.name} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: colors.textSecondary }}>{tr("ledger.mobileNumber")}: {contact.phone_number}</div>
            {contact.whatsapp_number && (
              <div style={{ fontSize: 12.5, color: "#25D366", marginTop: 2 }}>WhatsApp: {contact.whatsapp_number}</div>
            )}
            {contact.address && <div style={{ fontSize: 12.5, color: colors.textFaint, marginTop: 2 }}>{contact.address}</div>}
          </div>
          <button
            onClick={() => setEditingContact(true)}
            style={{ width: 32, height: 32, borderRadius: radius.pill, border: "none", background: colors.primarySoft, color: colors.primary, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
          >
            <PencilIcon size={14} />
          </button>
        </Card>
      )}

      {editingContact && (
        <Card style={{ marginBottom: 12 }}>
          <form onSubmit={handleSaveContact} style={{ display: "grid", gap: 10 }}>
            <input placeholder={tr("ledger.name")} value={editName} onChange={(e) => setEditName(e.target.value)} style={inputStyle} />
            <input placeholder={tr("ledger.mobileNumber")} value={editMobile} onChange={(e) => setEditMobile(e.target.value)} style={inputStyle} />
            <input placeholder={tr("ledger.whatsappNumber")} value={editWhatsapp} onChange={(e) => setEditWhatsapp(e.target.value)} style={inputStyle} />
            <input placeholder={tr("ledger.address")} value={editAddress} onChange={(e) => setEditAddress(e.target.value)} style={inputStyle} />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" style={{ ...primaryButtonStyle, flex: 1 }}>{tr("common.save")}</button>
              <button type="button" onClick={() => setEditingContact(false)} style={{ ...secondaryButtonStyle, flex: 1 }}>{tr("common.cancel")}</button>
            </div>
          </form>
        </Card>
      )}

      <div style={{ textAlign: "center", margin: "18px 0 4px" }}>
        <div style={{ fontSize: 12, color: colors.textSecondary }}>{tr("ledger.totalBalance")}</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: balance >= 0 ? colors.success : colors.danger }}>
          {formatNumber(Math.abs(balance))} <span style={{ fontSize: 14, color: colors.textSecondary, fontWeight: 600 }}>AFN</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, margin: "14px 0" }}>
        <div style={{ flex: 1, background: colors.successSoft, padding: "10px 12px", borderRadius: radius.md, display: "flex", alignItems: "center", gap: 8 }}>
          <ArrowDownCircleIcon size={20} color={colors.success} />
          <div>
            <div style={{ fontSize: 11, color: colors.success, fontWeight: 600 }}>{tr("ledger.given")}</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: colors.textPrimary }}>{formatNumber(given)}</div>
          </div>
        </div>
        <div style={{ flex: 1, background: colors.dangerSoft, padding: "10px 12px", borderRadius: radius.md, display: "flex", alignItems: "center", gap: 8 }}>
          <ArrowUpCircleIcon size={20} color={colors.danger} />
          <div>
            <div style={{ fontSize: 11, color: colors.danger, fontWeight: 600 }}>{tr("ledger.received")}</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: colors.textPrimary }}>{formatNumber(received)}</div>
          </div>
        </div>
      </div>

      <button onClick={() => setShowNewEntry((v) => !v)} style={{ ...primaryButtonStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <PlusIcon size={17} />
        {tr("ledger.newEntry")}
      </button>

      {showNewEntry && (
        <Card style={{ marginTop: 12 }}>
          <form onSubmit={handleAddEntry} style={{ display: "grid", gap: 10 }}>
            <DirectionToggle
              value={entryType === "credit"}
              onChange={(v) => setEntryType(v ? "credit" : "debit")}
              positiveLabel={tr("ledger.givenRadio")}
              negativeLabel={tr("ledger.receivedRadio")}
              positiveIcon={<ArrowDownCircleIcon size={16} />}
              negativeIcon={<ArrowUpCircleIcon size={16} />}
            />
            <input placeholder={tr("ledger.amount")} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} />
            <input placeholder={tr("ledger.note")} value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} />
            <button type="submit" style={primaryButtonStyle}>{tr("ledger.save")}</button>
          </form>
        </Card>
      )}

      <div style={{ marginTop: 20 }}>
        {entries.length === 0 && <EmptyState>{tr("ledger.noEntries")}</EmptyState>}
        {entries.length > 0 && (
          <Card style={{ padding: 4 }}>
            {pagedEntries.map((entry, i) => {
              const groupLabel = dateGroupLabel(entry.entry_date, dateSystem, digitStyle, tr);
              const showHeader = groupLabel !== lastGroupLabel;
              lastGroupLabel = groupLabel;
              const isEditing = editingEntryId === entry.client_id;
              const isCredit = entry.entry_type === "credit";

              return (
                <div key={entry.client_id}>
                  {showHeader && <div style={{ padding: "6px 10px 0" }}><DateGroupHeader>{groupLabel}</DateGroupHeader></div>}

                  {!isEditing && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px", borderTop: showHeader || i === 0 ? "none" : `1px solid ${colors.border}` }}>
                      {isCredit ? <ArrowDownCircleIcon size={28} color={colors.success} /> : <ArrowUpCircleIcon size={28} color={colors.danger} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: colors.textFaint }}>
                          {formatDateTime(entry.entry_date, dateSystem, digitStyle)} · {timeAgo(entry.entry_date, tr)}
                        </div>
                        {entry.note && <div style={{ fontSize: 13, color: colors.textPrimary, marginTop: 1 }}>{entry.note}</div>}
                      </div>
                      <div style={{ textAlign: "end" }}>
                        <div style={{ color: isCredit ? colors.success : colors.danger, fontWeight: 700, fontSize: 14 }}>
                          {isCredit ? "+" : "-"}{formatNumber(entry.amount)}
                        </div>
                        <div style={{ fontSize: 10.5, color: colors.textFaint, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                          <SyncDot synced={entry.syncStatus === "synced"} />
                          {entry.syncStatus === "synced" ? tr("ledger.synced") : tr("ledger.pending")}
                        </div>
                      </div>
                      <button
                        onClick={() => startEditEntry(entry)}
                        style={{ width: 28, height: 28, borderRadius: radius.pill, border: "none", background: colors.surfaceMuted, color: colors.textSecondary, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                      >
                        <PencilIcon size={13} />
                      </button>
                    </div>
                  )}

                  {isEditing && (
                    <div style={{ display: "grid", gap: 8, padding: "10px", borderTop: `1px solid ${colors.border}` }}>
                      <DirectionToggle
                        value={editEntryType === "credit"}
                        onChange={(v) => setEditEntryType(v ? "credit" : "debit")}
                        positiveLabel={tr("ledger.givenRadio")}
                        negativeLabel={tr("ledger.receivedRadio")}
                        positiveIcon={<ArrowDownCircleIcon size={16} />}
                        negativeIcon={<ArrowUpCircleIcon size={16} />}
                      />
                      <input type="number" value={editEntryAmount} onChange={(e) => setEditEntryAmount(e.target.value)} style={inputStyle} />
                      <input value={editEntryNote} onChange={(e) => setEditEntryNote(e.target.value)} style={inputStyle} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => handleSaveEntry(entry)} style={{ ...primaryButtonStyle, flex: 1 }}>{tr("common.save")}</button>
                        <button onClick={() => setEditingEntryId(null)} style={{ ...secondaryButtonStyle, flex: 1 }}>{tr("common.cancel")}</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        )}
        <Pagination page={page} totalItems={entries.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  );
}
