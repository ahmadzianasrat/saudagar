import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../../i18n/useTranslation";
import { useLanguage } from "../../contexts/LanguageContext";
import { colors, inputStyle, radius, shadow } from "../../theme";
import { Card, PageHeader } from "../../components/ui";
import { SwapIcon } from "../../components/icons";
import { afnToPkr, loadRates, pkrToAfn, saveRates, type Rates } from "../../lib/currencyRates";

// Rate storage/conversion logic now lives in lib/currencyRates.ts,
// shared with the inventory purchase/sale forms (Phase 3
// multi-currency) — this screen is just the UI for viewing/editing it.
const CURRENCIES = ["AFN", "USD", "PKR"];

export default function CurrencyConverterScreen() {
  const navigate = useNavigate();
  const { tr } = useTranslation();
  const { formatNumber } = useLanguage();

  const [rates, setRatesState] = useState<Rates>(loadRates);
  const [editingRates, setEditingRates] = useState(false);
  const [amount, setAmount] = useState("1");
  const [fromCurrency, setFromCurrency] = useState("AFN");
  const [toCurrency, setToCurrency] = useState("USD");

  function setRates(updater: (prev: Rates) => Rates) {
    setRatesState((prev) => {
      const next = updater(prev);
      saveRates(next);
      return next;
    });
  }

  function toAFN(value: number, currency: string): number {
    if (currency === "AFN") return value;
    if (currency === "USD") return value * rates.afnPerUsd;
    return pkrToAfn(value, rates);
  }

  function fromAFN(value: number, currency: string): number {
    if (currency === "AFN") return value;
    if (currency === "USD") return value / rates.afnPerUsd;
    return afnToPkr(value, rates);
  }

  const numericAmount = Number(amount) || 0;
  const result = fromAFN(toAFN(numericAmount, fromCurrency), toCurrency);

  function handleFlip() {
    // Swaps the from/to currencies directly on the arrow click,
    // without needing to reopen either dropdown.
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  }

  return (
    <div style={{ padding: 16, paddingBottom: 28 }}>
      <PageHeader title={tr("currency.title")} onBack={() => navigate("/settings")} />

      <Card>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ ...inputStyle, fontSize: 24, fontWeight: 700, textAlign: "center", border: "none", background: "none", padding: "6px 0" }}
        />
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
          <select value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)} style={{ ...inputStyle, flex: 1, textAlign: "center", fontWeight: 700 }}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={handleFlip}
            aria-label="Swap currencies"
            style={{
              width: 38,
              height: 38,
              minWidth: 38,
              borderRadius: radius.pill,
              border: "none",
              background: colors.primary,
              color: colors.white,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: shadow.card,
            }}
          >
            <SwapIcon size={17} />
          </button>
          <select value={toCurrency} onChange={(e) => setToCurrency(e.target.value)} style={{ ...inputStyle, flex: 1, textAlign: "center", fontWeight: 700 }}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ textAlign: "center", marginTop: 18, paddingTop: 16, borderTop: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: 11.5, color: colors.textSecondary }}>{tr("currency.amount")}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: colors.primary, marginTop: 4 }}>
            {formatNumber(Math.round(result * 100) / 100)} <span style={{ fontSize: 15 }}>{toCurrency}</span>
          </div>
        </div>
      </Card>

      <button
        onClick={() => setEditingRates((v) => !v)}
        style={{ marginTop: 18, fontSize: 13, fontWeight: 600, color: colors.primary, background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        {tr("currency.editRates")}
      </button>
      <p style={{ fontSize: 11.5, color: colors.textFaint }}>{tr("currency.ratesNote")}</p>

      {editingRates && (
        <Card style={{ display: "grid", gap: 14, marginTop: 8 }}>
          <div>
            <label style={{ fontSize: 12.5, color: colors.textSecondary, fontWeight: 600 }}>{tr("currency.usdRate")}</label>
            <input
              type="number"
              step="0.01"
              value={rates.afnPerUsd}
              onChange={(e) => setRates((prev) => ({ ...prev, afnPerUsd: Number(e.target.value) || 0 }))}
              style={{ ...inputStyle, marginTop: 6 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12.5, color: colors.textSecondary, display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
              <input
                type="radio"
                checked={rates.afnPkrDirection === "afn_to_pkr"}
                onChange={() => setRates((prev) => ({ ...prev, afnPkrDirection: "afn_to_pkr" }))}
              />
              {tr("currency.afnToPkrRate")} — {tr("currency.useThisRate")}
            </label>
            <input
              type="number"
              step="0.01"
              value={rates.pkrPer1000Afn}
              onChange={(e) => setRates((prev) => ({ ...prev, pkrPer1000Afn: Number(e.target.value) || 0 }))}
              style={{ ...inputStyle, marginTop: 6 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12.5, color: colors.textSecondary, display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
              <input
                type="radio"
                checked={rates.afnPkrDirection === "pkr_to_afn"}
                onChange={() => setRates((prev) => ({ ...prev, afnPkrDirection: "pkr_to_afn" }))}
              />
              {tr("currency.pkrToAfnRate")} — {tr("currency.useThisRate")}
            </label>
            <input
              type="number"
              step="0.01"
              value={rates.afnPer1000Pkr}
              onChange={(e) => setRates((prev) => ({ ...prev, afnPer1000Pkr: Number(e.target.value) || 0 }))}
              style={{ ...inputStyle, marginTop: 6 }}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
