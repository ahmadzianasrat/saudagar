import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { enqueueWrite, getSyncStatus } from "../../lib/offlineQueue";
import { generateClientId } from "../../lib/uuid";
import { useLanguage } from "../../contexts/LanguageContext";

interface Counterparty {
  id: string;
  name: string;
  phone_number: string;
}

interface LedgerEntry {
  id: string;
  client_id: string;
  counterparty_id: string;
  entry_type: "credit" | "debit";
  amount: number;
  note: string | null;
  entry_date: string;
  counterparty_name?: string;
  syncStatus?: "pending" | "synced" | "not_found";
}

export default function LedgerHome() {
  const { formatNumber } = useLanguage();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [showNewEntry, setShowNewEntry] = useState(false);

  const [selectedCounterparty, setSelectedCounterparty] = useState("");
  const [newCounterpartyName, setNewCounterpartyName] = useState("");
  const [newCounterpartyPhone, setNewCounterpartyPhone] = useState("");
  const [entryType, setEntryType] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setProfileId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (!profileId) return;
    loadCounterparties();
    loadEntries();
  }, [profileId]);

  async function loadCounterparties() {
    const { data } = await supabase
      .from("counterparties")
      .select("id, name, phone_number")
      .eq("owner_profile_id", profileId);
    setCounterparties(data ?? []);
  }

  async function loadEntries() {
    const { data } = await supabase
      .from("ledger_entries")
      .select("id, client_id, counterparty_id, entry_type, amount, note, entry_date, counterparties(name)")
      .eq("profile_id", profileId)
      .order("entry_date", { ascending: false })
      .limit(50);

    const withStatus = await Promise.all(
      (data ?? []).map(async (row: any) => ({
        ...row,
        counterparty_name: row.counterparties?.name,
        syncStatus: await getSyncStatus(row.client_id),
      }))
    );
    setEntries(withStatus);
  }

  const balance = entries.reduce(
    (sum, e) => sum + (e.entry_type === "credit" ? e.amount : -e.amount),
    0
  );
  const given = entries.filter((e) => e.entry_type === "credit").reduce((s, e) => s + e.amount, 0);
  const received = entries.filter((e) => e.entry_type === "debit").reduce((s, e) => s + e.amount, 0);

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!profileId || !amount) return;

    let counterpartyId = selectedCounterparty;

    if (!counterpartyId && newCounterpartyName && newCounterpartyPhone) {
      const { data: newCp, error } = await supabase
        .from("counterparties")
        .insert({
          owner_profile_id: profileId,
          name: newCounterpartyName,
          phone_number: newCounterpartyPhone,
        })
        .select()
        .single();
      if (error || !newCp) return;
      counterpartyId = newCp.id;
      setCounterparties((prev) => [...prev, newCp]);
    }

    if (!counterpartyId) return;

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

    setEntries((prev) => [
      {
        id: clientId,
        client_id: clientId,
        counterparty_id: counterpartyId,
        entry_type: entryType,
        amount: Number(amount),
        note,
        entry_date: new Date().toISOString(),
        counterparty_name: newCounterpartyName || counterparties.find((c) => c.id === counterpartyId)?.name,
        syncStatus: "pending",
      },
      ...prev,
    ]);

    setAmount("");
    setNote("");
    setNewCounterpartyName("");
    setNewCounterpartyPhone("");
    setSelectedCounterparty("");
    setShowNewEntry(false);
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 13, color: "#888" }}>Total Balance</div>
      <div style={{ fontSize: 28, fontWeight: 500 }}>{formatNumber(balance)} AFN</div>

      <div style={{ display: "flex", gap: 10, margin: "12px 0" }}>
        <div style={{ flex: 1, background: "#e8f5e9", padding: 10, borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "#2e7d32" }}>Given</div>
          <div style={{ fontWeight: 500 }}>{formatNumber(given)}</div>
        </div>
        <div style={{ flex: 1, background: "#fdecea", padding: 10, borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "#b3261e" }}>Received</div>
          <div style={{ fontWeight: 500 }}>{formatNumber(received)}</div>
        </div>
      </div>

      <button onClick={() => setShowNewEntry((v) => !v)} style={{ width: "100%", padding: 10 }}>
        + New Entry
      </button>

      {showNewEntry && (
        <form onSubmit={handleAddEntry} style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <select value={selectedCounterparty} onChange={(e) => setSelectedCounterparty(e.target.value)}>
            <option value="">-- New contact --</option>
            {counterparties.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {!selectedCounterparty && (
            <>
              <input placeholder="Name" value={newCounterpartyName} onChange={(e) => setNewCounterpartyName(e.target.value)} />
              <input placeholder="Phone number" value={newCounterpartyPhone} onChange={(e) => setNewCounterpartyPhone(e.target.value)} />
            </>
          )}
          <div>
            <label><input type="radio" checked={entryType === "credit"} onChange={() => setEntryType("credit")} /> Given (credit)</label>
            <label style={{ marginLeft: 12 }}><input type="radio" checked={entryType === "debit"} onChange={() => setEntryType("debit")} /> Received (debit)</label>
          </div>
          <input placeholder="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="submit">Save Entry</button>
        </form>
      )}

      <div style={{ marginTop: 16 }}>
        {entries.map((entry) => (
          <div key={entry.client_id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #eee" }}>
            <div>
              <div>{entry.counterparty_name}</div>
              <div style={{ fontSize: 11, color: "#999" }}>{new Date(entry.entry_date).toLocaleString()}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: entry.entry_type === "credit" ? "#2e7d32" : "#b3261e" }}>
                {entry.entry_type === "credit" ? "+" : "-"}{formatNumber(entry.amount)}
              </div>
              <div style={{ fontSize: 10, color: entry.syncStatus === "synced" ? "#2e7d32" : "#999" }}>
                {entry.syncStatus === "synced" ? "Synced" : "Pending sync"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
