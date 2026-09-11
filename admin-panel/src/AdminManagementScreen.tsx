import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "./supabaseClient";

interface AdminUser {
  id: string;
  name: string;
  phone_number: string;
  role: "super_admin" | "staff";
  can_approve_accounts: boolean;
  allowed_markets: string[];
  is_active: boolean;
}

interface Market {
  id: string;
  name_en: string;
}

export default function AdminManagementScreen() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCanApprove, setNewCanApprove] = useState(false);
  const [newMarkets, setNewMarkets] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: adminRows, error: adminErr } = await supabase.from("admin_users").select("*").order("name");
    if (adminErr) {
      console.error("failed to load admins:", adminErr);
      setError("Couldn't load admins.");
      return;
    }
    setAdmins(adminRows ?? []);

    const { data: marketRows } = await supabase.from("markets").select("id, name_en");
    setMarkets(marketRows ?? []);
  }

  async function callFunction(name: string, body: Record<string, unknown>) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    let result: any;
    try {
      result = await response.json();
    } catch {
      throw new Error(`Unexpected response (status ${response.status}) from ${name}.`);
    }
    if (!response.ok && !result?.error) {
      throw new Error(`Request failed (status ${response.status})`);
    }
    return result;
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const result = await callFunction("admin-create-admin", {
        email: newEmail,
        password: newPassword,
        name: newName,
        phone_number: newPhone,
        role: "staff",
        can_approve_accounts: newCanApprove,
        allowed_markets: newMarkets,
      });
      if (result.error) {
        setError(`Create failed: ${result.error}`);
        return;
      }
      setNewEmail("");
      setNewPassword("");
      setNewName("");
      setNewPhone("");
      setNewCanApprove(false);
      setNewMarkets([]);
      setShowCreate(false);
      load();
    } catch (err) {
      console.error("create admin failed:", err);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setCreating(false);
    }
  }

  async function toggleCanApprove(admin: AdminUser) {
    setBusyId(admin.id);
    try {
      await callFunction("admin-update-admin", { admin_id: admin.id, can_approve_accounts: !admin.can_approve_accounts });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleMarket(admin: AdminUser, marketId: string) {
    const current = admin.allowed_markets ?? [];
    const updated = current.includes(marketId) ? current.filter((m) => m !== marketId) : [...current, marketId];
    setBusyId(admin.id);
    try {
      await callFunction("admin-update-admin", { admin_id: admin.id, allowed_markets: updated });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(admin: AdminUser) {
    setBusyId(admin.id);
    try {
      await callFunction("admin-update-admin", { admin_id: admin.id, is_active: !admin.is_active });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Admins</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <button onClick={() => setShowCreate((v) => !v)} style={{ marginBottom: 12 }}>
        + Create Admin
      </button>

      {showCreate && (
        <form onSubmit={handleCreate} style={{ display: "grid", gap: 8, marginBottom: 16, border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
          <input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          <input placeholder="Phone number" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          <input placeholder="Email (for login)" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
          <input placeholder="Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          <label>
            <input type="checkbox" checked={newCanApprove} onChange={(e) => setNewCanApprove(e.target.checked)} /> Can approve accounts / manual payments
          </label>
          <div style={{ fontSize: 12, color: "#888" }}>Allowed markets (for price uploads):</div>
          {markets.map((m) => (
            <label key={m.id} style={{ fontSize: 13 }}>
              <input
                type="checkbox"
                checked={newMarkets.includes(m.id)}
                onChange={(e) =>
                  setNewMarkets((prev) => (e.target.checked ? [...prev, m.id] : prev.filter((id) => id !== m.id)))
                }
              />{" "}
              {m.name_en}
            </label>
          ))}
          <button type="submit" disabled={creating}>{creating ? "Creating..." : "Create"}</button>
        </form>
      )}

      {admins.map((admin) => (
        <div key={admin.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 10, opacity: admin.is_active ? 1 : 0.5 }}>
          <div>
            <strong>{admin.name}</strong> ({admin.role})
            {!admin.is_active && <span style={{ color: "crimson", fontSize: 12 }}> — deactivated</span>}
          </div>
          <div style={{ fontSize: 12, color: "#999" }}>{admin.phone_number}</div>

          {admin.role !== "super_admin" && (
            <>
              <label style={{ display: "block", marginTop: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={admin.can_approve_accounts}
                  disabled={busyId === admin.id}
                  onChange={() => toggleCanApprove(admin)}
                />{" "}
                Can approve accounts / manual payments
              </label>
              <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Allowed markets:</div>
              {markets.map((m) => (
                <label key={m.id} style={{ fontSize: 13, display: "block" }}>
                  <input
                    type="checkbox"
                    checked={admin.allowed_markets?.includes(m.id) ?? false}
                    disabled={busyId === admin.id}
                    onChange={() => toggleMarket(admin, m.id)}
                  />{" "}
                  {m.name_en}
                </label>
              ))}
              <button disabled={busyId === admin.id} onClick={() => toggleActive(admin)} style={{ marginTop: 8 }}>
                {admin.is_active ? "Deactivate" : "Reactivate"}
              </button>
            </>
          )}
          {admin.role === "super_admin" && (
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
              Super admins automatically have full access to every market and approval permission — nothing to configure.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
