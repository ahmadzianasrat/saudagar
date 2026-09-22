import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getShopContext } from "../../lib/authSession";
import { cachedQuery } from "../../lib/offlineQueue";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTranslation } from "../../i18n/useTranslation";
import { colors, radius } from "../../theme";
import { Card, LoadingRows, SectionLabel, SegmentedControl } from "../../components/ui";
import type { Currency } from "../../contexts/LanguageContext";

type Period = "week" | "month" | "year";

interface LedgerEntryRow {
  entry_type: "credit" | "debit";
  amount: number;
  currency: Currency;
  entry_date: string;
  counterparty_id: string;
}

interface CounterpartyNameRow {
  id: string;
  name: string;
}

interface InventoryTxRow {
  transaction_type: "purchase" | "sale" | "adjustment";
  quantity: number;
  unit_cost: number | null;
  transport_cost: number;
  porter_fee: number;
  created_at: string;
  inventory_item_id: string;
}

interface ItemMetaRow {
  id: string;
  commodity_name?: string;
}

// Calendar-aligned range starts (Monday for week, 1st for month/year)
// in the DEVICE's local time — matches how a shop owner would think
// about "this week" rather than a rolling 7/30/365-day window.
function periodStart(period: Period): Date {
  const now = new Date();
  if (period === "week") {
    const day = now.getDay(); // 0 = Sunday
    const diff = day === 0 ? 6 : day - 1; // days since Monday
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    return start;
  }
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return new Date(now.getFullYear(), 0, 1);
}

export default function ReportsScreen() {
  const { tr } = useTranslation();
  const { formatNumber, currencyLabel } = useLanguage();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("week");
  const [entries, setEntries] = useState<LedgerEntryRow[] | null>(null);
  const [contactNames, setContactNames] = useState<Map<string, string>>(new Map());
  const [transactions, setTransactions] = useState<InventoryTxRow[] | null>(null);
  const [itemMeta, setItemMeta] = useState<Map<string, ItemMetaRow>>(new Map());

  useEffect(() => {
    getShopContext().then(({ shopProfileId }) => {
      if (shopProfileId) setProfileId(shopProfileId);
    });
  }, []);

  useEffect(() => {
    if (!profileId) return;
    load();
  }, [profileId]);

  async function load() {
    // Reports load everything once (not scoped to the period query-side)
    // and filter client-side when the period toggle changes — keeps
    // this working from the same cached data offline, and avoids a
    // fresh network round-trip every time someone taps Week/Month/Year.
    const { data: entryRows } = await cachedQuery<LedgerEntryRow[]>(`reports:ledger:${profileId}`, () =>
      supabase
        .from("ledger_entries")
        .select("entry_type, amount, currency, entry_date, counterparty_id")
        .eq("profile_id", profileId)
    );
    setEntries(entryRows ?? []);

    const { data: contactRows } = await cachedQuery<CounterpartyNameRow[]>(`reports:contacts:${profileId}`, () =>
      supabase.from("counterparties").select("id, name").eq("owner_profile_id", profileId)
    );
    setContactNames(new Map((contactRows ?? []).map((c) => [c.id, c.name])));

    const { data: itemRows } = await cachedQuery<{ id: string; commodities: { name_en: string } | { name_en: string }[] | null }[]>(
      `reports:item-meta:${profileId}`,
      () => supabase.from("inventory_items").select("id, commodities(name_en)").eq("profile_id", profileId)
    );
    const itemIds = (itemRows ?? []).map((r) => r.id);
    setItemMeta(
      new Map(
        (itemRows ?? []).map((r) => {
          const commodity = Array.isArray(r.commodities) ? r.commodities[0] : r.commodities;
          return [r.id, { id: r.id, commodity_name: commodity?.name_en }];
        })
      )
    );

    if (itemIds.length === 0) {
      setTransactions([]);
      return;
    }

    const { data: txRows } = await cachedQuery<InventoryTxRow[]>(`reports:inventory-tx:${profileId}`, () =>
      supabase
        .from("inventory_transactions")
        .select("transaction_type, quantity, unit_cost, transport_cost, porter_fee, created_at, inventory_item_id")
        .in("inventory_item_id", itemIds)
    );
    setTransactions(txRows ?? []);
  }

  const loading = entries === null || transactions === null;
  const start = periodStart(period);

  const periodEntries = (entries ?? []).filter((e) => new Date(e.entry_date) >= start);
  const periodTx = (transactions ?? []).filter((t) => new Date(t.created_at) >= start);

  // ---- Ledger totals, per currency ----
  const ledgerTotals: Record<Currency, { given: number; received: number; count: number }> = {
    AFN: { given: 0, received: 0, count: 0 },
    PKR: { given: 0, received: 0, count: 0 },
  };
  for (const e of periodEntries) {
    const bucket = ledgerTotals[e.currency];
    if (e.entry_type === "credit") bucket.given += e.amount;
    else bucket.received += e.amount;
    bucket.count += 1;
  }

  // ---- Top contacts by total activity (given + received), this period ----
  const contactActivity = new Map<string, number>();
  for (const e of periodEntries) {
    contactActivity.set(e.counterparty_id, (contactActivity.get(e.counterparty_id) ?? 0) + e.amount);
  }
  const topContacts = Array.from(contactActivity.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, total]) => ({ name: contactNames.get(id) ?? "—", total }));

  // ---- Inventory totals (AFN-equivalent, matching avg-cost basis) ----
  let purchasesValue = 0;
  let salesValue = 0;
  let purchaseCount = 0;
  let saleCount = 0;
  const commodityVolume = new Map<string, number>();
  for (const t of periodTx) {
    const qty = Math.abs(t.quantity);
    const commodityName = itemMeta.get(t.inventory_item_id)?.commodity_name ?? "—";
    if (t.transaction_type === "purchase") {
      purchasesValue += (t.unit_cost ?? 0) * qty + t.transport_cost + t.porter_fee;
      purchaseCount += 1;
      commodityVolume.set(commodityName, (commodityVolume.get(commodityName) ?? 0) + qty);
    } else if (t.transaction_type === "sale") {
      salesValue += (t.unit_cost ?? 0) * qty;
      saleCount += 1;
      commodityVolume.set(commodityName, (commodityVolume.get(commodityName) ?? 0) + qty);
    }
  }
  const topCommodities = Array.from(commodityVolume.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div style={{ padding: 16, paddingBottom: 28 }}>
      <h1 style={{ fontSize: 19, fontWeight: 700, color: colors.textPrimary, margin: "0 0 16px" }}>{tr("reports.title")}</h1>

      <SegmentedControl
        value={period}
        onChange={setPeriod}
        options={[
          { value: "week" as Period, label: tr("reports.week") },
          { value: "month" as Period, label: tr("reports.month") },
          { value: "year" as Period, label: tr("reports.year") },
        ]}
      />

      {loading && <div style={{ marginTop: 16 }}><LoadingRows count={4} /></div>}

      {!loading && (
        <>
          <section style={{ marginTop: 20 }}>
            <SectionLabel>{tr("reports.ledgerSection")}</SectionLabel>
            <Card>
              {(["AFN", "PKR"] as Currency[])
                .filter((c) => ledgerTotals[c].count > 0)
                .map((c) => {
                  const t = ledgerTotals[c];
                  const net = t.given - t.received;
                  return (
                    <div key={c} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textSecondary, marginBottom: 6 }}>{currencyLabel(c)}</div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <StatBlock label={tr("ledger.given")} value={formatNumber(t.given)} tone="success" />
                        <StatBlock label={tr("ledger.received")} value={formatNumber(t.received)} tone="danger" />
                        <StatBlock label={tr("reports.net")} value={`${net < 0 ? "-" : ""}${formatNumber(Math.abs(net))}`} tone={net >= 0 ? "success" : "danger"} />
                      </div>
                    </div>
                  );
                })}
              {ledgerTotals.AFN.count === 0 && ledgerTotals.PKR.count === 0 && (
                <div style={{ fontSize: 12.5, color: colors.textFaint }}>{tr("reports.noActivity")}</div>
              )}
            </Card>
          </section>

          {topContacts.length > 0 && (
            <section style={{ marginTop: 16 }}>
              <SectionLabel>{tr("reports.topContacts")}</SectionLabel>
              <Card style={{ padding: 4 }}>
                {topContacts.map((c, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 10px", borderTop: i === 0 ? "none" : `1px solid ${colors.border}` }}>
                    <span style={{ fontSize: 13, color: colors.textPrimary }}>{c.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>{formatNumber(c.total)}</span>
                  </div>
                ))}
              </Card>
            </section>
          )}

          <section style={{ marginTop: 16 }}>
            <SectionLabel>{tr("reports.inventorySection")}</SectionLabel>
            <Card>
              <div style={{ display: "flex", gap: 10 }}>
                <StatBlock label={tr("reports.purchases")} value={formatNumber(purchasesValue)} tone="danger" sub={`${purchaseCount} ${tr("reports.entries")}`} />
                <StatBlock label={tr("reports.sales")} value={formatNumber(salesValue)} tone="success" sub={`${saleCount} ${tr("reports.entries")}`} />
                <StatBlock
                  label={tr("reports.net")}
                  value={`${salesValue - purchasesValue < 0 ? "-" : ""}${formatNumber(Math.abs(salesValue - purchasesValue))}`}
                  tone={salesValue - purchasesValue >= 0 ? "success" : "danger"}
                />
              </div>
              {purchaseCount === 0 && saleCount === 0 && (
                <div style={{ fontSize: 12.5, color: colors.textFaint, marginTop: 4 }}>{tr("reports.noActivity")}</div>
              )}
            </Card>
          </section>

          {topCommodities.length > 0 && (
            <section style={{ marginTop: 16 }}>
              <SectionLabel>{tr("reports.topCommodities")}</SectionLabel>
              <Card style={{ padding: 4 }}>
                {topCommodities.map(([name, qty], i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 10px", borderTop: i === 0 ? "none" : `1px solid ${colors.border}` }}>
                    <span style={{ fontSize: 13, color: colors.textPrimary }}>{name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>{formatNumber(qty)}</span>
                  </div>
                ))}
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function StatBlock({ label, value, tone, sub }: { label: string; value: string; tone: "success" | "danger"; sub?: string }) {
  return (
    <div style={{ flex: 1, background: colors.surfaceMuted, borderRadius: radius.md, padding: "10px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 10.5, color: colors.textSecondary, fontWeight: 600, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: tone === "success" ? colors.success : colors.danger }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: colors.textFaint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
