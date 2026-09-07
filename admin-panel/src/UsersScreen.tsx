import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

interface Profile {
  id: string;
  shop_name: string;
  owner_name: string;
  phone_number: string;
}

export default function UsersScreen() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ phone: string; password: string } | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error: loadErr } = await supabase
      .from("profiles")
      .select("id, shop_name, owner_name, phone_number")
      .eq("status", "active")
      .order("shop_name");

    if (loadErr) {
      console.error("failed to load profiles:", loadErr);
      setError("Couldn't load users.");
      return;
    }
    setProfiles(data ?? []);
  }

  const filtered = profiles.filter(
    (p) =>
      p.shop_name.toLowerCase().includes(search.toLowerCase()) ||
      p.owner_name.toLowerCase().includes(search.toLowerCase()) ||
      p.phone_number.includes(search)
  );

  async function resetPassword(profile: Profile) {
    setBusyId(profile.id);
    setError(null);
    setResetResult(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ profile_id: profile.id }),
      });
      const result = await response.json();

      if (!response.ok || result.error) {
        setError(`Reset failed: ${result.error ?? "unknown error"}`);
        return;
      }

      setResetResult({ phone: result.phone_number, password: result.new_password });
    } catch (err) {
      console.error("reset password failed:", err);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  function waLink(phone: string, password: string) {
    const text = encodeURIComponent(`Your new Saudagar password is: ${password}`);
    return `https://wa.me/${phone.replace(/\D/g, "")}?text=${text}`;
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Users</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {resetResult && (
        <div style={{ background: "#e8f5e9", padding: 10, borderRadius: 8, marginBottom: 10 }}>
          <div>New password for {resetResult.phone}: <strong>{resetResult.password}</strong></div>
          <a href={waLink(resetResult.phone, resetResult.password)} target="_blank" rel="noreferrer">
            Send via WhatsApp
          </a>
        </div>
      )}

      <input
        placeholder="Search by shop, owner, or phone"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", padding: 8, marginBottom: 12 }}
      />

      {filtered.map((p) => (
        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #eee" }}>
          <div>
            <div><strong>{p.shop_name}</strong> — {p.owner_name}</div>
            <div style={{ fontSize: 12, color: "#999" }}>{p.phone_number}</div>
          </div>
          <button disabled={busyId === p.id} onClick={() => resetPassword(p)}>
            {busyId === p.id ? "..." : "Reset Password"}
          </button>
        </div>
      ))}
      {filtered.length === 0 && <p style={{ color: "#888" }}>No matching users.</p>}
    </div>
  );
}
