// ============================================================
// Language + number-format preference.
// ------------------------------------------------------------
// Decisions this implements:
//   - 3 languages: en, ps (Pashto, default), da (Dari).
//   - Persisted in localStorage only (not server-side) — a device
//     change means a one-time re-selection, judged an acceptable
//     tradeoff to avoid schema/sync complexity.
//   - Preference persists across navigation/actions until changed
//     explicitly — enforced by loading it once here at the top of
//     the component tree via Context, not re-derived per page.
//   - Digit style (Western default) and thousand-separator
//     (active by default) are independent, user-toggleable settings.
// ============================================================

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Language = "en" | "ps" | "da";
export type DigitStyle = "western" | "eastern_arabic";
export type DateSystem = "gregorian" | "shamsi";

interface LanguagePrefs {
  language: Language;
  digitStyle: DigitStyle;
  useThousandSeparator: boolean;
  dateSystem: DateSystem;
}

interface LanguageContextValue extends LanguagePrefs {
  setLanguage: (lang: Language) => void;
  setDigitStyle: (style: DigitStyle) => void;
  setUseThousandSeparator: (value: boolean) => void;
  setDateSystem: (system: DateSystem) => void;
  isRTL: boolean;
  formatNumber: (value: number) => string;
}

const STORAGE_KEY = "saudagar:prefs";

const DEFAULT_PREFS: LanguagePrefs = {
  language: "ps",
  digitStyle: "western",
  useThousandSeparator: true,
  dateSystem: "gregorian",
};

const EASTERN_ARABIC_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

function loadPrefs(): LanguagePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: LanguagePrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<LanguagePrefs>(loadPrefs);

  useEffect(() => {
    savePrefs(prefs);
    document.documentElement.dir = prefs.language === "en" ? "ltr" : "rtl";
    document.documentElement.lang = prefs.language;
  }, [prefs]);

  function formatNumber(value: number): string {
    let str = prefs.useThousandSeparator
      ? value.toLocaleString("en-US") // gives "1,234" grouping; digit swap happens after
      : String(value);

    if (prefs.digitStyle === "eastern_arabic") {
      str = str.replace(/[0-9]/g, (d) => EASTERN_ARABIC_DIGITS[Number(d)]);
    }
    return str;
  }

  const value: LanguageContextValue = {
    ...prefs,
    setLanguage: (language) => setPrefs((p) => ({ ...p, language })),
    setDigitStyle: (digitStyle) => setPrefs((p) => ({ ...p, digitStyle })),
    setUseThousandSeparator: (useThousandSeparator) => setPrefs((p) => ({ ...p, useThousandSeparator })),
    setDateSystem: (dateSystem) => setPrefs((p) => ({ ...p, dateSystem })),
    isRTL: prefs.language !== "en",
    formatNumber,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
