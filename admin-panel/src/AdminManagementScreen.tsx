import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "./supabaseClient";
import { colors, inputStyle, primaryButtonStyle, radius, secondaryButtonStyle } from "./theme";
import { Avatar, Card, ErrorBanner, LoadingRows, PageHeading, Pill } from "./ui";
import { PhoneIcon, PlusIcon, ShieldIcon } from "./icons";

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
  const [admins, setAdmins] = useState<AdminUser[] | null>(null);
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
      setAdmins([]);
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
    <div>
      <PageHeading
        title="Admins"
        right={
          <button
            onClick={() => setShowCreate((v) => !v)}
            style={{ ...primaryButtonStyle, display: "flex", alignItems: "center", gap: 6 }}
          >
            <PlusIcon size={15} /> Create Admin
          </button>
        }
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {showCreate && (
        <Card style={{ maxWidth: 460, marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary, marginBottom: 12 }}>Create Admin</div>
          <form onSubmit={handleCreate} style={{ display: "grid", gap: 12 }}>
            <Field label="Full Name">
              <input placeholder="Enter full name" value={newName} onChange={(e) => setNewName(e.target.value)} required style={inputStyle} />
            </Field>
            <Field label="Email">
              <input placeholder="Enter email address" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required style={inputStyle} />
            </Field>
            <Field label="Phone (Optional)">
              <input placeholder="Enter phone number" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Password">
              <input placeholder="Enter password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required style={inputStyle} />
            </Field>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: colors.textPrimary }}>
              <input type="checkbox" checked={newCanApprove} onChange={(e) => setNewCanApprove(e.target.checked)} />
              Can approve accounts / manual payments
            </label>

            <div>
              <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 600 }}>Allowed markets (for price uploads)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {markets.map((m) => {
                  const checked = newMarkets.includes(m.id);
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setNewMarkets((prev) => (checked ? prev.filter((id) => id !== m.id) : [...prev, m.id]))}
                      style={{
                        padding: "6px 12px",
                        borderRadius: radius.pill,
                        border: `1px solid ${checked ? colors.primary : colors.border}`,
                        background: checked ? colors.primarySoft : colors.surface,
                        color: checked ? colors.primary : colors.textSecondary,
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {m.name_en}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={creating} style={{ ...primaryButtonStyle, flex: 1 }}>{creating ? "Creating..." : "Create Admin"}</button>
              <button type="button" onClick={() => setShowCreate(false)} style={{ ...secondaryButtonStyle, flex: 1 }}>Cancel</button>
            </div>
          </form>
        </Card>
      )}

      {admins === null && <LoadingRows count={3} />}

      {admins !== null && (
        <div style={{ display: "grid", gap: 12 }}>
          {admins.map((admin) => (
            <Card key={admin.id} style={{ opacity: admin.is_active ? 1 : 0.6 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <Avatar label={admin.name} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: colors.textPrimary }}>{admin.name}</div>
                    <Pill bg={admin.role === "super_admin" ? colors.primarySoft : colors.surfaceMuted} fg={admin.role === "super_admin" ? colors.primary : colors.textSecondary}>
                      <ShieldIcon size={10} /> {admin.role}
                    </Pill>
                    {!admin.is_active && <Pill bg={colors.dangerSoft} fg={colors.danger}>Deactivated</Pill>}
                  </div>
                  <div style={{ fontSize: 12, color: colors.textFaint, display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                    <PhoneIcon size={11} /> {admin.phone_number}
                  </div>

                  {admin.role !== "super_admin" && (
                    <div style={{ marginTop: 12 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: colors.textPrimary }}>
                        <input
                          type="checkbox"
                          checked={admin.can_approve_accounts}
                          disabled={busyId === admin.id}
                          onChange={() => toggleCanApprove(admin)}
                        />
                        Can approve accounts / manual payments
                      </label>

                      <div style={{ fontSize: 12, color: colors.textSecondary, margin: "10px 0 6px", fontWeight: 600 }}>Allowed markets</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {markets.map((m) => {
                          const checked = admin.allowed_markets?.includes(m.id) ?? false;
                          return (
                            <button
                              key={m.id}
                              disabled={busyId === admin.id}
                              onClick={() => toggleMarket(admin, m.id)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: radius.pill,
                                border: `1px solid ${checked ? colors.primary : colors.border}`,
                                background: checked ? colors.primarySoft : colors.surface,
                                color: checked ? colors.primary : colors.textSecondary,
                                fontSize: 12.5,
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              {m.name_en}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        disabled={busyId === admin.id}
                        onClick={() => toggleActive(admin)}
                        style={{
                          marginTop: 12,
                          padding: "8px 16px",
                          borderRadius: radius.md,
                          border: "none",
                          background: admin.is_active ? colors.dangerSoft : colors.successSoft,
                          color: admin.is_active ? colors.danger : colors.success,
                          fontWeight: 600,
                          fontSize: 12.5,
                          cursor: "pointer",
                        }}
                      >
                        {admin.is_active ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
                  )}
                  {admin.role === "super_admin" && (
                    <div style={{ fontSize: 12, color: colors.textFaint, marginTop: 8 }}>
                      Super admins automatically have full access to every market and approval permission — nothing to configure.
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12.5, fontWeight: 600, color: colors.textSecondary, marginBottom: 6, display: "block" }}>{label}</label>
      {children}
    </div>
  );
}
