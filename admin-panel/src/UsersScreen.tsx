import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { colors, inputStyle, radius } from "./theme";
import { Avatar, Card, EmptyState, ErrorBanner, LoadingRows, PageHeading, SuccessBanner } from "./ui";
import { PhoneIcon, SearchIcon } from "./icons";

interface Profile {
  id: string;
  shop_name: string;
  owner_name: string;
  phone_number: string;
}

export default function UsersScreen() {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
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
      setProfiles([]);
      return;
    }
    setProfiles(data ?? []);
  }

  const filtered = (profiles ?? []).filter(
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
    <div>
      <PageHeading
        title="Users"
        right={
          <div style={{ position: "relative", width: 280, maxWidth: "100%" }}>
            <SearchIcon size={16} color={colors.textFaint} style={{ position: "absolute", insetInlineStart: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              placeholder="Search by shop, owner, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingInlineStart: 36 }}
            />
          </div>
        }
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {resetResult && (
        <SuccessBanner>
          <div>New password for {resetResult.phone}: <strong>{resetResult.password}</strong></div>
          <a href={waLink(resetResult.phone, resetResult.password)} target="_blank" rel="noreferrer" style={{ color: colors.success, fontWeight: 700 }}>
            Send via WhatsApp →
          </a>
        </SuccessBanner>
      )}

      {profiles === null && <LoadingRows count={4} />}
      {profiles !== null && filtered.length === 0 && (
        <EmptyState>{profiles.length === 0 ? "No active users yet." : "No matching users."}</EmptyState>
      )}

      {profiles !== null && filtered.length > 0 && (
        <Card style={{ padding: 4 }}>
          {filtered.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 12px", borderTop: i === 0 ? "none" : `1px solid ${colors.border}` }}>
              <Avatar label={p.shop_name} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: colors.textPrimary }}>{p.shop_name}</div>
                <div style={{ fontSize: 12.5, color: colors.textSecondary }}>{p.owner_name}</div>
                <div style={{ fontSize: 11.5, color: colors.textFaint, display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
                  <PhoneIcon size={11} /> {p.phone_number}
                </div>
              </div>
              <button
                disabled={busyId === p.id}
                onClick={() => resetPassword(p)}
                style={{ padding: "8px 14px", borderRadius: radius.md, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.primary, fontWeight: 600, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {busyId === p.id ? "…" : "Reset Password"}
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
