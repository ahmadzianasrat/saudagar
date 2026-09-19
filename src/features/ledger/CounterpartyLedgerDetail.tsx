import { useEffect, useState, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { enqueueWrite, getSyncStatus } from "../../lib/offlineQueue";
import { generateClientId } from "../../lib/uuid";
import { normalizeAfghanPhone } from "../../lib/phone";
import { phoneToSyntheticEmail } from "../../lib/authHelpers";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTranslation } from "../../i18n/useTranslation";
import { dateGroupLabel, formatDate, formatDateTime, timeAgo } from "../../lib/dateFormat";
import Pagination from "../../components/Pagination";
import { colors, inputStyle, primaryButtonStyle, radius, secondaryButtonStyle } from "../../theme";
import { Avatar, Card, DateGroupHeader, DirectionToggle, EmptyState, LoadingRows, PageHeader, SegmentedControl, SyncDot } from "../../components/ui";
import { AlertIcon, ArrowDownCircleIcon, ArrowUpCircleIcon, EyeIcon, PencilIcon, PlusIcon } from "../../components/icons";
import ReceiptModal from "../../components/ReceiptModal";
import { fetchShopProfile, type ShopProfile } from "../../lib/shopProfile";

const PAGE_SIZE = 10;
type Currency = "AFN" | "PKR";
type ViewFilter = "both" | Currency;

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
  currency: Currency;
  note: string | null;
  entry_date: string;
  syncStatus?: "pending" | "synced" | "not_found";
}

export default function CounterpartyLedgerDetail() {
  const { counterpartyId } = useParams<{ counterpartyId: string }>();
  const navigate = useNavigate();
  const { formatNumber, dateSystem, digitStyle, currencyLabel } = useLanguage();
  const { tr } = useTranslation();

  const [profileId, setProfileId] = useState<string | null>(null);
  const [contact, setContact] = useState<ContactProfile | null>(null);
  // `null` = not loaded yet, distinct from `[]` = loaded and empty —
  // avoids flashing the empty-state message before real data arrives.
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [entryType, setEntryType] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  // Deliberately starts empty (not "AFN") — a contact can hold both
  // currencies now, so the user must actively choose one each time
  // rather than risk recording the wrong currency via an unnoticed
  // default. Submit is blocked with a clear error until they pick.
  const [entryCurrency, setEntryCurrency] = useState<Currency | "">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Which currency's entries/totals are currently shown. Defaults to
  // "both" (nothing hidden by default), but is always an explicit,
  // visible choice — never silently assumed — per "the user should
  // be deliberate about it."
  const [viewFilter, setViewFilter] = useState<ViewFilter>("both");

  // Contact editing
  const [editingContact, setEditingContact] = useState(false);
  const [editName, setEditName] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editAddress, setEditAddress] = useState("");

  // Entry editing — prefilling the CURRENT currency here is fine
  // (this is correcting an existing record, not entering a new one).
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editEntryType, setEditEntryType] = useState<"credit" | "debit">("credit");
  const [editEntryAmount, setEditEntryAmount] = useState("");
  const [editEntryCurrency, setEditEntryCurrency] = useState<Currency>("AFN");
  const [editEntryNote, setEditEntryNote] = useState("");

  // Settle Account (حساب تصفيه کړی) — wipes every entry for this
  // contact, in BOTH currencies, after re-verifying the owner's
  // login password.
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settlePassword, setSettlePassword] = useState("");
  const [settleBusy, setSettleBusy] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settleSuccess, setSettleSuccess] = useState(false);

  // Account receipt — shop profile fetched lazily on first open.
  const [shopProfile, setShopProfile] = useState<ShopProfile | null>(null);
  const [showAccountReceipt, setShowAccountReceipt] = useState(false);

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
      .select("id, client_id, entry_type, amount, currency, note, entry_date")
      .eq("profile_id", profileId)
      .eq("counterparty_id", counterpartyId)
      .order("entry_date", { ascending: false });

    if (loadErr) {
      console.error("failed to load entries:", loadErr);
      setError("Couldn't load entries.");
      setEntries([]);
      return;
    }

    const withStatus = await Promise.all(
      (data ?? []).map(async (row) => ({ ...row, syncStatus: await getSyncStatus(row.client_id) }))
    );
    setEntries(withStatus);
  }

  function totalsFor(currency: Currency) {
    const rows = (entries ?? []).filter((e) => e.currency === currency);
    const given = rows.filter((e) => e.entry_type === "credit").reduce((s, e) => s + e.amount, 0);
    const received = rows.filter((e) => e.entry_type === "debit").reduce((s, e) => s + e.amount, 0);
    return { given, received, balance: given - received, count: rows.length };
  }
  const pkrTotals = totalsFor("PKR");
  const hasAnyPkr = pkrTotals.count > 0;

  // Which currency block(s) to render given the current filter — a
  // currency with zero entries is only shown if the user explicitly
  // filtered to it (so switching to "PKR" on an AFN-only contact
  // still shows a clear zero, not a silently vanished section).
  const visibleCurrencies: Currency[] =
    viewFilter === "both" ? (["AFN", "PKR"] as Currency[]).filter((c) => totalsFor(c).count > 0 || c === "AFN") : [viewFilter];

  const filteredEntries = (entries ?? []).filter((e) => viewFilter === "both" || e.currency === viewFilter);

  async function handleAddEntry(e: FormEvent) {
    e.preventDefault();
    if (!profileId || !counterpartyId || !amount) return;
    if (!entryCurrency) {
      setError(tr("ledger.selectCurrencyRequired"));
      return;
    }
    setError(null);

    const clientId = generateClientId();
    await enqueueWrite("ledger_entries", clientId, {
      client_id: clientId,
      profile_id: profileId,
      counterparty_id: counterpartyId,
      entry_type: entryType,
      amount: Number(amount),
      currency: entryCurrency,
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
        currency: entryCurrency,
        note,
        entry_date: new Date().toISOString(),
        syncStatus,
      },
      ...(prev ?? []),
    ]);

    setAmount("");
    setEntryCurrency("");
    setNote("");
    setShowNewEntry(false);
    setPage(1);
  }

  async function handleSaveContact(e: FormEvent) {
    e.preventDefault();
    if (!counterpartyId) return;

    const normalizedMobile = normalizeAfghanPhone(editMobile);
    const normalizedWhatsapp = editWhatsapp ? normalizeAfghanPhone(editWhatsapp) : null;

    const { error: updateErr } = await supabase
      .from("counterparties")
      .update({
        name: editName,
        phone_number: normalizedMobile,
        whatsapp_number: normalizedWhatsapp,
        address: editAddress || null,
      })
      .eq("id", counterpartyId);

    if (updateErr) {
      console.error("failed to update contact:", updateErr);
      setError("Couldn't save contact changes.");
      return;
    }

    setContact({ name: editName, phone_number: normalizedMobile, whatsapp_number: normalizedWhatsapp, address: editAddress || null });
    setEditingContact(false);
  }

  function startEditEntry(entry: LedgerEntry) {
    setEditingEntryId(entry.client_id);
    setEditEntryType(entry.entry_type);
    setEditEntryAmount(String(entry.amount));
    setEditEntryCurrency(entry.currency);
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
        currency: editEntryCurrency,
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
      (prev ?? []).map((e) =>
        e.client_id === entry.client_id
          ? { ...e, entry_type: editEntryType, amount: Number(editEntryAmount), currency: editEntryCurrency, note: editEntryNote }
          : e
      )
    );
    setEditingEntryId(null);
  }

  async function handleSettleAccount(e: FormEvent) {
    e.preventDefault();
    if (!counterpartyId) return;
    setSettleBusy(true);
    setSettleError(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("not logged in");

      // Read from profiles.phone_number (the owner's own login phone),
      // NOT the counterparty's — this is verifying the shop owner,
      // same pattern as ChangePasswordScreen's re-auth step.
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone_number")
        .eq("id", userData.user.id)
        .single();

      if (!profile?.phone_number) throw new Error("no profile phone number");

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: phoneToSyntheticEmail(profile.phone_number),
        password: settlePassword,
      });

      if (reauthError) {
        setSettleError(tr("password.incorrectCurrent"));
        setSettleBusy(false);
        return;
      }

      const { error: deleteError } = await supabase
        .from("ledger_entries")
        .delete()
        .eq("counterparty_id", counterpartyId)
        .eq("profile_id", userData.user.id);

      if (deleteError) {
        console.error("failed to settle account:", deleteError);
        setSettleError(tr("ledger.settleError"));
        setSettleBusy(false);
        return;
      }

      setEntries([]);
      setSettleSuccess(true);
      setSettlePassword("");
      setTimeout(() => {
        setShowSettleModal(false);
        setSettleSuccess(false);
      }, 1400);
    } catch (err) {
      console.error("settle account failed:", err);
      setSettleError(tr("ledger.settleError"));
    } finally {
      setSettleBusy(false);
    }
  }

  async function openAccountReceipt() {
    setError(null);
    let profile = shopProfile;
    if (!profile) {
      profile = await fetchShopProfile();
      if (!profile) {
        setError(tr("receipt.shopProfileMissing"));
        return;
      }
      setShopProfile(profile);
    }
    setShowAccountReceipt(true);
  }

  const pagedEntries = filteredEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
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

      {/* Currency view filter — always explicit, defaults to "both" */}
      <div style={{ marginTop: 4 }}>
        <SegmentedControl
          value={viewFilter}
          onChange={setViewFilter}
          options={[
            { value: "both" as ViewFilter, label: tr("ledger.viewBoth") },
            { value: "AFN" as ViewFilter, label: currencyLabel("AFN") },
            { value: "PKR" as ViewFilter, label: currencyLabel("PKR") },
          ]}
        />
      </div>

      {visibleCurrencies.map((currency) => {
        const t = totalsFor(currency);
        return (
          <div key={currency}>
            <div style={{ textAlign: "center", margin: "18px 0 4px" }}>
              <div style={{ fontSize: 12, color: colors.textSecondary }}>{tr("ledger.totalBalance")} · {currencyLabel(currency)}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: t.balance >= 0 ? colors.success : colors.danger }}>
                {formatNumber(Math.abs(t.balance))} <span style={{ fontSize: 13, color: colors.textSecondary, fontWeight: 600 }}>{currencyLabel(currency)}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, margin: "10px 0" }}>
              <div style={{ flex: 1, background: colors.successSoft, padding: "10px 12px", borderRadius: radius.md, display: "flex", alignItems: "center", gap: 8 }}>
                <ArrowDownCircleIcon size={20} color={colors.success} />
                <div>
                  <div style={{ fontSize: 11, color: colors.success, fontWeight: 600 }}>{tr("ledger.given")}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: colors.textPrimary }}>{formatNumber(t.given)}</div>
                </div>
              </div>
              <div style={{ flex: 1, background: colors.dangerSoft, padding: "10px 12px", borderRadius: radius.md, display: "flex", alignItems: "center", gap: 8 }}>
                <ArrowUpCircleIcon size={20} color={colors.danger} />
                <div>
                  <div style={{ fontSize: 11, color: colors.danger, fontWeight: 600 }}>{tr("ledger.received")}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: colors.textPrimary }}>{formatNumber(t.received)}</div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {entries !== null && entries.length > 0 && (
        <button
          onClick={() => setShowSettleModal(true)}
          style={{ display: "block", margin: "4px auto 0", background: "none", border: "none", color: colors.danger, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}
        >
          {tr("ledger.settleAccount")}
        </button>
      )}

      <button onClick={() => setShowNewEntry((v) => !v)} style={{ ...primaryButtonStyle, marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <PlusIcon size={17} />
        {tr("ledger.newEntry")}
      </button>

      {entries !== null && entries.length > 0 && (
        <button
          onClick={openAccountReceipt}
          style={{ ...secondaryButtonStyle, marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          <EyeIcon size={15} />
          {tr("receipt.accountReceipt")}
        </button>
      )}

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
            <div>
              <select
                value={entryCurrency}
                onChange={(e) => setEntryCurrency(e.target.value as Currency)}
                required
                style={{ ...inputStyle, color: entryCurrency ? colors.textPrimary : colors.textFaint }}
              >
                <option value="" disabled>{tr("ledger.selectCurrency")}</option>
                <option value="AFN">{currencyLabel("AFN")}</option>
                <option value="PKR">{currencyLabel("PKR")}</option>
              </select>
            </div>
            <input placeholder={tr("ledger.note")} value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} />
            <button type="submit" style={primaryButtonStyle}>{tr("ledger.save")}</button>
          </form>
        </Card>
      )}

      <div style={{ marginTop: 20 }}>
        {entries === null && <LoadingRows count={4} />}
        {entries !== null && filteredEntries.length === 0 && (
          <EmptyState>{entries.length === 0 ? tr("ledger.noEntries") : tr("ledger.noMatches")}</EmptyState>
        )}
        {entries !== null && filteredEntries.length > 0 && (
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
                          {hasAnyPkr && <span style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.7 }}> {currencyLabel(entry.currency, "symbol")}</span>}
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
                      <select value={editEntryCurrency} onChange={(e) => setEditEntryCurrency(e.target.value as Currency)} style={inputStyle}>
                        <option value="AFN">{currencyLabel("AFN")}</option>
                        <option value="PKR">{currencyLabel("PKR")}</option>
                      </select>
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
        <Pagination page={page} totalItems={filteredEntries.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>

      {showSettleModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(16, 27, 51, 0.45)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => !settleBusy && setShowSettleModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: colors.surface,
              borderRadius: "20px 20px 0 0",
              padding: 20,
              width: "100%",
              maxWidth: 480,
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: radius.pill, background: colors.dangerSoft, color: colors.danger, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertIcon size={20} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: colors.textPrimary }}>{tr("ledger.settleAccount")}</div>
            </div>

            <p style={{ fontSize: 13, color: colors.textSecondary, margin: "0 0 14px" }}>
              {tr("ledger.settleWarning")} {hasAnyPkr ? tr("ledger.settleWarningBothCurrencies") : ""}
            </p>

            {settleSuccess ? (
              <p style={{ color: colors.success, fontSize: 13, background: colors.successSoft, padding: "10px 12px", borderRadius: radius.sm, margin: 0 }}>
                {tr("ledger.settleSuccess")}
              </p>
            ) : (
              <form onSubmit={handleSettleAccount} style={{ display: "grid", gap: 10 }}>
                {settleError && (
                  <p style={{ color: colors.danger, fontSize: 13, background: colors.dangerSoft, padding: "9px 12px", borderRadius: radius.sm, margin: 0 }}>
                    {settleError}
                  </p>
                )}
                <input
                  type="password"
                  placeholder={tr("ledger.settlePasswordPrompt")}
                  value={settlePassword}
                  onChange={(e) => setSettlePassword(e.target.value)}
                  required
                  style={inputStyle}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="submit"
                    disabled={settleBusy}
                    style={{ flex: 1, padding: "12px 16px", fontSize: 14, fontWeight: 700, color: colors.white, background: colors.danger, border: "none", borderRadius: radius.md, cursor: "pointer", opacity: settleBusy ? 0.7 : 1 }}
                  >
                    {settleBusy ? "…" : tr("ledger.settleConfirmButton")}
                  </button>
                  <button
                    type="button"
                    disabled={settleBusy}
                    onClick={() => { setShowSettleModal(false); setSettleError(null); setSettlePassword(""); }}
                    style={{ ...secondaryButtonStyle, flex: 1 }}
                  >
                    {tr("ledger.cancel")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showAccountReceipt && shopProfile && contact && (
        <ReceiptModal
          onClose={() => setShowAccountReceipt(false)}
          shop={shopProfile}
          title={tr("receipt.accountStatement")}
          dateLabel={formatDate(new Date(), dateSystem, digitStyle)}
          party={{
            label: tr("ledger.name"),
            name: contact.name,
            phone: contact.phone_number,
            whatsapp: contact.whatsapp_number,
            address: contact.address,
          }}
          rows={visibleCurrencies.flatMap((currency) => {
            const t = totalsFor(currency);
            // Oldest-first, like a running history — even though the
            // on-screen ledger elsewhere shows newest-first.
            const chronological = filteredEntries
              .filter((e) => e.currency === currency)
              .slice()
              .sort((a, b) => a.entry_date.localeCompare(b.entry_date));
            return [
              { label: `${currencyLabel(currency)}`, value: "", emphasis: true },
              ...chronological.map((e) => ({
                label: `${formatDate(e.entry_date, dateSystem, digitStyle)}${e.note ? ` · ${e.note}` : ""}`,
                value: `${e.entry_type === "credit" ? "+" : "-"}${formatNumber(e.amount)}`,
                tone: e.entry_type === "credit" ? ("success" as const) : ("danger" as const),
              })),
              { label: tr("ledger.given"), value: formatNumber(t.given), tone: "success" as const },
              { label: tr("ledger.received"), value: formatNumber(t.received), tone: "danger" as const },
            ];
          })}
          totalLabel={tr("ledger.totalBalance")}
          totalValue={visibleCurrencies
            .map((c) => {
              const t = totalsFor(c);
              return `${t.balance < 0 ? "-" : ""}${formatNumber(Math.abs(t.balance))} ${currencyLabel(c)}`;
            })
            .join("  /  ")}
          filename={`account-statement-${contact.name.replace(/\s+/g, "-").toLowerCase()}`}
          whatsappText={
            `${shopProfile.shop_name} — ${tr("receipt.accountStatement")}\n${contact.name}\n` +
            visibleCurrencies
              .map((c) => {
                const t = totalsFor(c);
                return `${currencyLabel(c)}: ${tr("ledger.given")} ${formatNumber(t.given)}, ${tr("ledger.received")} ${formatNumber(t.received)}, ${tr("ledger.totalBalance")} ${t.balance < 0 ? "-" : ""}${formatNumber(Math.abs(t.balance))}`;
              })
              .join("\n")
          }
          whatsappPhone={contact.whatsapp_number || contact.phone_number}
        />
      )}
    </div>
  );
}
