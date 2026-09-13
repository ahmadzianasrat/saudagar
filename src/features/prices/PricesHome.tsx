import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTranslation } from "../../i18n/useTranslation";
import { dateGroupLabel, timeAgo } from "../../lib/dateFormat";
import { colors, inputStyle } from "../../theme";
import { Card, DateGroupHeader, EmptyState, IconBadge } from "../../components/ui";
import { ArrowDownCircleIcon, ArrowUpCircleIcon, TrendingIcon } from "../../components/icons";

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
    <div style={{ padding: 16, paddingBottom: 28 }}>
      <h1 style={{ fontSize: 19, fontWeight: 700, color: colors.textPrimary, margin: "0 0 14px" }}>{tr("prices.recentActivity")}</h1>

      {markets.length > 1 && (
        <select value={selectedMarket} onChange={(e) => setSelectedMarket(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }}>
          {markets.map((m) => (
            <option key={m.id} value={m.id}>{m.name_en} ({m.city})</option>
          ))}
        </select>
      )}

      {prices.length === 0 && <EmptyState>{tr("prices.none")}</EmptyState>}

      {prices.length > 0 && (
        <Card style={{ padding: 4 }}>
          {prices.map((p, i) => {
            const groupLabel = dateGroupLabel(p.created_at, dateSystem, digitStyle, tr);
            const showHeader = groupLabel !== lastGroupLabel;
            lastGroupLabel = groupLabel;
            const change = p.change_from_previous;
            const up = (change ?? 0) >= 0;
            return (
              <div key={p.id}>
                {showHeader && <div style={{ padding: "6px 10px 0" }}><DateGroupHeader>{groupLabel}</DateGroupHeader></div>}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px", borderTop: showHeader || i === 0 ? "none" : `1px solid ${colors.border}` }}>
                  <IconBadge icon={<TrendingIcon size={18} />} bg={colors.primarySoft} fg={colors.primary} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: colors.textPrimary }}>{p.commodity_name}</div>
                    <div style={{ fontSize: 11, color: colors.textFaint }}>{timeAgo(p.created_at, tr)}</div>
                  </div>
                  <div style={{ textAlign: "end" }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: colors.textPrimary }}>{formatNumber(p.price)} AFN</div>
                    {change !== null && (
                      <div style={{ fontSize: 11, color: up ? colors.success : colors.danger, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2 }}>
                        {up ? <ArrowUpCircleIcon size={11} color={colors.success} /> : <ArrowDownCircleIcon size={11} color={colors.danger} />}
                        {up ? "+" : ""}{formatNumber(change)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
