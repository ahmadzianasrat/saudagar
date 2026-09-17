// ============================================================
// Single source of truth for the shop's saved AFN<->PKR exchange
// rate — shared between the standalone Currency Converter tool and
// the inventory purchase/sale forms (Phase 3 multi-currency), so
// both read/write the exact same localStorage entry rather than two
// screens silently drifting out of sync with their own copies.
//
// No live exchange-rate API — rates are set manually by the shop
// owner and persisted locally. AFN<->PKR has TWO possible rate
// definitions (1000 AFN = ? PKR, or 1000 PKR = ? AFN) which won't
// always agree exactly — rather than silently picking one, the app
// tracks which one the user says is authoritative (afnPkrDirection).
// ============================================================

const STORAGE_KEY = "saudagar:currency-rates-v2";

export interface Rates {
  afnPerUsd: number; // "1 USD = ? AFN"
  pkrPer1000Afn: number; // "1000 AFN = ? PKR"
  afnPer1000Pkr: number; // "1000 PKR = ? AFN"
  afnPkrDirection: "afn_to_pkr" | "pkr_to_afn";
}

export const DEFAULT_RATES: Rates = {
  afnPerUsd: 88,
  pkrPer1000Afn: 3140,
  afnPer1000Pkr: 318.5,
  afnPkrDirection: "afn_to_pkr",
};

export function loadRates(): Rates {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_RATES, ...JSON.parse(raw) } : DEFAULT_RATES;
  } catch {
    return DEFAULT_RATES;
  }
}

export function saveRates(rates: Rates) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rates));
  } catch {
    // localStorage can throw in private-browsing contexts — the
    // rates just won't persist across sessions in that case.
  }
}

// How many AFN is 1 PKR worth, given the currently-saved rates and
// whichever direction the shop marked as authoritative.
export function afnPerPkr(rates: Rates = loadRates()): number {
  return rates.afnPkrDirection === "pkr_to_afn"
    ? rates.afnPer1000Pkr / 1000
    : 1 / (rates.pkrPer1000Afn / 1000);
}

export function pkrToAfn(amount: number, rates: Rates = loadRates()): number {
  return amount * afnPerPkr(rates);
}

export function afnToPkr(amount: number, rates: Rates = loadRates()): number {
  return amount / afnPerPkr(rates);
}
