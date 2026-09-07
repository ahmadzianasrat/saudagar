import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { enqueueWrite, getSyncStatus } from "../../lib/offlineQueue";
import { generateClientId } from "../../lib/uuid";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTranslation } from "../../i18n/useTranslation";
import Pagination from "../../components/Pagination";

const PAGE_SIZE = 10;

interface Counterparty {
  id: string;
  name: string;
  phone_number: string;
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
  const { formatNumber } = useLanguage();
  const { tr } = useTranslation();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<CounterpartyWithBalance[]>([]);
  const [allEntries, setAllEntries] = useState<EntryRow[]>([]);
  const [entriesPage, setEntriesPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Add-contact form (unchanged from before)
  const [showAddContact, setShowAddContact] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // Quick-entry form — write into an existing contact's ledger
  // directly from this page, without navigating to their detail view.
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
      .select("id, name, phone_number")
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

  async function handleAddContact(e: FormEvent) {
    e.preventDefault();
    if (!profileId || !newName || !newPhone) return;

    const { data, error: insertError } = await supabase
      .from("counterparties")
      .insert({ owner_profile_id: profileId, name: newName, phone_number: newPhone })
      .select()
      .single();

    if (insertError || !data) {
      console.error("failed to add contact:", insertError);
      setError("Couldn't add contact — they may already exist.");
      return;
    }

    setNewName("");
    setNewPhone("");
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

    // Update the affected contact's balance locally so the list
    // reflects the change immediately, without waiting on a re-fetch.
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
        syncStatus: "pending",
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

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 13, color: "#888" }}>{tr("ledger.totalBalance")}</div>
      <div style={{ fontSize: 28, fontWeight: 500 }}>{formatNumber(totalBalance)} AFN</div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={() => setShowAddContact((v) => !v)} style={{ flex: 1, padding: 10 }}>
          {tr("ledger.addContact")}
        </button>
        <button onClick={() => setShowQuickEntry((v) => !v)} style={{ flex: 1, padding: 10 }}>
          {tr("ledger.quickEntry")}
        </button>
      </div>

      {showAddContact && (
        <form onSubmit={handleAddContact} style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <input placeholder={tr("ledger.name")} value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input placeholder={tr("ledger.phoneNumber")} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          <button type="submit">{tr("ledger.save")}</button>
        </form>
      )}

      {showQuickEntry && (
        <form onSubmit={handleQuickEntry} style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <select value={quickContactId} onChange={(e) => setQuickContactId(e.target.value)} required>
            <option value="">{tr("ledger.selectContact")}</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div>
            <label><input type="radio" checked={quickType === "credit"} onChange={() => setQuickType("credit")} /> {tr("ledger.givenRadio")}</label>
            <label style={{ marginLeft: 12 }}><input type="radio" checked={quickType === "debit"} onChange={() => setQuickType("debit")} /> {tr("ledger.receivedRadio")}</label>
          </div>
          <input placeholder={tr("ledger.amount")} type="number" value={quickAmount} onChange={(e) => setQuickAmount(e.target.value)} />
          <input placeholder={tr("ledger.note")} value={quickNote} onChange={(e) => setQuickNote(e.target.value)} />
          <button type="submit">{tr("ledger.save")}</button>
        </form>
      )}

      <div style={{ marginTop: 20 }}>
        {contacts.length === 0 && <p style={{ color: "#888" }}>{tr("ledger.noContacts")}</p>}
        {contacts.map((c) => (
          <div
            key={c.id}
            onClick={() => navigate(`/ledger/${c.id}`)}
            style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #eee", cursor: "pointer" }}
          >
            <div>
              <div>{c.name}</div>
              <div style={{ fontSize: 11, color: "#999" }}>{c.phone_number}</div>
            </div>
            <div style={{ color: c.balance >= 0 ? "#2e7d32" : "#b3261e", fontWeight: 500 }}>
              {formatNumber(Math.abs(c.balance))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 15 }}>{tr("ledger.allEntries")}</h3>
        {allEntries.length === 0 && <p style={{ color: "#888" }}>{tr("ledger.noEntries")}</p>}
        {pagedEntries.map((entry) => (
          <div
            key={entry.client_id}
            onClick={() => navigate(`/ledger/${entry.counterparty_id}`)}
            style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #eee", cursor: "pointer" }}
          >
            <div>
              <div>{entry.counterparty_name}</div>
              <div style={{ fontSize: 11, color: "#999" }}>{new Date(entry.entry_date).toLocaleString()}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: entry.entry_type === "credit" ? "#2e7d32" : "#b3261e" }}>
                {entry.entry_type === "credit" ? "+" : "-"}{formatNumber(entry.amount)}
              </div>
              <div style={{ fontSize: 10, color: entry.syncStatus === "synced" ? "#2e7d32" : "#999" }}>
                {entry.syncStatus === "synced" ? tr("ledger.synced") : tr("ledger.pending")}
              </div>
            </div>
          </div>
        ))}
        <Pagination page={entriesPage} totalItems={allEntries.length} pageSize={PAGE_SIZE} onPageChange={setEntriesPage} />
      </div>
    </div>
  );
}
