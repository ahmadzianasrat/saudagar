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
import { Avatar, Card, DateGroupHeader, DirectionToggle, EmptyState, LoadingRows, SectionLabel, SyncDot } from "../../components/ui";
import { ArrowDownCircleIcon, ArrowUpCircleIcon, ChevronIcon, PersonIcon, PlusIcon, SearchIcon, WalletIcon } from "../../components/icons";

const INCLUDE_INVENTORY_KEY = "saudagar:ledger-include-inventory-value";
const PAGE_SIZE = 10;
type Currency = "AFN" | "PKR";

interface Counterparty {
  id: string;
  name: string;
  phone_number: string; // treated as "mobile number" in the UI
  whatsapp_number: string | null;
  address: string | null;
}

// A contact can hold both an AFN balance and a PKR balance at once —
// they're never summed together (see totals below).
interface CounterpartyWithBalance extends Counterparty {
  balanceAFN: number;
  balancePKR: number;
  lastActivity: string | null;
}

interface EntryRow {
  id: string;
  client_id: string;
  counterparty_id: string;
  counterparty_name?: string;
  currency: Currency;
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
  // `null` = "haven't loaded yet", distinct from `[]` = "loaded, and
  // there's genuinely nothing there" — without this distinction the
  // empty-state message flashes on screen for a moment on every visit
  // to this tab, before the real data has had a chance to arrive.
  const [contacts, setContacts] = useState<CounterpartyWithBalance[] | null>(null);
  const [allEntries, setAllEntries] = useState<EntryRow[] | null>(null);
  const [entriesPage, setEntriesPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [inventoryValue, setInventoryValue] = useState<number>(0);
  // Whether the shop's inventory value is folded into the balance
  // card's grand total — a display preference, not app data, so it
  // lives in localStorage rather than the database (same pattern as
  // the currency-converter's saved rates).
  const [includeInventoryValue, setIncludeInventoryValue] = useState<boolean>(() => {
    try {
      return localStorage.getItem(INCLUDE_INVENTORY_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [showAddContact, setShowAddContact] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMobile, setNewMobile] = useState("");
  const [newWhatsapp, setNewWhatsapp] = useState("");
  const [newAddress, setNewAddress] = useState("");

  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [quickContactId, setQuickContactId] = useState("");
  const [quickType, setQuickType] = useState<"credit" | "debit">("credit");
  const [quickAmount, setQuickAmount] = useState("");
  // Deliberately starts empty — a contact can hold both AFN and PKR
  // now, so this is never pre-filled/assumed; submit is blocked with
  // a clear error until the user actively picks one.
  const [quickCurrency, setQuickCurrency] = useState<Currency | "">("");
  const [quickNote, setQuickNote] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setProfileId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (profileId) {
      load();
      loadInventoryValue();
    }
  }, [profileId]);

  async function loadInventoryValue() {
    const { data, error: invErr } = await supabase
      .from("inventory_items")
      .select("total_cost")
      .eq("profile_id", profileId);

    if (invErr) {
      // Non-fatal — the checkbox just won't have a meaningful number
      // to add. Ledger data itself loaded independently above.
      console.error("failed to load inventory value:", invErr);
      return;
    }
    setInventoryValue((data ?? []).reduce((sum, row) => sum + (row.total_cost ?? 0), 0));
  }

  function toggleIncludeInventoryValue(next: boolean) {
    setIncludeInventoryValue(next);
    try {
      localStorage.setItem(INCLUDE_INVENTORY_KEY, String(next));
    } catch {
      // localStorage can throw in private-browsing contexts — the
      // toggle still works for this session, it just won't persist.
    }
  }

  async function load() {
    const { data: counterparties, error: cpErr } = await supabase
      .from("counterparties")
      .select("id, name, phone_number, whatsapp_number, address")
      .eq("owner_profile_id", profileId);

    if (cpErr) {
      console.error("failed to load counterparties:", cpErr);
      setError("Couldn't load contacts.");
      setContacts([]);
      setAllEntries([]);
      return;
    }

    const { data: entries, error: entriesErr } = await supabase
      .from("ledger_entries")
      .select("id, client_id, counterparty_id, entry_type, amount, note, entry_date, currency")
      .eq("profile_id", profileId)
      .order("entry_date", { ascending: false });

    if (entriesErr) {
      console.error("failed to load ledger_entries:", entriesErr);
      setError("Couldn't load balances.");
      setAllEntries([]);
      return;
    }

    const nameById = new Map((counterparties ?? []).map((c) => [c.id, c.name]));
    const balances = new Map<string, { balanceAFN: number; balancePKR: number; lastActivity: string | null }>();
    for (const e of entries ?? []) {
      const current = balances.get(e.counterparty_id) ?? { balanceAFN: 0, balancePKR: 0, lastActivity: null };
      const delta = e.entry_type === "credit" ? e.amount : -e.amount;
      if (e.currency === "PKR") current.balancePKR += delta;
      else current.balanceAFN += delta;
      if (!current.lastActivity || e.entry_date > current.lastActivity) {
        current.lastActivity = e.entry_date;
      }
      balances.set(e.counterparty_id, current);
    }

    const withBalances: CounterpartyWithBalance[] = (counterparties ?? []).map((c) => ({
      ...c,
      balanceAFN: balances.get(c.id)?.balanceAFN ?? 0,
      balancePKR: balances.get(c.id)?.balancePKR ?? 0,
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

  const hasAnyPkr = (allEntries ?? []).some((e) => e.currency === "PKR");

  const totalBalanceAFN = (contacts ?? []).reduce((sum, c) => sum + c.balanceAFN, 0);
  const totalBalancePKR = (contacts ?? []).reduce((sum, c) => sum + c.balancePKR, 0);
  // Inventory is tracked and valued in AFN only (see InventoryHome /
  // Phase 3 migration notes) — it only ever folds into the AFN total.
  const grandTotalAFN = includeInventoryValue ? totalBalanceAFN + inventoryValue : totalBalanceAFN;

  function sumByCurrency(type: "credit" | "debit", currency: Currency): number {
    return (allEntries ?? [])
      .filter((e) => e.entry_type === type && e.currency === currency)
      .reduce((s, e) => s + e.amount, 0);
  }
  const totalGivenAFN = sumByCurrency("credit", "AFN");
  const totalReceivedAFN = sumByCurrency("debit", "AFN");
  const totalGivenPKR = sumByCurrency("credit", "PKR");
  const totalReceivedPKR = sumByCurrency("debit", "PKR");

  const filteredContacts = search.trim()
    ? (contacts ?? []).filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
    : (contacts ?? []);

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
    if (!quickCurrency) {
      setError(tr("ledger.selectCurrencyRequired"));
      return;
    }
    setError(null);

    const clientId = generateClientId();
    await enqueueWrite("ledger_entries", clientId, {
      client_id: clientId,
      profile_id: profileId,
      counterparty_id: quickContactId,
      entry_type: quickType,
      amount: Number(quickAmount),
      currency: quickCurrency,
      note: quickNote || null,
      entry_date: new Date().toISOString(),
    });

    // enqueueWrite now awaits the actual sync attempt — re-check
    // status immediately rather than hardcoding "pending", fixing the
    // "only synced after refresh" symptom.
    const syncStatus = await getSyncStatus(clientId);

    const contactName = (contacts ?? []).find((c) => c.id === quickContactId)?.name;
    const delta = quickType === "credit" ? Number(quickAmount) : -Number(quickAmount);
    setContacts((prev) =>
      (prev ?? []).map((c) =>
        c.id === quickContactId
          ? {
              ...c,
              balanceAFN: c.balanceAFN + (quickCurrency === "AFN" ? delta : 0),
              balancePKR: c.balancePKR + (quickCurrency === "PKR" ? delta : 0),
              lastActivity: new Date().toISOString(),
            }
          : c
      )
    );
    setAllEntries((prev) => [
      // prepend: prev is guaranteed non-null here since this only runs
      // after the initial load has completed (the form isn't shown until then)
      {
        id: clientId,
        client_id: clientId,
        counterparty_id: quickContactId,
        counterparty_name: contactName,
        currency: quickCurrency,
        entry_type: quickType,
        amount: Number(quickAmount),
        note: quickNote,
        entry_date: new Date().toISOString(),
        syncStatus,
      },
      ...(prev ?? []),
    ]);

    setQuickAmount("");
    setQuickCurrency("");
    setQuickNote("");
    setQuickContactId("");
    setEntriesPage(1);
    setShowQuickEntry(false);
  }

  const pagedEntries = (allEntries ?? []).slice((entriesPage - 1) * PAGE_SIZE, entriesPage * PAGE_SIZE);

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
          {includeInventoryValue ? tr("ledger.grandTotal") : tr("ledger.totalBalance")}
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, marginTop: 6 }}>
          {formatNumber(grandTotalAFN)} <span style={{ fontSize: 15, fontWeight: 600, opacity: 0.85 }}>AFN</span>
        </div>
        {hasAnyPkr && (
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2, opacity: 0.92 }}>
            {formatNumber(totalBalancePKR)} <span style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.85 }}>PKR</span>
          </div>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, fontSize: 12, opacity: 0.9, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={includeInventoryValue}
            onChange={(e) => toggleIncludeInventoryValue(e.target.checked)}
          />
          {tr("ledger.includeInventoryValue")} ({formatNumber(inventoryValue)} AFN)
        </label>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.14)", borderRadius: radius.md, padding: "8px 12px" }}>
            <div style={{ fontSize: 11, opacity: 0.85, display: "flex", alignItems: "center", gap: 4 }}>
              <ArrowDownCircleIcon size={14} />
              {tr("ledger.given")}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>
              {formatNumber(totalGivenAFN)}
              {hasAnyPkr && totalGivenPKR > 0 && (
                <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}> · {formatNumber(totalGivenPKR)} PKR</span>
              )}
            </div>
          </div>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.14)", borderRadius: radius.md, padding: "8px 12px" }}>
            <div style={{ fontSize: 11, opacity: 0.85, display: "flex", alignItems: "center", gap: 4 }}>
              <ArrowUpCircleIcon size={14} />
              {tr("ledger.received")}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>
              {formatNumber(totalReceivedAFN)}
              {hasAnyPkr && totalReceivedPKR > 0 && (
                <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}> · {formatNumber(totalReceivedPKR)} PKR</span>
              )}
            </div>
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
              {(contacts ?? []).map((c) => (
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
            <select
              value={quickCurrency}
              onChange={(e) => setQuickCurrency(e.target.value as Currency)}
              required
              style={{ ...inputStyle, color: quickCurrency ? colors.textPrimary : colors.textFaint }}
            >
              <option value="" disabled>{tr("ledger.selectCurrency")}</option>
              <option value="AFN">AFN</option>
              <option value="PKR">PKR</option>
            </select>
            <input placeholder={tr("ledger.note")} value={quickNote} onChange={(e) => setQuickNote(e.target.value)} style={inputStyle} />
            <button type="submit" style={primaryButtonStyle}>{tr("ledger.save")}</button>
          </form>
        </Card>
      )}

      {/* Contacts */}
      <div style={{ marginTop: 22 }}>
        <SectionLabel>{tr("nav.ledger")}</SectionLabel>

        {contacts !== null && contacts.length > 0 && (
          <div style={{ position: "relative", marginBottom: 10 }}>
            <SearchIcon size={16} color={colors.textFaint} style={{ position: "absolute", insetInlineStart: 13, top: "50%", transform: "translateY(-50%)" }} />
            <input
              placeholder={tr("ledger.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingInlineStart: 38 }}
            />
          </div>
        )}

        {contacts === null && <LoadingRows count={4} />}
        {contacts !== null && contacts.length === 0 && <EmptyState>{tr("ledger.noContacts")}</EmptyState>}
        {contacts !== null && contacts.length > 0 && filteredContacts.length === 0 && (
          <EmptyState>{tr("ledger.noMatches")}</EmptyState>
        )}
        {filteredContacts.length > 0 && (
          <Card style={{ padding: 4 }}>
            {filteredContacts.map((c, i) => (
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
                <div style={{ textAlign: "end" }}>
                  <div style={{ color: c.balanceAFN >= 0 ? colors.success : colors.danger, fontWeight: 700, fontSize: 14 }}>
                    {c.balanceAFN < 0 && "-"}{formatNumber(Math.abs(c.balanceAFN))} <span style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.7 }}>AFN</span>
                  </div>
                  {c.balancePKR !== 0 && (
                    <div style={{ color: c.balancePKR >= 0 ? colors.success : colors.danger, fontWeight: 700, fontSize: 12.5, marginTop: 1 }}>
                      {c.balancePKR < 0 && "-"}{formatNumber(Math.abs(c.balancePKR))} <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.7 }}>PKR</span>
                    </div>
                  )}
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
        {allEntries === null && <LoadingRows count={4} />}
        {allEntries !== null && allEntries.length === 0 && <EmptyState>{tr("ledger.noEntries")}</EmptyState>}
        {allEntries !== null && allEntries.length > 0 && (
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
                        {hasAnyPkr && <span style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.7 }}> {entry.currency}</span>}
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
        <Pagination page={entriesPage} totalItems={(allEntries ?? []).length} pageSize={PAGE_SIZE} onPageChange={setEntriesPage} />
      </div>
    </div>
  );
}
