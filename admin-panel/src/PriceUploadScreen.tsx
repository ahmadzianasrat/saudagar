import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

interface Market {
  id: string;
  name_en: string;
}

interface Commodity {
  id: string;
  name_en: string;
  unit: string;
}

// The insert itself is gated server-side by the "staff write prices
// within allowed markets" RLS policy — this screen doesn't need to
// duplicate that check, but DOES filter the market dropdown to the
// logged-in admin's allowed_markets so they aren't shown markets they
// can't actually save to (a confusing empty-error otherwise).
export default function PriceUploadScreen() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [marketId, setMarketId] = useState("");
  const [commodityId, setCommodityId] = useState("");
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: admin } = await supabase
      .from("admin_users")
      .select("allowed_markets")
      .eq("id", userData.user.id)
      .single();

    const allowedIds = admin?.allowed_markets ?? [];

    const { data: marketRows } = await supabase
      .from("markets")
      .select("id, name_en")
      .in("id", allowedIds.length > 0 ? allowedIds : ["00000000-0000-0000-0000-000000000000"]);
    setMarkets(marketRows ?? []);

    const { data: commodityRows } = await supabase.from("commodities").select("id, name_en, unit");
    setCommodities(commodityRows ?? []);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { error } = await supabase.from("prices").insert({
      market_id: marketId,
      commodity_id: commodityId,
      price: Number(price),
      uploaded_by: userData.user.id,
    });

    if (error) {
      // A unique-constraint hit here means today's price for this
      // market+commodity was already uploaded — surface that plainly
      // rather than a raw Postgres error.
      setStatus(
        error.message.includes("duplicate")
          ? "Already uploaded today for this market/commodity — edit isn't wired up yet, delete the row in the dashboard if you need to correct it."
          : `Error: ${error.message}`
      );
      return;
    }

    setStatus("Saved.");
    setPrice("");
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Upload Today's Price</h2>
      {markets.length === 0 && <p style={{ color: "#b3261e" }}>You aren't assigned to any markets yet.</p>}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 8 }}>
        <select value={marketId} onChange={(e) => setMarketId(e.target.value)} required>
          <option value="">Select market</option>
          {markets.map((m) => (
            <option key={m.id} value={m.id}>{m.name_en}</option>
          ))}
        </select>
        <select value={commodityId} onChange={(e) => setCommodityId(e.target.value)} required>
          <option value="">Select commodity</option>
          {commodities.map((c) => (
            <option key={c.id} value={c.id}>{c.name_en} ({c.unit})</option>
          ))}
        </select>
        <input placeholder="Price (AFN)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} required />
        <button type="submit">Save Price</button>
      </form>
      {status && <p>{status}</p>}
    </div>
  );
}
