import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { colors, inputStyle, primaryButtonStyle, radius } from "./theme";
import { Card, EmptyState, ErrorBanner, LoadingRows, PageHeading, SuccessBanner } from "./ui";
import { TrendingIcon } from "./icons";

interface Market {
  id: string;
  name_en: string;
}

interface Commodity {
  id: string;
  name_en: string;
  unit: string;
}

interface RecentPrice {
  id: string;
  price: number;
  created_at: string;
  market_name: string;
  commodity_name: string;
}

// The insert itself is gated server-side by the "staff write prices
// within allowed markets" RLS policy — this screen doesn't need to
// duplicate that check, but DOES filter the market dropdown to the
// logged-in admin's allowed_markets so they aren't shown markets they
// can't actually save to (a confusing empty-error otherwise).
export default function PriceUploadScreen() {
  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [recentPrices, setRecentPrices] = useState<RecentPrice[] | null>(null);
  const [marketId, setMarketId] = useState("");
  const [commodityId, setCommodityId] = useState("");
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMarkets([]);
      setRecentPrices([]);
      return;
    }

    const { data: admin } = await supabase
      .from("admin_users")
      .select("allowed_markets, role")
      .eq("id", userData.user.id)
      .single();

    // Super admins see every market, not just their allowed_markets
    // array — automatic full authority, no manual assignment needed.
    let marketRows: Market[] = [];
    if (admin?.role === "super_admin") {
      const { data: allMarkets } = await supabase.from("markets").select("id, name_en");
      marketRows = allMarkets ?? [];
    } else {
      const allowedIds = admin?.allowed_markets ?? [];
      const { data: rows } = await supabase
        .from("markets")
        .select("id, name_en")
        .in("id", allowedIds.length > 0 ? allowedIds : ["00000000-0000-0000-0000-000000000000"]);
      marketRows = rows ?? [];
    }
    setMarkets(marketRows);

    const { data: commodityRows } = await supabase.from("commodities").select("id, name_en, unit");
    setCommodities(commodityRows ?? []);

    await loadRecentPrices(marketRows.map((m) => m.id));
  }

  async function loadRecentPrices(marketIds: string[]) {
    if (marketIds.length === 0) {
      setRecentPrices([]);
      return;
    }
    const { data, error } = await supabase
      .from("prices")
      .select("id, price, created_at, markets(name_en), commodities(name_en)")
      .in("market_id", marketIds)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("failed to load recent prices:", error);
      setRecentPrices([]);
      return;
    }

    setRecentPrices(
      (data ?? []).map((row: any) => ({
        id: row.id,
        price: row.price,
        created_at: row.created_at,
        market_name: row.markets?.name_en ?? "—",
        commodity_name: row.commodities?.name_en ?? "—",
      }))
    );
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
      setStatus({
        kind: "error",
        text: error.message.includes("duplicate")
          ? "Already uploaded today for this market/commodity — edit isn't wired up yet, delete the row in the dashboard if you need to correct it."
          : `Error: ${error.message}`,
      });
      return;
    }

    setStatus({ kind: "ok", text: "Price saved." });
    setPrice("");
    loadRecentPrices((markets ?? []).map((m) => m.id));
  }

  return (
    <div>
      <PageHeading title="Upload Today's Price" />

      {markets !== null && markets.length === 0 && <ErrorBanner>You aren't assigned to any markets yet.</ErrorBanner>}

      <Card style={{ maxWidth: 420 }}>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          {status && (status.kind === "ok" ? <SuccessBanner>{status.text}</SuccessBanner> : <ErrorBanner>{status.text}</ErrorBanner>)}
          <select value={marketId} onChange={(e) => setMarketId(e.target.value)} required style={inputStyle}>
            <option value="">Select market</option>
            {(markets ?? []).map((m) => (
              <option key={m.id} value={m.id}>{m.name_en}</option>
            ))}
          </select>
          <select value={commodityId} onChange={(e) => setCommodityId(e.target.value)} required style={inputStyle}>
            <option value="">Select commodity</option>
            {commodities.map((c) => (
              <option key={c.id} value={c.id}>{c.name_en} ({c.unit})</option>
            ))}
          </select>
          <input placeholder="Price (AFN)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} required style={inputStyle} />
          <button type="submit" style={{ ...primaryButtonStyle, width: "100%", padding: "11px 16px" }}>Save Price</button>
        </form>
      </Card>

      <div style={{ fontSize: 13, fontWeight: 700, color: colors.textSecondary, margin: "22px 0 8px" }}>Recent Prices</div>

      {recentPrices === null && <LoadingRows count={4} />}
      {recentPrices !== null && recentPrices.length === 0 && <EmptyState>No prices uploaded yet.</EmptyState>}
      {recentPrices !== null && recentPrices.length > 0 && (
        <Card style={{ padding: 4 }}>
          {recentPrices.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderTop: i === 0 ? "none" : `1px solid ${colors.border}` }}>
              <div style={{ width: 34, height: 34, borderRadius: radius.md, background: colors.primarySoft, color: colors.primary, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <TrendingIcon size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: colors.textPrimary }}>{r.commodity_name}</div>
                <div style={{ fontSize: 11.5, color: colors.textFaint }}>{r.market_name}</div>
              </div>
              <div style={{ textAlign: "end" }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: colors.textPrimary }}>{r.price} AFN</div>
                <div style={{ fontSize: 11, color: colors.textFaint }}>{new Date(r.created_at).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
