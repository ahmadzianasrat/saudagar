import type { FormEvent } from "react";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

// STUB — the "request access" onboarding flow decided on earlier:
// shop owner submits basic info, an admin reviews and approves/declines
// from the separate admin panel. No account exists in `profiles` until
// approved — this only writes to `account_requests`.
export default function RequestAccessScreen() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ ownerName: "", shopName: "", phoneNumber: "" });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // TODO: also collect market_id once a market picker exists — for
    // launch with a single market this can default to that market's id.
    await supabase.from("account_requests").insert({
      owner_name: form.ownerName,
      shop_name: form.shopName,
      phone_number: form.phoneNumber,
    });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div style={{ padding: 16 }}>
        <p>Your request is pending approval.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: 16, display: "grid", gap: 8 }}>
      <h2>Request Access</h2>
      <input
        placeholder="Owner name"
        value={form.ownerName}
        onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
      />
      <input
        placeholder="Shop name"
        value={form.shopName}
        onChange={(e) => setForm({ ...form, shopName: e.target.value })}
      />
      <input
        placeholder="Phone number"
        value={form.phoneNumber}
        onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
      />
      <button type="submit">Submit</button>
    </form>
  );
}
