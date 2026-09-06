import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTranslation } from "../../i18n/useTranslation";

interface Counterparty {
  id: string;
  name: string;
  phone_number: string;
}

interface CounterpartyWithBalance extends Counterparty {
  balance: number;
  lastActivity: string | null;
}

// Restructured from a single combined feed into a proper per-customer
// account list — each contact has their own running balance, matching
// how khata-book apps (and the original product idea) actually work.
// Tapping a contact opens CounterpartyLedgerDetail for just their history.
export default function LedgerHome() {
  const navigate = useNavigate();
  const { formatNumber } = useLanguage();
  const { tr } = useTranslation();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<CounterpartyWithBalance[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

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
      .select("counterparty_id, entry_type, amount, entry_date")
      .eq("profile_id", profileId);

    if (entriesErr) {
      console.error("failed to load ledger_entries:", entriesErr);
      setError("Couldn't load balances.");
      return;
    }

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

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 13, color: "#888" }}>{tr("ledger.totalBalance")}</div>
      <div style={{ fontSize: 28, fontWeight: 500 }}>{formatNumber(totalBalance)} AFN</div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <button onClick={() => setShowAddContact((v) => !v)} style={{ width: "100%", padding: 10, marginTop: 12 }}>
        {tr("ledger.addContact")}
      </button>

      {showAddContact && (
        <form onSubmit={handleAddContact} style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <input placeholder={tr("ledger.name")} value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input placeholder={tr("ledger.phoneNumber")} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          <button type="submit">{tr("ledger.save")}</button>
        </form>
      )}

      <div style={{ marginTop: 16 }}>
        {contacts.length === 0 && <p style={{ color: "#888" }}>{tr("ledger.noContacts")}</p>}
        {contacts.map((c) => (
          <div
            key={c.id}
            onClick={() => navigate(`/ledger/${c.id}`)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "12px 0",
              borderBottom: "1px solid #eee",
              cursor: "pointer",
            }}
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
    </div>
  );
}
