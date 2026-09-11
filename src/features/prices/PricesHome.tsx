import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTranslation } from "../../i18n/useTranslation";
import { dateGroupLabel, timeAgo } from "../../lib/dateFormat";

const RECENT_LIMIT = 10;

interface Market {
  id: string;
  name_en: string;
  city: string;
}

interface PriceRow {
  id: string;
  commodity_id: string;
  commodity_name: string;
  price: number;
  price_date: string;
  created_at: string;
  change_from_previous: number | null;
}

// Shows the RECENT PRICE ACTIVITY feed (last 10 upload events across
// all commodities for the selected market) rather than collapsing to
// a single "today's price" per commodity — this surfaces the actual
// history/trend of uploads, not just the latest snapshot.
export default function PricesHome() {
  const { formatNumber, dateSystem, digitStyle } = useLanguage();
  const { tr } = useTranslation();
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
      .select("id, commodity_id, price, price_date, created_at, change_from_previous, commodities(name_en)")
      .eq("market_id", selectedMarket)
      .order("created_at", { ascending: false })
      .limit(RECENT_LIMIT);

    setPrices(
      (data ?? []).map((row: any) => ({
        id: row.id,
        commodity_id: row.commodity_id,
        commodity_name: row.commodities?.name_en ?? "",
        price: row.price,
        price_date: row.price_date,
        created_at: row.created_at,
        change_from_previous: row.change_from_previous,
      }))
    );
  }

  let lastGroupLabel: string | null = null;

  return (
    <div style={{ padding: 16 }}>
      <h2>{tr("prices.recentActivity")}</h2>

      {markets.length > 1 && (
        <select value={selectedMarket} onChange={(e) => setSelectedMarket(e.target.value)} style={{ marginBottom: 12 }}>
          {markets.map((m) => (
            <option key={m.id} value={m.id}>{m.name_en} ({m.city})</option>
          ))}
        </select>
      )}

      {prices.length === 0 && <p style={{ color: "#888" }}>{tr("prices.none")}</p>}

      {prices.map((p) => {
        const groupLabel = dateGroupLabel(p.created_at, dateSystem, digitStyle, tr);
        const showHeader = groupLabel !== lastGroupLabel;
        lastGroupLabel = groupLabel;
        return (
          <div key={p.id}>
            {showHeader && (
              <div style={{ fontSize: 12, color: "#1e6f5c", fontWeight: 500, marginTop: 10, marginBottom: 2 }}>
                {groupLabel}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #eee" }}>
              <div>
                <div>{p.commodity_name}</div>
                <div style={{ fontSize: 11, color: "#999" }}>{timeAgo(p.created_at, tr)}</div>
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
          </div>
        );
      })}
    </div>
  );
}
