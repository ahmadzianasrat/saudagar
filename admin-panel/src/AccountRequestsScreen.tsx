import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

interface AccountRequest {
  id: string;
  owner_name: string;
  shop_name: string;
  phone_number: string;
  status: string;
  created_at: string;
}

export default function AccountRequestsScreen() {
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [approvedCreds, setApprovedCreds] = useState<Record<string, { phone: string; password: string }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("account_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
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
    return response.json();
  }

  async function approve(request: AccountRequest) {
    setBusyId(request.id);
    const result = await callFunction("admin-approve-account", { request_id: request.id });
    setBusyId(null);

    if (result.error) {
      alert(`Approval failed: ${result.error}`);
      return;
    }

    // Show the generated credentials so the admin can relay them —
    // by phone call or wa.me link — per the manual-verification /
    // manual-credential-delivery flow decided on earlier.
    setApprovedCreds((prev) => ({
      ...prev,
      [request.id]: { phone: result.login_phone, password: result.temp_password },
    }));
    setRequests((prev) => prev.filter((r) => r.id !== request.id));
  }

  async function decline(request: AccountRequest) {
    setBusyId(request.id);
    await callFunction("admin-decline-account", { request_id: request.id });
    setBusyId(null);
    setRequests((prev) => prev.filter((r) => r.id !== request.id));
  }

  function waLink(phone: string, password: string) {
    const text = encodeURIComponent(
      `Welcome to Saudagar! Log in with your phone number and this password: ${password}`
    );
    return `https://wa.me/${phone.replace(/\D/g, "")}?text=${text}`;
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Pending Requests ({requests.length})</h2>

      {Object.entries(approvedCreds).map(([id, cred]) => (
        <div key={id} style={{ background: "#e8f5e9", padding: 10, borderRadius: 8, marginBottom: 8 }}>
          <div>Approved: {cred.phone}</div>
          <div>Temp password: <strong>{cred.password}</strong></div>
          <a href={waLink(cred.phone, cred.password)} target="_blank" rel="noreferrer">
            Send via WhatsApp
          </a>
        </div>
      ))}

      {requests.map((r) => (
        <div key={r.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 8 }}>
          <div><strong>{r.shop_name}</strong> — {r.owner_name}</div>
          <div>{r.phone_number}</div>
          <div style={{ fontSize: 11, color: "#999" }}>{new Date(r.created_at).toLocaleString()}</div>
          <div style={{ marginTop: 8 }}>
            <button disabled={busyId === r.id} onClick={() => approve(r)}>Approve</button>
            <button disabled={busyId === r.id} onClick={() => decline(r)} style={{ marginLeft: 8 }}>
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
