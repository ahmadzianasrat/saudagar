import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../../i18n/useTranslation";
import { useLanguage } from "../../contexts/LanguageContext";

// No live exchange-rate API is wired up — rates are set manually by
// the user and persisted locally. This is a deliberate scope choice:
// a live-rate integration needs a reliable data source and ongoing
// maintenance, which is a separate decision from "give traders a
// quick way to convert between currencies they already know the
// rate for." Worth upgrading to a live feed later if that becomes
// a real pain point.
const STORAGE_KEY = "saudagar:currency-rates";
const DEFAULT_RATES: Record<string, number> = {
  USD: 0.0113, // 1 AFN = ~0.0113 USD, i.e. ~88 AFN/USD — update to current rate
  PKR: 3.14,
  INR: 0.945,
};

function loadRates(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_RATES, ...JSON.parse(raw) } : DEFAULT_RATES;
  } catch {
    return DEFAULT_RATES;
  }
}

export default function CurrencyConverterScreen() {
  const navigate = useNavigate();
  const { tr } = useTranslation();
  const { formatNumber } = useLanguage();

  const [rates, setRates] = useState<Record<string, number>>(loadRates);
  const [editingRates, setEditingRates] = useState(false);
  const [amount, setAmount] = useState("1");
  const [fromCurrency, setFromCurrency] = useState("AFN");
  const [toCurrency, setToCurrency] = useState("USD");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rates));
  }, [rates]);

  const currencies = ["AFN", ...Object.keys(rates)];

  function toAFN(value: number, currency: string): number {
    if (currency === "AFN") return value;
    return value / rates[currency];
  }

  function fromAFN(value: number, currency: string): number {
    if (currency === "AFN") return value;
    return value * rates[currency];
  }

  const numericAmount = Number(amount) || 0;
  const result = fromAFN(toAFN(numericAmount, fromCurrency), toCurrency);

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
        <div style={{ display: "flex", gap: 8 }}>
          <select value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)} style={{ flex: 1 }}>
            {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <span style={{ alignSelf: "center" }}>→</span>
          <select value={toCurrency} onChange={(e) => setToCurrency(e.target.value)} style={{ flex: 1 }}>
            {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
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
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {Object.entries(rates).map(([currency, rate]) => (
            <div key={currency} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 100 }}>{tr("currency.rateFor")} {currency}</span>
              <input
                type="number"
                step="0.0001"
                value={rate}
                onChange={(e) => setRates((prev) => ({ ...prev, [currency]: Number(e.target.value) || 0 }))}
                style={{ flex: 1 }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
