import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useLanguage } from "../../contexts/LanguageContext";

interface Market {
  id: string;
  name_en: string;
  city: string;
}

interface PriceRow {
  commodity_id: string;
  commodity_name: string;
  price: number;
  price_date: string;
  change_from_previous: number | null;
}

// Multi-market support built in from launch even though only one
// market is live initially — the market picker just has one option
// today and more get added as the admin panel uploads them.
export default function PricesHome() {
  const { formatNumber } = useLanguage();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<string>("");
  const [prices, setPrices] = useState<PriceRow[]>([]);

  useEffect(() => {
    supabase.from("markets").select("id, name_en, city").eq("is_active", true).then(({ data }) => {
      setMarkets(data ?? []);
      if (data && data.length > 0) setSelectedMarket(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedMarket) return;
    loadPrices();
  }, [selectedMarket]);

  async function loadPrices() {
    const { data } = await supabase
      .from("prices")
      .select("commodity_id, price, price_date, change_from_previous, commodities(name_en)")
      .eq("market_id", selectedMarket)
      .order("price_date", { ascending: false });

    // Keep only the latest row per commodity.
    const latestByCommodity = new Map<string, PriceRow>();
    for (const row of data ?? []) {
      if (!latestByCommodity.has(row.commodity_id)) {
        latestByCommodity.set(row.commodity_id, {
          commodity_id: row.commodity_id,
          commodity_name: (row as any).commodities?.name_en ?? "",
          price: row.price,
          price_date: row.price_date,
          change_from_previous: row.change_from_previous,
        });
      }
    }
    setPrices(Array.from(latestByCommodity.values()));
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Today's Prices</h2>

      {markets.length > 1 && (
        <select value={selectedMarket} onChange={(e) => setSelectedMarket(e.target.value)} style={{ marginBottom: 12 }}>
          {markets.map((m) => (
            <option key={m.id} value={m.id}>{m.name_en} ({m.city})</option>
          ))}
        </select>
      )}

      {prices.length === 0 && <p style={{ color: "#888" }}>No prices uploaded yet for this market.</p>}

      {prices.map((p) => (
        <div key={p.commodity_id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #eee" }}>
          <div>
            <div>{p.commodity_name}</div>
            <div style={{ fontSize: 11, color: "#999" }}>{p.price_date}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div>{formatNumber(p.price)} AFN</div>
            {p.change_from_previous !== null && (
              <div style={{ fontSize: 11, color: p.change_from_previous >= 0 ? "#2e7d32" : "#b3261e" }}>
                {p.change_from_previous >= 0 ? "+" : ""}{formatNumber(p.change_from_previous)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
