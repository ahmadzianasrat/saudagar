import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { colors, radius } from "./theme";
import { Avatar, Card, EmptyState, ErrorBanner, LoadingRows, PageHeading, Pill, SuccessBanner } from "./ui";
import { CheckIcon, ClockIcon, PhoneIcon, XIcon } from "./icons";

interface ManualPaymentRequest {
  id: string;
  profile_id: string;
  tier: string;
  amount: number;
  note: string | null;
  proof_image_path: string | null;
  created_at: string;
  shop_name?: string;
  owner_name?: string;
  phone_number?: string;
}

export default function ManualPaymentsScreen() {
  const [requests, setRequests] = useState<ManualPaymentRequest[] | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastApproved, setLastApproved] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("manual_payment_requests")
      .select("*, profiles(shop_name, owner_name, phone_number)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("failed to load manual payment requests:", error);
      setActionError("Couldn't load requests.");
      setRequests([]);
      return;
    }

    const withProfile = (data ?? []).map((r: any) => ({
      ...r,
      shop_name: r.profiles?.shop_name,
      owner_name: r.profiles?.owner_name,
      phone_number: r.profiles?.phone_number,
    }));
    setRequests(withProfile);

    // Generate short-lived signed URLs for any attached proof images —
    // the bucket is private, so a plain public URL won't work.
    for (const r of withProfile) {
      if (r.proof_image_path) {
        const { data: signed } = await supabase.storage
          .from("payment-proofs")
          .createSignedUrl(r.proof_image_path, 3600);
        if (signed?.signedUrl) {
          setImageUrls((prev) => ({ ...prev, [r.id]: signed.signedUrl }));
        }
      }
    }
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

  async function approve(request: ManualPaymentRequest) {
    setBusyId(request.id);
    setActionError(null);
    try {
      const result = await callFunction("admin-approve-manual-payment", { request_id: request.id });
      if (result.error) {
        setActionError(`Approval failed: ${result.error}`);
        return;
      }
      setLastApproved(request.shop_name ?? "Shop");
      setRequests((prev) => (prev ?? []).filter((r) => r.id !== request.id));
    } catch (err) {
      console.error("approve manual payment failed:", err);
      setActionError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(request: ManualPaymentRequest) {
    setBusyId(request.id);
    setActionError(null);
    try {
      await callFunction("admin-reject-manual-payment", { request_id: request.id });
      setRequests((prev) => (prev ?? []).filter((r) => r.id !== request.id));
    } catch (err) {
      console.error("reject manual payment failed:", err);
      setActionError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeading title={`Manual Payment Claims${requests !== null ? ` (${requests.length})` : ""}`} />

      {actionError && <ErrorBanner>{actionError}</ErrorBanner>}
      {lastApproved && <SuccessBanner>Payment approved for {lastApproved} — their subscription is now active.</SuccessBanner>}

      {requests === null && <LoadingRows count={3} />}
      {requests !== null && requests.length === 0 && <EmptyState>No pending manual payment claims.</EmptyState>}

      {requests !== null && requests.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {requests.map((r) => (
            <Card key={r.id}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <Avatar label={r.shop_name ?? "?"} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: colors.textPrimary }}>{r.shop_name}</div>
                    <Pill bg={colors.amberSoft} fg={colors.amber}><ClockIcon size={11} /> Pending</Pill>
                  </div>
                  <div style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }}>
                    {r.owner_name} · <PhoneIcon size={10} style={{ verticalAlign: "middle" }} /> {r.phone_number}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 8, color: colors.textPrimary, fontWeight: 600 }}>
                    {r.tier === "monthly" ? "Monthly" : "6 Months"} — {r.amount} AFN
                  </div>
                  {r.note && <div style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 4, fontStyle: "italic" }}>"{r.note}"</div>}
                  {imageUrls[r.id] && (
                    <a href={imageUrls[r.id]} target="_blank" rel="noreferrer">
                      <img src={imageUrls[r.id]} alt="Payment proof" style={{ maxWidth: 180, marginTop: 8, borderRadius: radius.sm, display: "block" }} />
                    </a>
                  )}
                  <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 8 }}>{new Date(r.created_at).toLocaleString()}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => approve(r)}
                    style={{ width: 34, height: 34, borderRadius: radius.pill, border: "none", background: colors.successSoft, color: colors.success, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                    title="Approve"
                  >
                    <CheckIcon size={16} />
                  </button>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => reject(r)}
                    style={{ width: 34, height: 34, borderRadius: radius.pill, border: "none", background: colors.dangerSoft, color: colors.danger, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                    title="Reject"
                  >
                    <XIcon size={16} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
