import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { enqueueWrite, getSyncStatus } from "../../lib/offlineQueue";
import { generateClientId } from "../../lib/uuid";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTranslation } from "../../i18n/useTranslation";
import { dateGroupLabel, timeAgo } from "../../lib/dateFormat";
import Pagination from "../../components/Pagination";
import { colors, inputStyle, primaryButtonStyle, radius, secondaryButtonStyle, shadow } from "../../theme";
import { Avatar, Card, DateGroupHeader, DirectionToggle, EmptyState, SectionLabel, SyncDot } from "../../components/ui";
import { ArrowDownCircleIcon, ArrowUpCircleIcon, ChevronIcon, PersonIcon, PlusIcon, WalletIcon } from "../../components/icons";

const PAGE_SIZE = 10;

interface Counterparty {
  id: string;
  name: string;
  phone_number: string; // treated as "mobile number" in the UI
  whatsapp_number: string | null;
  address: string | null;
}

interface CounterpartyWithBalance extends Counterparty {
  balance: number;
  lastActivity: string | null;
}

interface EntryRow {
  id: string;
  client_id: string;
  counterparty_id: string;
  counterparty_name?: string;
  entry_type: "credit" | "debit";
  amount: number;
  note: string | null;
  entry_date: string;
  syncStatus?: "pending" | "synced" | "not_found";
}

export default function LedgerHome() {
  const navigate = useNavigate();
  const { formatNumber, dateSystem, digitStyle } = useLanguage();
  const { tr } = useTranslation();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<CounterpartyWithBalance[]>([]);
  const [allEntries, setAllEntries] = useState<EntryRow[]>([]);
  const [entriesPage, setEntriesPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [showAddContact, setShowAddContact] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMobile, setNewMobile] = useState("");
  const [newWhatsapp, setNewWhatsapp] = useState("");
  const [newAddress, setNewAddress] = useState("");

  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [quickContactId, setQuickContactId] = useState("");
  const [quickType, setQuickType] = useState<"credit" | "debit">("credit");
  const [quickAmount, setQuickAmount] = useState("");
  const [quickNote, setQuickNote] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setProfileId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (profileId) load();
  }, [profileId]);

  async function load() {
    const { data: counterparties, error: cpErr } = await supabase
      .from("counterparties")
      .select("id, name, phone_number, whatsapp_number, address")
      .eq("owner_profile_id", profileId);

    if (cpErr) {
      console.error("failed to load counterparties:", cpErr);
      setError("Couldn't load contacts.");
      return;
    }

    const { data: entries, error: entriesErr } = await supabase
      .from("ledger_entries")
      .select("id, client_id, counterparty_id, entry_type, amount, note, entry_date")
      .eq("profile_id", profileId)
      .order("entry_date", { ascending: false });

    if (entriesErr) {
      console.error("failed to load ledger_entries:", entriesErr);
      setError("Couldn't load balances.");
      return;
    }

    const nameById = new Map((counterparties ?? []).map((c) => [c.id, c.name]));
    const balances = new Map<string, { balance: number; lastActivity: string | null }>();
    for (const e of entries ?? []) {
      const current = balances.get(e.counterparty_id) ?? { balance: 0, lastActivity: null };
      current.balance += e.entry_type === "credit" ? e.amount : -e.amount;
      if (!current.lastActivity || e.entry_date > current.lastActivity) {
        current.lastActivity = e.entry_date;
      }
      balances.set(e.counterparty_id, current);
    }

    const withBalances: CounterpartyWithBalance[] = (counterparties ?? []).map((c) => ({
      ...c,
      balance: balances.get(c.id)?.balance ?? 0,
      lastActivity: balances.get(c.id)?.lastActivity ?? null,
    }));
    withBalances.sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""));
    setContacts(withBalances);

    const withStatus = await Promise.all(
      (entries ?? []).map(async (row) => ({
        ...row,
        counterparty_name: nameById.get(row.counterparty_id),
        syncStatus: await getSyncStatus(row.client_id),
      }))
    );
    setAllEntries(withStatus);
  }

  const totalBalance = contacts.reduce((sum, c) => sum + c.balance, 0);
  const totalGiven = allEntries.filter((e) => e.entry_type === "credit").reduce((s, e) => s + e.amount, 0);
  const totalReceived = allEntries.filter((e) => e.entry_type === "debit").reduce((s, e) => s + e.amount, 0);

  async function handleAddContact(e: FormEvent) {
    e.preventDefault();
    if (!profileId || !newName || !newMobile) return;

    const { data, error: insertError } = await supabase
      .from("counterparties")
      .insert({
        owner_profile_id: profileId,
        name: newName,
        phone_number: newMobile,
        whatsapp_number: newWhatsapp || null,
        address: newAddress || null,
      })
      .select()
      .single();

    if (insertError || !data) {
      console.error("failed to add contact:", insertError);
      setError("Couldn't add contact — they may already exist.");
      return;
    }

    setNewName("");
    setNewMobile("");
    setNewWhatsapp("");
    setNewAddress("");
    setShowAddContact(false);
    navigate(`/ledger/${data.id}`);
  }

  async function handleQuickEntry(e: FormEvent) {
    e.preventDefault();
    if (!profileId || !quickContactId || !quickAmount) return;

    const clientId = generateClientId();
    await enqueueWrite("ledger_entries", clientId, {
      client_id: clientId,
      profile_id: profileId,
      counterparty_id: quickContactId,
      entry_type: quickType,
      amount: Number(quickAmount),
      note: quickNote || null,
      entry_date: new Date().toISOString(),
    });

    // enqueueWrite now awaits the actual sync attempt — re-check
    // status immediately rather than hardcoding "pending", fixing the
    // "only synced after refresh" symptom.
    const syncStatus = await getSyncStatus(clientId);

    const contactName = contacts.find((c) => c.id === quickContactId)?.name;
    setContacts((prev) =>
      prev.map((c) =>
        c.id === quickContactId
          ? { ...c, balance: c.balance + (quickType === "credit" ? Number(quickAmount) : -Number(quickAmount)), lastActivity: new Date().toISOString() }
          : c
      )
    );
    setAllEntries((prev) => [
      {
        id: clientId,
        client_id: clientId,
        counterparty_id: quickContactId,
        counterparty_name: contactName,
        entry_type: quickType,
        amount: Number(quickAmount),
        note: quickNote,
        entry_date: new Date().toISOString(),
        syncStatus,
      },
      ...prev,
    ]);

    setQuickAmount("");
    setQuickNote("");
    setQuickContactId("");
    setEntriesPage(1);
    setShowQuickEntry(false);
  }

  const pagedEntries = allEntries.slice((entriesPage - 1) * PAGE_SIZE, entriesPage * PAGE_SIZE);

  // Insert a group header row whenever the day changes within this
  // page — separates "Today" / "Yesterday" / older entries visually.
  let lastGroupLabel: string | null = null;

  return (
    <div style={{ padding: 16, paddingBottom: 28 }}>
      {/* Balance card */}
      <div
        style={{
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})`,
          borderRadius: radius.xl,
          padding: 20,
          color: colors.white,
          boxShadow: shadow.raised,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            insetInlineEnd: -18,
            top: -18,
            width: 100,
            height: 100,
            borderRadius: radius.pill,
            background: "rgba(255,255,255,0.08)",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, opacity: 0.85 }}>
          <WalletIcon size={18} />
          {tr("ledger.totalBalance")}
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, marginTop: 6 }}>
          {formatNumber(totalBalance)} <span style={{ fontSize: 15, fontWeight: 600, opacity: 0.85 }}>AFN</span>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.14)", borderRadius: radius.md, padding: "8px 12px" }}>
            <div style={{ fontSize: 11, opacity: 0.85, display: "flex", alignItems: "center", gap: 4 }}>
              <ArrowDownCircleIcon size={14} />
              {tr("ledger.given")}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{formatNumber(totalGiven)}</div>
          </div>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.14)", borderRadius: radius.md, padding: "8px 12px" }}>
            <div style={{ fontSize: 11, opacity: 0.85, display: "flex", alignItems: "center", gap: 4 }}>
              <ArrowUpCircleIcon size={14} />
              {tr("ledger.received")}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{formatNumber(totalReceived)}</div>
          </div>
        </div>
      </div>

      {error && (
        <p style={{ color: colors.danger, fontSize: 13, marginTop: 10, background: colors.dangerSoft, padding: "8px 10px", borderRadius: radius.sm }}>
          {error}
        </p>
      )}

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button onClick={() => { setShowAddContact((v) => !v); setShowQuickEntry(false); }} style={{ ...secondaryButtonStyle, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <PersonIcon size={17} />
          {tr("ledger.addContact")}
        </button>
        <button onClick={() => { setShowQuickEntry((v) => !v); setShowAddContact(false); }} style={{ ...primaryButtonStyle, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <PlusIcon size={17} />
          {tr("ledger.quickEntry")}
        </button>
      </div>

      {showAddContact && (
        <Card style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <form onSubmit={handleAddContact} style={{ display: "grid", gap: 10 }}>
            <input placeholder={tr("ledger.name")} value={newName} onChange={(e) => setNewName(e.target.value)} style={inputStyle} />
            <input placeholder={tr("ledger.mobileNumber")} value={newMobile} onChange={(e) => setNewMobile(e.target.value)} style={inputStyle} inputMode="tel" />
            <input placeholder={tr("ledger.whatsappNumber")} value={newWhatsapp} onChange={(e) => setNewWhatsapp(e.target.value)} style={inputStyle} inputMode="tel" />
            <input placeholder={tr("ledger.address")} value={newAddress} onChange={(e) => setNewAddress(e.target.value)} style={inputStyle} />
            <button type="submit" style={primaryButtonStyle}>{tr("ledger.save")}</button>
          </form>
        </Card>
      )}

      {showQuickEntry && (
        <Card style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <form onSubmit={handleQuickEntry} style={{ display: "grid", gap: 10 }}>
            <select value={quickContactId} onChange={(e) => setQuickContactId(e.target.value)} required style={inputStyle}>
              <option value="">{tr("ledger.selectContact")}</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <DirectionToggle
              value={quickType === "credit"}
              onChange={(v) => setQuickType(v ? "credit" : "debit")}
              positiveLabel={tr("ledger.givenRadio")}
              negativeLabel={tr("ledger.receivedRadio")}
              positiveIcon={<ArrowDownCircleIcon size={16} />}
              negativeIcon={<ArrowUpCircleIcon size={16} />}
            />
            <input placeholder={tr("ledger.amount")} type="number" value={quickAmount} onChange={(e) => setQuickAmount(e.target.value)} style={inputStyle} />
            <input placeholder={tr("ledger.note")} value={quickNote} onChange={(e) => setQuickNote(e.target.value)} style={inputStyle} />
            <button type="submit" style={primaryButtonStyle}>{tr("ledger.save")}</button>
          </form>
        </Card>
      )}

      {/* Contacts */}
      <div style={{ marginTop: 22 }}>
        <SectionLabel>{tr("nav.ledger")}</SectionLabel>
        {contacts.length === 0 && <EmptyState>{tr("ledger.noContacts")}</EmptyState>}
        {contacts.length > 0 && (
          <Card style={{ padding: 4 }}>
            {contacts.map((c, i) => (
              <div
                key={c.id}
                onClick={() => navigate(`/ledger/${c.id}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 10px",
                  borderTop: i === 0 ? "none" : `1px solid ${colors.border}`,
                  cursor: "pointer",
                }}
              >
                <Avatar label={c.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5, color: colors.textPrimary }}>{c.name}</div>
                  {c.whatsapp_number && <div style={{ fontSize: 11.5, color: colors.textFaint }}>{c.whatsapp_number}</div>}
                </div>
                <div style={{ color: c.balance >= 0 ? colors.success : colors.danger, fontWeight: 700, fontSize: 14 }}>
                  {c.balance < 0 && "-"}{formatNumber(Math.abs(c.balance))}
                </div>
                <ChevronIcon size={16} dir="end" color={colors.textFaint} />
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* All entries */}
      <div style={{ marginTop: 22 }}>
        <SectionLabel>{tr("ledger.allEntries")}</SectionLabel>
        {allEntries.length === 0 && <EmptyState>{tr("ledger.noEntries")}</EmptyState>}
        {allEntries.length > 0 && (
          <Card style={{ padding: 4 }}>
            {pagedEntries.map((entry, i) => {
              const groupLabel = dateGroupLabel(entry.entry_date, dateSystem, digitStyle, tr);
              const showHeader = groupLabel !== lastGroupLabel;
              lastGroupLabel = groupLabel;
              const isCredit = entry.entry_type === "credit";
              return (
                <div key={entry.client_id}>
                  {showHeader && <div style={{ padding: "6px 10px 0" }}><DateGroupHeader>{groupLabel}</DateGroupHeader></div>}
                  <div
                    onClick={() => navigate(`/ledger/${entry.counterparty_id}`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 10px",
                      borderTop: showHeader || i === 0 ? "none" : `1px solid ${colors.border}`,
                      cursor: "pointer",
                    }}
                  >
                    {isCredit ? (
                      <ArrowDownCircleIcon size={30} color={colors.success} />
                    ) : (
                      <ArrowUpCircleIcon size={30} color={colors.danger} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: colors.textPrimary }}>{entry.counterparty_name}</div>
                      <div style={{ fontSize: 11, color: colors.textFaint }}>{timeAgo(entry.entry_date, tr)}</div>
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
                  </div>
                </div>
              );
            })}
          </Card>
        )}
        <Pagination page={entriesPage} totalItems={allEntries.length} pageSize={PAGE_SIZE} onPageChange={setEntriesPage} />
      </div>
    </div>
  );
}
