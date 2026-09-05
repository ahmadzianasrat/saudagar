import { useLanguage } from "../contexts/LanguageContext";
import { t } from "./index";

// Bound to the active language from context, so every screen just
// calls `const { tr } = useTranslation()` and `tr("some.key")` without
// threading `language` through manually everywhere.
export function useTranslation() {
  const { language } = useLanguage();
  return { tr: (key: string, vars?: Record<string, string | number>) => t(key, language, vars), language };
}
