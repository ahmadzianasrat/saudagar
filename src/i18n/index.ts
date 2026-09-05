import en from "./en.json";
import ps from "./ps.json";
import da from "./da.json";
import type { Language } from "../contexts/LanguageContext";

type TranslationKey = keyof typeof en;

const translations: Record<Language, Record<string, string>> = { en, ps, da };

// Falls back to English if a key is missing in the active language
// (e.g. a Pashto/Dari string not yet reviewed/added), then to the
// raw key itself if even English is missing it — so a missing
// translation is visibly ugly ("subscription.newThing") rather than
// silently blank, which is easier to spot during testing.
export function t(key: TranslationKey | string, language: Language, vars?: Record<string, string | number>): string {
  let str = translations[language]?.[key] ?? translations.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, String(v));
    }
  }
  return str;
}
