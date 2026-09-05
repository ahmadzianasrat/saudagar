import { useNavigate } from "react-router-dom";
import { useLanguage, type Language, type DigitStyle } from "../../contexts/LanguageContext";
import { useTranslation } from "../../i18n/useTranslation";
import { supabase } from "../../lib/supabaseClient";

const LANGUAGES: { code: Language; label: string }[] = [
  { code: "ps", label: "پښتو" },
  { code: "da", label: "دری" },
  { code: "en", label: "English" },
];

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { tr } = useTranslation();
  const {
    language, setLanguage,
    digitStyle, setDigitStyle,
    useThousandSeparator, setUseThousandSeparator,
  } = useLanguage();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/");
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>{tr("settings.title")}</h2>

      <section style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 6 }}>{tr("settings.language")}</div>
        <div style={{ display: "flex", gap: 8 }}>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => setLanguage(l.code)}
              style={{
                flex: 1,
                padding: 10,
                background: language === l.code ? "#1e6f5c" : "#f0f0f0",
                color: language === l.code ? "#fff" : "#333",
                border: "none",
                borderRadius: 6,
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 20 }}>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 6 }}>{tr("settings.numberFormat")}</div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>{tr("settings.digitStyle")}</div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["western", "eastern_arabic"] as DigitStyle[]).map((style) => (
              <button
                key={style}
                onClick={() => setDigitStyle(style)}
                style={{
                  flex: 1,
                  padding: 10,
                  background: digitStyle === style ? "#1e6f5c" : "#f0f0f0",
                  color: digitStyle === style ? "#fff" : "#333",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                {style === "western" ? tr("settings.western") : tr("settings.eastern")}
              </button>
            ))}
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          <input
            type="checkbox"
            checked={useThousandSeparator}
            onChange={(e) => setUseThousandSeparator(e.target.checked)}
          />
          {tr("settings.thousandSeparator")}
        </label>
      </section>

      <section style={{ marginTop: 24, display: "grid", gap: 8 }}>
        <button onClick={() => navigate("/subscription")} style={{ padding: 12 }}>
          {tr("settings.manageSubscription")}
        </button>
        <button onClick={() => navigate("/settings/change-password")} style={{ padding: 12 }}>
          {tr("settings.changePassword")}
        </button>
        <button onClick={handleLogout} style={{ padding: 12, color: "#b3261e" }}>
          {tr("settings.logout")}
        </button>
      </section>
    </div>
  );
}
