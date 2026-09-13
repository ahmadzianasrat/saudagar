import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { colors, inputStyle, radius } from "./theme";
import { Avatar, Card, EmptyState, ErrorBanner, LoadingRows, PageHeading, Pill, SuccessBanner } from "./ui";
import { CheckIcon, ClockIcon, PhoneIcon, SearchIcon, XIcon } from "./icons";

interface AccountRequest {
  id: string;
  owner_name: string;
  shop_name: string;
  phone_number: string;
  status: string;
  created_at: string;
}

export default function AccountRequestsScreen() {
  // `null` = "haven't loaded yet", distinct from `[]` = "loaded, and
  // there are none" — without this distinction the empty-state
  // message flashes on screen for a moment before real data arrives.
  const [requests, setRequests] = useState<AccountRequest[] | null>(null);
  const [approvedCreds, setApprovedCreds] = useState<Record<string, { phone: string; password: string }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("account_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("failed to load account_requests:", error);
      setActionError("Couldn't load requests — check the browser console for details.");
      setRequests([]);
      return;
    }
    setRequests(data ?? []);
  }

  async function callFunction(name: string, body: Record<string, unknown>) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

    // A non-OK response might not even be JSON (e.g. a CORS rejection
    // never reaches our function at all, or a gateway error page) —
    // guard the parse so a malformed response doesn't throw and skip
    // past the finally block that resets the busy state.
    let result: any;
    try {
      result = await response.json();
    } catch {
      throw new Error(`Unexpected response (status ${response.status}) — check that the ${name} function is deployed and CORS is configured.`);
    }

    if (!response.ok && !result?.error) {
      throw new Error(`Request failed (status ${response.status})`);
    }
    return result;
  }

  async function approve(request: AccountRequest) {
    setBusyId(request.id);
    setActionError(null);
    try {
      const result = await callFunction("admin-approve-account", { request_id: request.id });

      if (result.error) {
        setActionError(`Approval failed: ${result.error}${result.detail ? ` — ${result.detail}` : ""}`);
        return;
      }

      // Show the generated credentials so the admin can relay them —
      // by phone call or wa.me link — per the manual-verification /
      // manual-credential-delivery flow decided on earlier.
      setApprovedCreds((prev) => ({
        ...prev,
        [request.id]: { phone: result.login_phone, password: result.temp_password },
      }));
      setRequests((prev) => (prev ?? []).filter((r) => r.id !== request.id));
    } catch (err) {
      // Previously an error here (e.g. a CORS-blocked fetch throwing)
      // skipped straight past setBusyId(null), leaving both buttons
      // stuck disabled indefinitely with no visible explanation. The
      // finally block below guarantees that can't happen again, and
      // this catch surfaces the actual error instead of silence.
      console.error("approve() failed:", err);
      setActionError(err instanceof Error ? err.message : "Something went wrong approving this request.");
    } finally {
      setBusyId(null);
    }
  }

  async function decline(request: AccountRequest) {
    setBusyId(request.id);
    setActionError(null);
    try {
      await callFunction("admin-decline-account", { request_id: request.id });
      setRequests((prev) => (prev ?? []).filter((r) => r.id !== request.id));
    } catch (err) {
      console.error("decline() failed:", err);
      setActionError(err instanceof Error ? err.message : "Something went wrong declining this request.");
    } finally {
      setBusyId(null);
    }
  }

  function waLink(phone: string, password: string) {
    const text = encodeURIComponent(
      `Welcome to Saudagar! Log in with your phone number and this password: ${password}`
    );
    return `https://wa.me/${phone.replace(/\D/g, "")}?text=${text}`;
  }

  const filtered = (requests ?? []).filter(
    (r) =>
      r.shop_name.toLowerCase().includes(search.toLowerCase()) ||
      r.owner_name.toLowerCase().includes(search.toLowerCase()) ||
      r.phone_number.includes(search)
  );

  return (
    <div>
      <PageHeading
        title={`Account Requests${requests !== null ? ` (${requests.length})` : ""}`}
        right={
          <div style={{ position: "relative", width: 260, maxWidth: "100%" }}>
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

      {actionError && <ErrorBanner>{actionError}</ErrorBanner>}

      {Object.entries(approvedCreds).map(([id, cred]) => (
        <SuccessBanner key={id}>
          <div>Approved: {cred.phone}</div>
          <div>Temp password: <strong>{cred.password}</strong></div>
          <a href={waLink(cred.phone, cred.password)} target="_blank" rel="noreferrer" style={{ color: colors.success, fontWeight: 700 }}>
            Send via WhatsApp →
          </a>
        </SuccessBanner>
      ))}

      {requests === null && <LoadingRows count={4} />}

      {requests !== null && filtered.length === 0 && (
        <EmptyState>{requests.length === 0 ? "No pending account requests." : "No requests match your search."}</EmptyState>
      )}

      {requests !== null && filtered.length > 0 && (
        <Card style={{ padding: 4 }}>
          {filtered.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 12px", borderTop: i === 0 ? "none" : `1px solid ${colors.border}` }}>
              <Avatar label={r.shop_name} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: colors.textPrimary }}>{r.shop_name}</div>
                <div style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 1 }}>{r.owner_name}</div>
                <div style={{ fontSize: 12, color: colors.textFaint, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <PhoneIcon size={11} /> {r.phone_number}
                </div>
              </div>
              <Pill bg={colors.amberSoft} fg={colors.amber}>
                <ClockIcon size={11} /> Pending
              </Pill>
              <div style={{ fontSize: 11.5, color: colors.textFaint, minWidth: 80, textAlign: "end" }}>
                {new Date(r.created_at).toLocaleDateString()}
              </div>
              <button
                disabled={busyId === r.id}
                onClick={() => approve(r)}
                style={{ width: 34, height: 34, borderRadius: radius.pill, border: "none", background: colors.successSoft, color: colors.success, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                title="Approve"
              >
                <CheckIcon size={16} />
              </button>
              <button
                disabled={busyId === r.id}
                onClick={() => decline(r)}
                style={{ width: 34, height: 34, borderRadius: radius.pill, border: "none", background: colors.dangerSoft, color: colors.danger, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                title="Decline"
              >
                <XIcon size={16} />
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
