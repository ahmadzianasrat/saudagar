import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../../i18n/useTranslation";
import { useLanguage } from "../../contexts/LanguageContext";

// No live exchange-rate API — rates are set manually and persisted
// locally. INR removed per request (near-zero usage). AFN<->PKR has
// TWO possible rate definitions (1000 AFN = ? PKR, or 1000 PKR = ? AFN)
// which won't always agree exactly — rather than silently picking one,
// the user explicitly selects which is authoritative via a radio
// button, avoiding a conflict between two numbers that might drift
// apart if only one gets updated.
const STORAGE_KEY = "saudagar:currency-rates-v2";

interface Rates {
  afnPerUsd: number;        // "1 USD = ? AFN"
  pkrPer1000Afn: number;    // "1000 AFN = ? PKR"
  afnPer1000Pkr: number;    // "1000 PKR = ? AFN"
  afnPkrDirection: "afn_to_pkr" | "pkr_to_afn";
}

const DEFAULT_RATES: Rates = {
  afnPerUsd: 88,
  pkrPer1000Afn: 3140,
  afnPer1000Pkr: 318.5,
  afnPkrDirection: "afn_to_pkr",
};

function loadRates(): Rates {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_RATES, ...JSON.parse(raw) } : DEFAULT_RATES;
  } catch {
    return DEFAULT_RATES;
  }
}

const CURRENCIES = ["AFN", "USD", "PKR"];

export default function CurrencyConverterScreen() {
  const navigate = useNavigate();
  const { tr } = useTranslation();
  const { formatNumber } = useLanguage();

  const [rates, setRates] = useState<Rates>(loadRates);
  const [editingRates, setEditingRates] = useState(false);
  const [amount, setAmount] = useState("1");
  const [fromCurrency, setFromCurrency] = useState("AFN");
  const [toCurrency, setToCurrency] = useState("USD");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rates));
  }, [rates]);

  function toAFN(value: number, currency: string): number {
    if (currency === "AFN") return value;
    if (currency === "USD") return value * rates.afnPerUsd;
    // PKR
    return rates.afnPkrDirection === "pkr_to_afn"
      ? (value / 1000) * rates.afnPer1000Pkr
      : value / (rates.pkrPer1000Afn / 1000);
  }

  function fromAFN(value: number, currency: string): number {
    if (currency === "AFN") return value;
    if (currency === "USD") return value / rates.afnPerUsd;
    // PKR
    return rates.afnPkrDirection === "pkr_to_afn"
      ? (value / rates.afnPer1000Pkr) * 1000
      : value * (rates.pkrPer1000Afn / 1000);
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
    <div style={{ padding: 16 }}>
      <button onClick={() => navigate("/settings")} style={{ marginBottom: 12 }}>
        ← {tr("settings.title")}
      </button>
      <h2>{tr("currency.title")}</h2>

      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ fontSize: 20, padding: 10 }}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)} style={{ flex: 1 }}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={handleFlip}
            style={{ padding: "6px 10px", cursor: "pointer" }}
            aria-label="Swap currencies"
          >
            ⇄
          </button>
          <select value={toCurrency} onChange={(e) => setToCurrency(e.target.value)} style={{ flex: 1 }}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ fontSize: 28, fontWeight: 500, textAlign: "center", marginTop: 12 }}>
          {formatNumber(Math.round(result * 100) / 100)} {toCurrency}
        </div>
      </div>

      <button onClick={() => setEditingRates((v) => !v)} style={{ marginTop: 20, fontSize: 13 }}>
        {tr("currency.editRates")}
      </button>
      <p style={{ fontSize: 11, color: "#888" }}>{tr("currency.ratesNote")}</p>

      {editingRates && (
        <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
          <div>
            <label style={{ fontSize: 13 }}>{tr("currency.usdRate")}</label>
            <input
              type="number"
              step="0.01"
              value={rates.afnPerUsd}
              onChange={(e) => setRates((prev) => ({ ...prev, afnPerUsd: Number(e.target.value) || 0 }))}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13 }}>
              <input
                type="radio"
                checked={rates.afnPkrDirection === "afn_to_pkr"}
                onChange={() => setRates((prev) => ({ ...prev, afnPkrDirection: "afn_to_pkr" }))}
              />{" "}
              {tr("currency.afnToPkrRate")} — {tr("currency.useThisRate")}
            </label>
            <input
              type="number"
              step="0.01"
              value={rates.pkrPer1000Afn}
              onChange={(e) => setRates((prev) => ({ ...prev, pkrPer1000Afn: Number(e.target.value) || 0 }))}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13 }}>
              <input
                type="radio"
                checked={rates.afnPkrDirection === "pkr_to_afn"}
                onChange={() => setRates((prev) => ({ ...prev, afnPkrDirection: "pkr_to_afn" }))}
              />{" "}
              {tr("currency.pkrToAfnRate")} — {tr("currency.useThisRate")}
            </label>
            <input
              type="number"
              step="0.01"
              value={rates.afnPer1000Pkr}
              onChange={(e) => setRates((prev) => ({ ...prev, afnPer1000Pkr: Number(e.target.value) || 0 }))}
              style={{ width: "100%" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
