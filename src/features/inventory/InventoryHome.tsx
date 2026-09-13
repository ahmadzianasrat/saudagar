import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { enqueueWrite, getSyncStatus } from "../../lib/offlineQueue";
import { generateClientId } from "../../lib/uuid";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTranslation } from "../../i18n/useTranslation";
import { dateGroupLabel, formatDateTime, timeAgo } from "../../lib/dateFormat";
import Pagination from "../../components/Pagination";
import { colors, inputStyle, primaryButtonStyle, radius, secondaryButtonStyle } from "../../theme";
import { Card, DateGroupHeader, EmptyState, IconBadge, Pill, SectionLabel, SyncDot } from "../../components/ui";
import { ArrowDownCircleIcon, ArrowUpCircleIcon, BoxIcon, PencilIcon, PlusIcon, SwapIcon, TrendingIcon } from "../../components/icons";

const PAGE_SIZE = 10;

interface Commodity {
  id: string;
  name_en: string;
  unit: string;
}

interface InventoryItem {
  id: string;
  commodity_id: string;
  quantity: number;
  avg_cost_per_unit: number;
  total_cost: number;
  commodity_name?: string;
  unit?: string;
  todayPrice?: number | null;
}

interface TransactionRow {
  id: string;
  client_id: string;
  inventory_item_id: string;
  commodity_name?: string;
  unit?: string;
  transaction_type: "purchase" | "sale" | "adjustment";
  quantity: number;
  unit_cost: number | null;
  transport_cost: number;
  porter_fee: number;
  created_at: string;
  syncStatus?: "pending" | "synced" | "not_found";
}

const TX_ICON: Record<TransactionRow["transaction_type"], typeof ArrowDownCircleIcon> = {
  purchase: ArrowDownCircleIcon,
  sale: ArrowUpCircleIcon,
  adjustment: SwapIcon,
};
const TX_COLOR: Record<TransactionRow["transaction_type"], string> = {
  purchase: colors.success,
  sale: colors.danger,
  adjustment: colors.purple,
};

export default function InventoryHome() {
  const { formatNumber, dateSystem, digitStyle } = useLanguage();
  const { tr } = useTranslation();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [allTransactions, setAllTransactions] = useState<TransactionRow[]>([]);
  const [txPage, setTxPage] = useState(1);

  const [showAddTransaction, setShowAddTransaction] = useState<string | null>(null);
  const [txType, setTxType] = useState<"purchase" | "sale" | "adjustment">("purchase");
  const [txQuantity, setTxQuantity] = useState("");
  const [txUnitCost, setTxUnitCost] = useState("");
  const [txTransportCost, setTxTransportCost] = useState("");
  const [txPorterFee, setTxPorterFee] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Transaction editing
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editTxType, setEditTxType] = useState<"purchase" | "sale" | "adjustment">("purchase");
  const [editTxQuantity, setEditTxQuantity] = useState("");
  const [editTxUnitCost, setEditTxUnitCost] = useState("");
  const [editTxTransportCost, setEditTxTransportCost] = useState("");
  const [editTxPorterFee, setEditTxPorterFee] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setProfileId(data.user.id);
    });
    supabase.from("commodities").select("id, name_en, unit").then(({ data, error: commErr }) => {
      if (commErr) {
        console.error("failed to load commodities:", commErr);
        setError("Couldn't load commodities.");
        return;
      }
      setCommodities(data ?? []);
    });
  }, []);

  useEffect(() => {
    if (profileId) {
      loadItems();
      loadTransactions();
    }
  }, [profileId]);

  async function loadItems() {
    const { data: inv, error: invErr } = await supabase
      .from("inventory_items")
      .select("id, commodity_id, quantity, avg_cost_per_unit, total_cost, commodities(name_en, unit)")
      .eq("profile_id", profileId);

    if (invErr) {
      console.error("failed to load inventory_items:", invErr);
      setError(`Couldn't load inventory: ${invErr.message}`);
      return;
    }

    const withPrices = await Promise.all(
      (inv ?? []).map(async (row: any) => {
        const { data: priceRow } = await supabase
          .from("prices")
          .select("price")
          .eq("commodity_id", row.commodity_id)
          .order("price_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        return {
          ...row,
          commodity_name: row.commodities?.name_en,
          unit: row.commodities?.unit,
          todayPrice: priceRow?.price ?? null,
        };
      })
    );
    setItems(withPrices);
  }

  async function loadTransactions() {
    const { data: itemRows } = await supabase
      .from("inventory_items")
      .select("id, commodities(name_en, unit)")
      .eq("profile_id", profileId);

    const itemMeta = new Map((itemRows ?? []).map((r: any) => [r.id, { name: r.commodities?.name_en, unit: r.commodities?.unit }]));
    const itemIds = (itemRows ?? []).map((r) => r.id);
    if (itemIds.length === 0) {
      setAllTransactions([]);
      return;
    }

    const { data: txRows, error: txErr } = await supabase
      .from("inventory_transactions")
      .select("id, client_id, inventory_item_id, transaction_type, quantity, unit_cost, transport_cost, porter_fee, created_at")
      .in("inventory_item_id", itemIds)
      .order("created_at", { ascending: false });

    if (txErr) {
      console.error("failed to load inventory_transactions:", txErr);
      setError(`Couldn't load transaction history: ${txErr.message}`);
      return;
    }

    const withStatus = await Promise.all(
      (txRows ?? []).map(async (row) => ({
        ...row,
        commodity_name: itemMeta.get(row.inventory_item_id)?.name,
        unit: itemMeta.get(row.inventory_item_id)?.unit,
        syncStatus: await getSyncStatus(row.client_id),
      }))
    );
    setAllTransactions(withStatus);
  }

  async function handleAddTransaction(itemId: string) {
    if (!profileId || !txQuantity) return;
    setError(null);

    if ((txType === "purchase" || txType === "sale") && !txUnitCost) {
      setError(tr("inventory.priceRequired"));
      return;
    }

    const clientId = generateClientId();
    // FIX: adjustments now accept a signed value directly (e.g. -5 to
    // decrease stock for spoilage/loss, 5 to increase after a recount)
    // — previously this always forced a positive value, making a
    // decrease impossible to record. Purchase/sale still force their
    // fixed direction regardless of what's typed.
    const signedQty =
      txType === "sale" ? -Math.abs(Number(txQuantity))
      : txType === "adjustment" ? Number(txQuantity)
      : Math.abs(Number(txQuantity));

    const payload = {
      client_id: clientId,
      inventory_item_id: itemId,
      transaction_type: txType,
      quantity: signedQty,
      unit_cost: txType !== "adjustment" ? Number(txUnitCost) || null : null,
      transport_cost: txType !== "adjustment" ? Number(txTransportCost) || 0 : 0,
      porter_fee: txType !== "adjustment" ? Number(txPorterFee) || 0 : 0,
    };

    await enqueueWrite("inventory_transactions", clientId, payload);

    // enqueueWrite now awaits the actual sync attempt — re-check
    // status immediately instead of hardcoding "pending".
    const syncStatus = await getSyncStatus(clientId);

    const item = items.find((i) => i.id === itemId);
    setAllTransactions((prev) => [
      {
        id: clientId,
        client_id: clientId,
        inventory_item_id: itemId,
        commodity_name: item?.commodity_name,
        unit: item?.unit,
        transaction_type: txType,
        quantity: signedQty,
        unit_cost: payload.unit_cost,
        transport_cost: payload.transport_cost,
        porter_fee: payload.porter_fee,
        created_at: new Date().toISOString(),
        syncStatus,
      },
      ...prev,
    ]);

    loadItems();

    setTxQuantity("");
    setTxUnitCost("");
    setTxTransportCost("");
    setTxPorterFee("");
    setTxPage(1);
    setShowAddTransaction(null);
  }

  function startEditTx(tx: TransactionRow) {
    setEditingTxId(tx.client_id);
    setEditTxType(tx.transaction_type);
    setEditTxQuantity(String(Math.abs(tx.quantity)));
    setEditTxUnitCost(tx.unit_cost !== null ? String(tx.unit_cost) : "");
    setEditTxTransportCost(String(tx.transport_cost));
    setEditTxPorterFee(String(tx.porter_fee));
  }

  async function handleSaveTx(tx: TransactionRow) {
    const signedQty =
      editTxType === "sale" ? -Math.abs(Number(editTxQuantity))
      : editTxType === "adjustment" ? Number(editTxQuantity)
      : Math.abs(Number(editTxQuantity));

    const updates = {
      transaction_type: editTxType,
      quantity: signedQty,
      unit_cost: editTxType !== "adjustment" ? Number(editTxUnitCost) || null : null,
      transport_cost: editTxType !== "adjustment" ? Number(editTxTransportCost) || 0 : 0,
      porter_fee: editTxType !== "adjustment" ? Number(editTxPorterFee) || 0 : 0,
    };

    // Direct update (not offline-queued), same reasoning as ledger
    // entry edits — a correction is less time-critical than a new
    // record. The recompute_inventory_item trigger (013 migration)
    // fires on UPDATE too, so the item's quantity/avg_cost stays
    // correct automatically.
    const { error: updateErr } = await supabase
      .from("inventory_transactions")
      .update(updates)
      .eq("id", tx.id);

    if (updateErr) {
      console.error("failed to update transaction:", updateErr);
      setError("Couldn't save changes — check your connection and try again.");
      return;
    }

    setAllTransactions((prev) =>
      prev.map((t) => (t.client_id === tx.client_id ? { ...t, ...updates } : t))
    );
    setEditingTxId(null);
    loadItems(); // reflect the trigger's recalculated quantity/avg cost
  }

  async function addNewCommodityToInventory(commodityId: string) {
    if (!profileId) return;
    setError(null);
    const { data, error: insertError } = await supabase
      .from("inventory_items")
      .insert({ profile_id: profileId, commodity_id: commodityId, quantity: 0, avg_cost_per_unit: 0 })
      .select()
      .single();

    if (insertError || !data) {
      console.error("failed to add inventory item:", insertError);
      setError(`Couldn't add item: ${insertError?.message ?? "unknown error"}`);
      return;
    }
    loadItems();
  }

  const pagedTransactions = allTransactions.slice((txPage - 1) * PAGE_SIZE, txPage * PAGE_SIZE);
  let lastGroupLabel: string | null = null;

  return (
    <div style={{ padding: 16, paddingBottom: 28 }}>
      <h1 style={{ fontSize: 19, fontWeight: 700, color: colors.textPrimary, margin: "0 0 14px" }}>{tr("inventory.title")}</h1>

      {error && (
        <p style={{ color: colors.danger, fontSize: 13, background: colors.dangerSoft, padding: "8px 10px", borderRadius: radius.sm }}>
          {error}
        </p>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {items.map((item) => (
          <Card key={item.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <IconBadge icon={<BoxIcon size={20} />} bg={colors.primarySoft} fg={colors.primary} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: colors.textPrimary }}>{item.commodity_name}</div>
                <div style={{ fontSize: 12, color: colors.textSecondary }}>
                  {tr("inventory.avgCost")}: {formatNumber(item.avg_cost_per_unit)} / {item.unit}
                </div>
              </div>
              <div style={{ textAlign: "end" }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: colors.textPrimary }}>{formatNumber(item.quantity)} {item.unit}</div>
                <div style={{ fontSize: 11.5, color: colors.textFaint }}>{tr("inventory.total")}: {formatNumber(item.total_cost)}</div>
              </div>
            </div>

            {item.todayPrice !== null && (
              <div style={{ marginTop: 10, background: colors.successSoft, borderRadius: radius.sm, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                <TrendingIcon size={16} color={colors.success} />
                <div style={{ fontSize: 12, color: colors.success }}>
                  {tr("inventory.todayPrice")}: <strong>{formatNumber(item.todayPrice ?? 0)}</strong> — {tr("inventory.valueAtMarket")}: <strong>{formatNumber((item.todayPrice ?? 0) * item.quantity)}</strong>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowAddTransaction(showAddTransaction === item.id ? null : item.id)}
              style={{ ...secondaryButtonStyle, marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <PlusIcon size={16} />
              {tr("inventory.addTransaction")}
            </button>

            {showAddTransaction === item.id && (
              <div style={{ marginTop: 10, display: "grid", gap: 8, paddingTop: 10, borderTop: `1px solid ${colors.border}` }}>
                <select value={txType} onChange={(e) => setTxType(e.target.value as any)} style={inputStyle}>
                  <option value="purchase">{tr("inventory.purchase")}</option>
                  <option value="sale">{tr("inventory.sale")}</option>
                  <option value="adjustment">{tr("inventory.adjustment")}</option>
                </select>
                <input placeholder={tr("inventory.quantity")} type="number" value={txQuantity} onChange={(e) => setTxQuantity(e.target.value)} style={inputStyle} />
                {txType === "adjustment" && (
                  <p style={{ fontSize: 11, color: colors.textFaint, margin: 0 }}>{tr("inventory.adjustmentHint")}</p>
                )}
                {txType === "purchase" && (
                  <>
                    <input placeholder={tr("inventory.unitCost")} type="number" value={txUnitCost} onChange={(e) => setTxUnitCost(e.target.value)} style={inputStyle} />
                    <input placeholder={tr("inventory.transportCost")} type="number" value={txTransportCost} onChange={(e) => setTxTransportCost(e.target.value)} style={inputStyle} />
                    <input placeholder={tr("inventory.porterFee")} type="number" value={txPorterFee} onChange={(e) => setTxPorterFee(e.target.value)} style={inputStyle} />
                  </>
                )}
                {txType === "sale" && (
                  <>
                    <input placeholder={tr("inventory.salePrice")} type="number" value={txUnitCost} onChange={(e) => setTxUnitCost(e.target.value)} required style={inputStyle} />
                    <input placeholder={tr("inventory.transportCost")} type="number" value={txTransportCost} onChange={(e) => setTxTransportCost(e.target.value)} style={inputStyle} />
                    <input placeholder={tr("inventory.porterFee")} type="number" value={txPorterFee} onChange={(e) => setTxPorterFee(e.target.value)} style={inputStyle} />
                  </>
                )}
                <button onClick={() => handleAddTransaction(item.id)} style={primaryButtonStyle}>{tr("inventory.save")}</button>
              </div>
            )}
          </Card>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <SectionLabel>{tr("inventory.addCommodity")}</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {commodities
            .filter((c) => !items.some((i) => i.commodity_id === c.id))
            .map((c) => (
              <button
                key={c.id}
                onClick={() => addNewCommodityToInventory(c.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 12px",
                  borderRadius: radius.pill,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface,
                  color: colors.primary,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <PlusIcon size={13} />
                {c.name_en}
              </button>
            ))}
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionLabel>{tr("inventory.allTransactions")}</SectionLabel>
        {allTransactions.length === 0 && <EmptyState>{tr("inventory.noTransactions")}</EmptyState>}
        {allTransactions.length > 0 && (
          <Card style={{ padding: 4 }}>
            {pagedTransactions.map((tx, i) => {
              const groupLabel = dateGroupLabel(tx.created_at, dateSystem, digitStyle, tr);
              const showHeader = groupLabel !== lastGroupLabel;
              lastGroupLabel = groupLabel;
              const isEditing = editingTxId === tx.client_id;
              const Icon = TX_ICON[tx.transaction_type];
              const tone = TX_COLOR[tx.transaction_type];

              return (
                <div key={tx.client_id}>
                  {showHeader && <div style={{ padding: "6px 10px 0" }}><DateGroupHeader>{groupLabel}</DateGroupHeader></div>}

                  {!isEditing && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px", borderTop: showHeader || i === 0 ? "none" : `1px solid ${colors.border}` }}>
                      <Icon size={28} color={tone} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, color: colors.textPrimary, display: "flex", alignItems: "center", gap: 6 }}>
                          {tx.commodity_name}
                          <Pill bg={`${tone}1A`} fg={tone}>{tr(`inventory.${tx.transaction_type}`)}</Pill>
                        </div>
                        <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 2 }}>
                          {formatDateTime(tx.created_at, dateSystem, digitStyle)} · {timeAgo(tx.created_at, tr)}
                        </div>
                        {(tx.transport_cost > 0 || tx.porter_fee > 0) && (
                          <div style={{ fontSize: 10.5, color: colors.textFaint }}>
                            {tr("inventory.transportCost")}: {formatNumber(tx.transport_cost)} · {tr("inventory.porterFee")}: {formatNumber(tx.porter_fee)}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: "end" }}>
                        <div style={{ color: tone, fontWeight: 700, fontSize: 14 }}>
                          {tx.quantity >= 0 ? "+" : ""}{formatNumber(tx.quantity)} {tx.unit}
                        </div>
                        {tx.unit_cost !== null && (
                          <>
                            <div style={{ fontSize: 11, color: colors.textFaint }}>@ {formatNumber(tx.unit_cost)}</div>
                            <div style={{ fontSize: 11, color: colors.textFaint }}>
                              {tr("inventory.totalAmount")}: {formatNumber(Math.abs(tx.quantity) * tx.unit_cost)}
                            </div>
                          </>
                        )}
                        <div style={{ fontSize: 10.5, color: colors.textFaint, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                          <SyncDot synced={tx.syncStatus === "synced"} />
                          {tx.syncStatus === "synced" ? tr("ledger.synced") : tr("ledger.pending")}
                        </div>
                      </div>
                      <button
                        onClick={() => startEditTx(tx)}
                        style={{ width: 28, height: 28, borderRadius: radius.pill, border: "none", background: colors.surfaceMuted, color: colors.textSecondary, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                      >
                        <PencilIcon size={13} />
                      </button>
                    </div>
                  )}

                  {isEditing && (
                    <div style={{ display: "grid", gap: 8, padding: "10px", borderTop: `1px solid ${colors.border}` }}>
                      <select value={editTxType} onChange={(e) => setEditTxType(e.target.value as any)} style={inputStyle}>
                        <option value="purchase">{tr("inventory.purchase")}</option>
                        <option value="sale">{tr("inventory.sale")}</option>
                        <option value="adjustment">{tr("inventory.adjustment")}</option>
                      </select>
                      <input type="number" value={editTxQuantity} onChange={(e) => setEditTxQuantity(e.target.value)} placeholder={tr("inventory.quantity")} style={inputStyle} />
                      {editTxType !== "adjustment" && (
                        <>
                          <input type="number" value={editTxUnitCost} onChange={(e) => setEditTxUnitCost(e.target.value)} placeholder={tr("inventory.unitCost")} style={inputStyle} />
                          <input type="number" value={editTxTransportCost} onChange={(e) => setEditTxTransportCost(e.target.value)} placeholder={tr("inventory.transportCost")} style={inputStyle} />
                          <input type="number" value={editTxPorterFee} onChange={(e) => setEditTxPorterFee(e.target.value)} placeholder={tr("inventory.porterFee")} style={inputStyle} />
                        </>
                      )}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => handleSaveTx(tx)} style={{ ...primaryButtonStyle, flex: 1 }}>{tr("common.save")}</button>
                        <button onClick={() => setEditingTxId(null)} style={{ ...secondaryButtonStyle, flex: 1 }}>{tr("common.cancel")}</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        )}
        <Pagination page={txPage} totalItems={allTransactions.length} pageSize={PAGE_SIZE} onPageChange={setTxPage} />
      </div>
    </div>
  );
}
