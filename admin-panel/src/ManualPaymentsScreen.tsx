import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

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
  const [requests, setRequests] = useState<ManualPaymentRequest[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
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
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
    } catch (err) {
      console.error("reject manual payment failed:", err);
      setActionError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Manual Payment Claims ({requests.length})</h2>
      {actionError && (
        <p style={{ color: "crimson", background: "#fdecea", padding: 8, borderRadius: 6 }}>{actionError}</p>
      )}

      {requests.map((r) => (
        <div key={r.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div><strong>{r.shop_name}</strong> — {r.owner_name} ({r.phone_number})</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            {r.tier === "monthly" ? "Monthly" : "6 Months"} — {r.amount} AFN
          </div>
          {r.note && <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>"{r.note}"</div>}
          {imageUrls[r.id] && (
            <a href={imageUrls[r.id]} target="_blank" rel="noreferrer">
              <img src={imageUrls[r.id]} alt="Payment proof" style={{ maxWidth: 200, marginTop: 8, borderRadius: 6 }} />
            </a>
          )}
          <div style={{ fontSize: 11, color: "#999", marginTop: 6 }}>{new Date(r.created_at).toLocaleString()}</div>
          <div style={{ marginTop: 8 }}>
            <button disabled={busyId === r.id} onClick={() => approve(r)}>Approve</button>
            <button disabled={busyId === r.id} onClick={() => reject(r)} style={{ marginLeft: 8 }}>Reject</button>
          </div>
        </div>
      ))}

      {requests.length === 0 && <p style={{ color: "#888" }}>No pending manual payment claims.</p>}
    </div>
  );
}
