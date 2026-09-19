import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabaseClient";
import { enqueueWrite, getSyncStatus } from "../../lib/offlineQueue";
import { generateClientId } from "../../lib/uuid";
import { normalizeAfghanPhone } from "../../lib/phone";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTranslation } from "../../i18n/useTranslation";
import { dateGroupLabel, formatDateTime, timeAgo } from "../../lib/dateFormat";
import Pagination from "../../components/Pagination";
import { colors, inputStyle, primaryButtonStyle, radius, secondaryButtonStyle } from "../../theme";
import { Card, DateGroupHeader, EmptyState, IconBadge, LoadingRows, Pill, SectionLabel, SegmentedControl, SyncDot } from "../../components/ui";
import { ArrowDownCircleIcon, ArrowUpCircleIcon, BoxIcon, EyeIcon, PencilIcon, PlusIcon, SwapIcon, TrendingIcon } from "../../components/icons";
import ReceiptModal from "../../components/ReceiptModal";
import { fetchShopProfile, type ShopProfile } from "../../lib/shopProfile";
import { loadRates, pkrToAfn } from "../../lib/currencyRates";

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
  party_name: string | null;
  party_phone: string | null;
  party_whatsapp: string | null;
  party_address: string | null;
  note?: string | null;
  currency: "AFN" | "PKR";
  fx_rate: number;
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

// Shared by both the purchase and sale forms — typing a name reveals
// the rest of the contact fields, per "if someone typed in; opens
// other relevant fields like mobile/WhatsApp number and address."
function PartyFields({
  label,
  name,
  phone,
  whatsapp,
  address,
  onName,
  onPhone,
  onWhatsapp,
  onAddress,
  tr,
}: {
  label: string;
  name: string;
  phone: string;
  whatsapp: string;
  address: string;
  onName: (v: string) => void;
  onPhone: (v: string) => void;
  onWhatsapp: (v: string) => void;
  onAddress: (v: string) => void;
  tr: (key: string) => string;
}) {
  return (
    <div style={{ borderTop: `1px dashed ${colors.border}`, paddingTop: 8, marginTop: 2, display: "grid", gap: 8 }}>
      <input placeholder={label} value={name} onChange={(e) => onName(e.target.value)} style={inputStyle} />
      {name.trim() !== "" && (
        <>
          <input placeholder={tr("inventory.partyMobile")} value={phone} onChange={(e) => onPhone(e.target.value)} inputMode="tel" style={inputStyle} />
          <input placeholder={tr("inventory.partyWhatsapp")} value={whatsapp} onChange={(e) => onWhatsapp(e.target.value)} inputMode="tel" style={inputStyle} />
          <input placeholder={tr("inventory.partyAddress")} value={address} onChange={(e) => onAddress(e.target.value)} style={inputStyle} />
        </>
      )}
    </div>
  );
}

// Currency + live conversion preview for the purchase/sale forms
// (Phase 3 multi-currency) — shown right under the unit-cost input.
function CurrencySelector({
  currency,
  onChange,
  amount,
  tr,
  formatNumber,
  currencyLabel,
}: {
  currency: "AFN" | "PKR";
  onChange: (v: "AFN" | "PKR") => void;
  amount: string;
  tr: (key: string) => string;
  formatNumber: (n: number) => string;
  currencyLabel: (currency: "AFN" | "PKR", style?: "name" | "symbol") => string;
}) {
  const numericAmount = Number(amount) || 0;
  return (
    <div>
      <select value={currency} onChange={(e) => onChange(e.target.value as "AFN" | "PKR")} style={{ ...inputStyle, width: "auto", minWidth: 100 }}>
        <option value="AFN">{currencyLabel("AFN")}</option>
        <option value="PKR">{currencyLabel("PKR")}</option>
      </select>
      {currency === "PKR" && numericAmount > 0 && (
        <p style={{ fontSize: 10.5, color: colors.textFaint, margin: "4px 0 0" }}>
          {tr("inventory.convertedAmount")}: ≈ {formatNumber(pkrToAfn(numericAmount))} {currencyLabel("AFN")}
        </p>
      )}
    </div>
  );
}

export default function InventoryHome() {
  const { formatNumber, dateSystem, digitStyle, currencyLabel } = useLanguage();
  const { tr } = useTranslation();
  const [profileId, setProfileId] = useState<string | null>(null);
  // `null` = not loaded yet, distinct from `[]` = loaded and empty —
  // avoids flashing the empty-state message before real data arrives.
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [allTransactions, setAllTransactions] = useState<TransactionRow[] | null>(null);
  const [txPage, setTxPage] = useState(1);
  const [txCurrencyFilter, setTxCurrencyFilter] = useState<"both" | "AFN" | "PKR">("both");

  const [showAddTransaction, setShowAddTransaction] = useState<string | null>(null);
  const [txType, setTxType] = useState<"purchase" | "sale" | "adjustment">("purchase");
  const [txQuantity, setTxQuantity] = useState("");
  const [txUnitCost, setTxUnitCost] = useState("");
  const [txTransportCost, setTxTransportCost] = useState("");
  const [txPorterFee, setTxPorterFee] = useState("");
  const [txCurrency, setTxCurrency] = useState<"AFN" | "PKR">("AFN");
  // Optional stock adjustment recorded alongside a purchase (e.g.
  // spoilage/shortfall discovered while receiving the goods) — the
  // comment field is only meaningful once an adjustment amount is
  // entered, per the requested "only active if adjustment has a value."
  const [txAdjustmentAmount, setTxAdjustmentAmount] = useState("");
  const [txAdjustmentComment, setTxAdjustmentComment] = useState("");
  // "Purchased from" / "Sold to" — an optional counterparty-like note
  // on the transaction itself, distinct from ledger contacts (a
  // supplier or one-off buyer isn't necessarily someone the shop
  // extends credit to). Filling in the name reveals the rest.
  const [txPartyName, setTxPartyName] = useState("");
  const [txPartyPhone, setTxPartyPhone] = useState("");
  const [txPartyWhatsapp, setTxPartyWhatsapp] = useState("");
  const [txPartyAddress, setTxPartyAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [showAddCommodityForm, setShowAddCommodityForm] = useState(false);
  const [newCommodityName, setNewCommodityName] = useState("");
  const [newCommodityUnit, setNewCommodityUnit] = useState("");
  const [newCommodityCategory, setNewCommodityCategory] = useState("other");

  // Receipt viewing — the shop profile is fetched once, lazily, the
  // first time a receipt is opened (not on every page load).
  const [shopProfile, setShopProfile] = useState<ShopProfile | null>(null);
  const [receiptTx, setReceiptTx] = useState<TransactionRow | null>(null);

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
      setItems([]);
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
      .select("id, client_id, inventory_item_id, transaction_type, quantity, unit_cost, transport_cost, porter_fee, party_name, party_phone, party_whatsapp, party_address, note, currency, fx_rate, created_at")
      .in("inventory_item_id", itemIds)
      .order("created_at", { ascending: false });

    if (txErr) {
      console.error("failed to load inventory_transactions:", txErr);
      setError(`Couldn't load transaction history: ${txErr.message}`);
      setAllTransactions([]);
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

    // unit_cost/transport_cost/porter_fee always store the
    // AFN-equivalent (see migration 018) — a PKR entry is converted
    // here using the shop's saved rate before it's written, so the
    // avg-cost trigger never needs to know about currencies at all.
    // fx_rate is stored alongside so the originally-entered PKR
    // amount can be recovered later (unit_cost / fx_rate) for display
    // and receipts, without a second set of amount columns.
    const rates = loadRates();
    const fxRate = txCurrency === "PKR" ? pkrToAfn(1, rates) : 1;
    const convert = (v: number) => (txCurrency === "PKR" ? pkrToAfn(v, rates) : v);

    const payload = {
      client_id: clientId,
      inventory_item_id: itemId,
      transaction_type: txType,
      quantity: signedQty,
      unit_cost: txType !== "adjustment" ? (txUnitCost ? convert(Number(txUnitCost)) : null) : null,
      transport_cost: txType !== "adjustment" ? convert(Number(txTransportCost) || 0) : 0,
      porter_fee: txType !== "adjustment" ? convert(Number(txPorterFee) || 0) : 0,
      party_name: txType !== "adjustment" ? txPartyName || null : null,
      party_phone: txType !== "adjustment" && txPartyName ? (txPartyPhone ? normalizeAfghanPhone(txPartyPhone) : null) : null,
      party_whatsapp: txType !== "adjustment" && txPartyName ? (txPartyWhatsapp ? normalizeAfghanPhone(txPartyWhatsapp) : null) : null,
      party_address: txType !== "adjustment" && txPartyName ? txPartyAddress || null : null,
      currency: txType !== "adjustment" ? txCurrency : "AFN",
      fx_rate: txType !== "adjustment" ? fxRate : 1,
    };

    await enqueueWrite("inventory_transactions", clientId, payload);

    // enqueueWrite now awaits the actual sync attempt — re-check
    // status immediately instead of hardcoding "pending".
    const syncStatus = await getSyncStatus(clientId);

    const item = (items ?? []).find((i) => i.id === itemId);
    const newRows: TransactionRow[] = [
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
        party_name: payload.party_name,
        party_phone: payload.party_phone,
        party_whatsapp: payload.party_whatsapp,
        party_address: payload.party_address,
        currency: payload.currency as "AFN" | "PKR",
        fx_rate: payload.fx_rate,
        created_at: new Date().toISOString(),
        syncStatus,
      },
    ];

    // A purchase can carry an additional stock adjustment alongside
    // it (e.g. spoilage discovered while receiving the goods) —
    // recorded as its own 'adjustment' transaction, reusing the type
    // that already exists rather than adding new schema for it.
    if (txType === "purchase" && txAdjustmentAmount.trim() !== "" && Number(txAdjustmentAmount) !== 0) {
      const adjClientId = generateClientId();
      const adjPayload = {
        client_id: adjClientId,
        inventory_item_id: itemId,
        transaction_type: "adjustment" as const,
        quantity: Number(txAdjustmentAmount),
        unit_cost: null,
        transport_cost: 0,
        porter_fee: 0,
        note: txAdjustmentComment || null,
        currency: "AFN" as const,
        fx_rate: 1,
      };
      await enqueueWrite("inventory_transactions", adjClientId, adjPayload);
      const adjSyncStatus = await getSyncStatus(adjClientId);
      newRows.push({
        id: adjClientId,
        client_id: adjClientId,
        inventory_item_id: itemId,
        commodity_name: item?.commodity_name,
        unit: item?.unit,
        transaction_type: "adjustment",
        quantity: adjPayload.quantity,
        unit_cost: null,
        transport_cost: 0,
        porter_fee: 0,
        party_name: null,
        party_phone: null,
        party_whatsapp: null,
        party_address: null,
        note: adjPayload.note,
        currency: "AFN",
        fx_rate: 1,
        created_at: new Date().toISOString(),
        syncStatus: adjSyncStatus,
      });
    }

    setAllTransactions((prev) => [...newRows, ...(prev ?? [])]);

    loadItems();

    setTxQuantity("");
    setTxUnitCost("");
    setTxTransportCost("");
    setTxPorterFee("");
    setTxCurrency("AFN");
    setTxAdjustmentAmount("");
    setTxAdjustmentComment("");
    setTxPartyName("");
    setTxPartyPhone("");
    setTxPartyWhatsapp("");
    setTxPartyAddress("");
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
      (prev ?? []).map((t) => (t.client_id === tx.client_id ? { ...t, ...updates } : t))
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

  async function handleCreateCommodity(e: FormEvent) {
    e.preventDefault();
    if (!profileId || !newCommodityName.trim() || !newCommodityUnit.trim()) return;
    setError(null);

    const { data, error: insertError } = await supabase
      .from("commodities")
      .insert({
        name_en: newCommodityName.trim(),
        name_ps: newCommodityName.trim(),
        name_da: newCommodityName.trim(),
        unit: newCommodityUnit.trim(),
        category: newCommodityCategory,
        created_by_profile_id: profileId,
      })
      .select()
      .single();

    if (insertError || !data) {
      console.error("failed to create commodity:", insertError);
      setError(`Couldn't create commodity: ${insertError?.message ?? "unknown error"}`);
      return;
    }

    // No separate name translations are collected here — a
    // self-added commodity is shown as its owner typed it in every
    // language, rather than blocking on translating it into Pashto
    // and Dari before it can be used at all.
    setCommodities((prev) => [...prev, data]);
    setNewCommodityName("");
    setNewCommodityUnit("");
    setNewCommodityCategory("other");
    setShowAddCommodityForm(false);
  }

  async function openReceipt(tx: TransactionRow) {
    setError(null);
    let profile = shopProfile;
    if (!profile) {
      profile = await fetchShopProfile();
      if (!profile) {
        setError(tr("receipt.shopProfileMissing"));
        return;
      }
      setShopProfile(profile);
    }
    setReceiptTx(tx);
  }

  const filteredTransactions = (allTransactions ?? []).filter(
    (t) => txCurrencyFilter === "both" || t.currency === txCurrencyFilter
  );
  const pagedTransactions = filteredTransactions.slice((txPage - 1) * PAGE_SIZE, txPage * PAGE_SIZE);
  let lastGroupLabel: string | null = null;

  return (
    <div style={{ padding: 16, paddingBottom: 28 }}>
      <h1 style={{ fontSize: 19, fontWeight: 700, color: colors.textPrimary, margin: "0 0 14px" }}>{tr("inventory.title")}</h1>

      {error && (
        <p style={{ color: colors.danger, fontSize: 13, background: colors.dangerSoft, padding: "8px 10px", borderRadius: radius.sm }}>
          {error}
        </p>
      )}

      {items === null && <LoadingRows count={3} />}
      {items !== null && items.length === 0 && <EmptyState>{tr("inventory.noItems")}</EmptyState>}
      {items !== null && items.length > 0 && (
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
                    <CurrencySelector currency={txCurrency} onChange={setTxCurrency} amount={txUnitCost} tr={tr} formatNumber={formatNumber} currencyLabel={currencyLabel} />
                    <input placeholder={tr("inventory.transportCost")} type="number" value={txTransportCost} onChange={(e) => setTxTransportCost(e.target.value)} style={inputStyle} />
                    <input placeholder={tr("inventory.porterFee")} type="number" value={txPorterFee} onChange={(e) => setTxPorterFee(e.target.value)} style={inputStyle} />

                    <div style={{ borderTop: `1px dashed ${colors.border}`, paddingTop: 8, marginTop: 2 }}>
                      <input
                        placeholder={tr("inventory.adjustmentAmount")}
                        type="number"
                        value={txAdjustmentAmount}
                        onChange={(e) => setTxAdjustmentAmount(e.target.value)}
                        style={inputStyle}
                      />
                      {txAdjustmentAmount.trim() !== "" && (
                        <p style={{ fontSize: 10.5, color: colors.textFaint, margin: "4px 0 0" }}>{tr("inventory.adjustmentHintPurchase")}</p>
                      )}
                      <input
                        placeholder={tr("inventory.adjustmentComment")}
                        value={txAdjustmentComment}
                        onChange={(e) => setTxAdjustmentComment(e.target.value)}
                        disabled={txAdjustmentAmount.trim() === ""}
                        style={{ ...inputStyle, marginTop: 8, opacity: txAdjustmentAmount.trim() === "" ? 0.5 : 1 }}
                      />
                    </div>

                    <PartyFields
                      label={tr("inventory.purchasedFrom")}
                      name={txPartyName}
                      phone={txPartyPhone}
                      whatsapp={txPartyWhatsapp}
                      address={txPartyAddress}
                      onName={setTxPartyName}
                      onPhone={setTxPartyPhone}
                      onWhatsapp={setTxPartyWhatsapp}
                      onAddress={setTxPartyAddress}
                      tr={tr}
                    />
                  </>
                )}
                {txType === "sale" && (
                  <>
                    <input placeholder={tr("inventory.salePrice")} type="number" value={txUnitCost} onChange={(e) => setTxUnitCost(e.target.value)} required style={inputStyle} />
                    <CurrencySelector currency={txCurrency} onChange={setTxCurrency} amount={txUnitCost} tr={tr} formatNumber={formatNumber} currencyLabel={currencyLabel} />
                    <input placeholder={tr("inventory.transportCost")} type="number" value={txTransportCost} onChange={(e) => setTxTransportCost(e.target.value)} style={inputStyle} />
                    <input placeholder={tr("inventory.porterFee")} type="number" value={txPorterFee} onChange={(e) => setTxPorterFee(e.target.value)} style={inputStyle} />

                    <PartyFields
                      label={tr("inventory.soldTo")}
                      name={txPartyName}
                      phone={txPartyPhone}
                      whatsapp={txPartyWhatsapp}
                      address={txPartyAddress}
                      onName={setTxPartyName}
                      onPhone={setTxPartyPhone}
                      onWhatsapp={setTxPartyWhatsapp}
                      onAddress={setTxPartyAddress}
                      tr={tr}
                    />
                  </>
                )}
                <button onClick={() => handleAddTransaction(item.id)} style={primaryButtonStyle}>{tr("inventory.save")}</button>
              </div>
            )}
          </Card>
        ))}
      </div>
      )}

      <div style={{ marginTop: 20 }}>
        <SectionLabel>{tr("inventory.addCommodity")}</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {commodities
            .filter((c) => !(items ?? []).some((i) => i.commodity_id === c.id))
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
          <button
            onClick={() => setShowAddCommodityForm((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: radius.pill,
              border: `1px solid ${colors.primary}`,
              background: colors.primarySoft,
              color: colors.primary,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <PlusIcon size={13} />
            {tr("inventory.addNewCommodity")}
          </button>
        </div>

        {showAddCommodityForm && (
          <Card style={{ marginTop: 10, display: "grid", gap: 10 }}>
            <form onSubmit={handleCreateCommodity} style={{ display: "grid", gap: 10 }}>
              <input placeholder={tr("inventory.commodityName")} value={newCommodityName} onChange={(e) => setNewCommodityName(e.target.value)} required style={inputStyle} />
              <input placeholder={tr("inventory.commodityUnit")} value={newCommodityUnit} onChange={(e) => setNewCommodityUnit(e.target.value)} required style={inputStyle} />
              <select value={newCommodityCategory} onChange={(e) => setNewCommodityCategory(e.target.value)} style={inputStyle}>
                <option value="grain">{tr("inventory.category.grain")}</option>
                <option value="cotton">{tr("inventory.category.cotton")}</option>
                <option value="fertilizer">{tr("inventory.category.fertilizer")}</option>
                <option value="other">{tr("inventory.category.other")}</option>
              </select>
              <button type="submit" style={primaryButtonStyle}>{tr("inventory.createCommodity")}</button>
            </form>
          </Card>
        )}
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionLabel>{tr("inventory.allTransactions")}</SectionLabel>
        {allTransactions === null && <LoadingRows count={4} />}
        {allTransactions !== null && allTransactions.length === 0 && <EmptyState>{tr("inventory.noTransactions")}</EmptyState>}
        {allTransactions !== null && allTransactions.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <SegmentedControl
              value={txCurrencyFilter}
              onChange={(v) => {
                setTxCurrencyFilter(v);
                setTxPage(1);
              }}
              options={[
                { value: "both" as const, label: tr("ledger.viewBoth") },
                { value: "AFN" as const, label: currencyLabel("AFN") },
                { value: "PKR" as const, label: currencyLabel("PKR") },
              ]}
            />
          </div>
        )}
        {allTransactions !== null && allTransactions.length > 0 && filteredTransactions.length === 0 && (
          <EmptyState>{tr("inventory.noTransactions")}</EmptyState>
        )}
        {filteredTransactions.length > 0 && (
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
                        {tx.party_name && (
                          <div style={{ fontSize: 10.5, color: colors.textFaint }}>
                            {tx.transaction_type === "purchase" ? tr("inventory.purchasedFrom") : tr("inventory.soldTo")}: {tx.party_name}
                          </div>
                        )}
                        {tx.transaction_type === "adjustment" && tx.note && (
                          <div style={{ fontSize: 10.5, color: colors.textFaint, fontStyle: "italic" }}>{tx.note}</div>
                        )}
                      </div>
                      <div style={{ textAlign: "end" }}>
                        <div style={{ color: tone, fontWeight: 700, fontSize: 14 }}>
                          {tx.quantity >= 0 ? "+" : ""}{formatNumber(tx.quantity)} {tx.unit}
                        </div>
                        {tx.unit_cost !== null && (
                          <>
                            <div style={{ fontSize: 11, color: colors.textFaint }}>@ {formatNumber(tx.unit_cost)} {currencyLabel("AFN")}</div>
                            {tx.currency === "PKR" && (
                              <div style={{ fontSize: 10.5, color: colors.textFaint }}>
                                ({formatNumber(tx.unit_cost / tx.fx_rate)} {currencyLabel("PKR")} {tr("inventory.entered")})
                              </div>
                            )}
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
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                        {tx.transaction_type !== "adjustment" && (
                          <button
                            onClick={() => openReceipt(tx)}
                            style={{ width: 28, height: 28, borderRadius: radius.pill, border: "none", background: colors.primarySoft, color: colors.primary, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                            title={tr("receipt.viewReceipt")}
                          >
                            <EyeIcon size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => startEditTx(tx)}
                          style={{ width: 28, height: 28, borderRadius: radius.pill, border: "none", background: colors.surfaceMuted, color: colors.textSecondary, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                        >
                          <PencilIcon size={13} />
                        </button>
                      </div>
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
        <Pagination page={txPage} totalItems={filteredTransactions.length} pageSize={PAGE_SIZE} onPageChange={setTxPage} />
      </div>

      {receiptTx && shopProfile && (
        <ReceiptModal
          onClose={() => setReceiptTx(null)}
          shop={shopProfile}
          title={receiptTx.transaction_type === "purchase" ? tr("receipt.purchaseTitle") : tr("receipt.saleTitle")}
          dateLabel={formatDateTime(receiptTx.created_at, dateSystem, digitStyle)}
          party={
            receiptTx.party_name
              ? {
                  label: receiptTx.transaction_type === "purchase" ? tr("inventory.purchasedFrom") : tr("inventory.soldTo"),
                  name: receiptTx.party_name,
                  phone: receiptTx.party_phone,
                  whatsapp: receiptTx.party_whatsapp,
                  address: receiptTx.party_address,
                }
              : undefined
          }
          rows={[
            { label: `${receiptTx.commodity_name} (${formatNumber(Math.abs(receiptTx.quantity))} ${receiptTx.unit})`, value: receiptTx.unit_cost !== null ? `${formatNumber(receiptTx.unit_cost)} ${currencyLabel("AFN")} / ${receiptTx.unit}` : "—" },
            ...(receiptTx.currency === "PKR" && receiptTx.unit_cost !== null
              ? [{ label: tr("inventory.originalAmount"), value: `${formatNumber(receiptTx.unit_cost / receiptTx.fx_rate)} ${currencyLabel("PKR")} / ${receiptTx.unit}` }]
              : []),
            ...(receiptTx.transport_cost > 0 ? [{ label: tr("inventory.transportCost"), value: formatNumber(receiptTx.transport_cost) }] : []),
            ...(receiptTx.porter_fee > 0 ? [{ label: tr("inventory.porterFee"), value: formatNumber(receiptTx.porter_fee) }] : []),
          ]}
          totalLabel={tr("receipt.total")}
          totalValue={`${formatNumber(
            (receiptTx.unit_cost !== null ? Math.abs(receiptTx.quantity) * receiptTx.unit_cost : 0) + receiptTx.transport_cost + receiptTx.porter_fee
          )} ${currencyLabel("AFN")}`}
          filename={`${receiptTx.transaction_type}-receipt-${receiptTx.client_id.slice(0, 8)}`}
          whatsappText={`${shopProfile.shop_name} — ${receiptTx.transaction_type === "purchase" ? tr("receipt.purchaseTitle") : tr("receipt.saleTitle")}\n${receiptTx.commodity_name}: ${formatNumber(Math.abs(receiptTx.quantity))} ${receiptTx.unit}${receiptTx.unit_cost !== null ? ` @ ${formatNumber(receiptTx.unit_cost)}` : ""}\n${tr("receipt.date")}: ${formatDateTime(receiptTx.created_at, dateSystem, digitStyle)}`}
          whatsappPhone={receiptTx.party_whatsapp || receiptTx.party_phone}
        />
      )}
    </div>
  );
}
