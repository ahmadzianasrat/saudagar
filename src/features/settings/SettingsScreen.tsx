import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage, type Language, type DigitStyle, type DateSystem } from "../../contexts/LanguageContext";
import { useTranslation } from "../../i18n/useTranslation";
import { supabase } from "../../lib/supabaseClient";
import { colors, radius, shadow } from "../../theme";
import { Card, SectionLabel, SegmentedControl } from "../../components/ui";
import {
  ChevronIcon,
  CrownIcon,
  GlobeIcon,
  LockIcon,
  LogOutIcon,
  SwapIcon,
} from "../../components/icons";

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
    dateSystem, setDateSystem,
  } = useLanguage();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/");
  }

  return (
    <div style={{ padding: 16, paddingBottom: 28 }}>
      <h1 style={{ fontSize: 19, fontWeight: 700, color: colors.textPrimary, margin: "0 0 16px" }}>{tr("settings.title")}</h1>

      <section>
        <SectionLabel style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <GlobeIcon size={14} /> {tr("settings.language")}
        </SectionLabel>
        <SegmentedControl value={language} onChange={setLanguage} options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))} />
      </section>

      <section style={{ marginTop: 22 }}>
        <SectionLabel>{tr("settings.numberFormat")}</SectionLabel>
        <Card style={{ display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 6 }}>{tr("settings.digitStyle")}</div>
            <SegmentedControl
              value={digitStyle}
              onChange={setDigitStyle}
              options={([
                { value: "western" as DigitStyle, label: tr("settings.western") },
                { value: "eastern_arabic" as DigitStyle, label: tr("settings.eastern") },
              ])}
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
            <span style={{ fontSize: 13.5, color: colors.textPrimary }}>{tr("settings.thousandSeparator")}</span>
            <Toggle checked={useThousandSeparator} onChange={setUseThousandSeparator} />
          </label>
        </Card>
      </section>

      <section style={{ marginTop: 22 }}>
        <SectionLabel>{tr("settings.dateSystem")}</SectionLabel>
        <SegmentedControl
          value={dateSystem}
          onChange={setDateSystem}
          options={([
            { value: "gregorian" as DateSystem, label: tr("settings.gregorian") },
            { value: "shamsi" as DateSystem, label: tr("settings.shamsi") },
          ])}
        />
      </section>

      <section style={{ marginTop: 24 }}>
        <Card style={{ padding: 4 }}>
          <SettingsRow icon={<CrownIcon size={18} />} tone="amber" label={tr("settings.manageSubscription")} onClick={() => navigate("/subscription")} first />
          <SettingsRow icon={<SwapIcon size={18} />} tone="purple" label={tr("settings.currencyConverter")} onClick={() => navigate("/tools/currency-converter")} />
          <SettingsRow icon={<LockIcon size={18} />} tone="primary" label={tr("settings.changePassword")} onClick={() => navigate("/settings/change-password")} />
          <SettingsRow icon={<LogOutIcon size={18} />} tone="danger" label={tr("settings.logout")} onClick={handleLogout} />
        </Card>
      </section>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 42,
        height: 24,
        borderRadius: radius.pill,
        border: "none",
        background: checked ? colors.primary : colors.border,
        position: "relative",
        cursor: "pointer",
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          insetInlineStart: checked ? 21 : 3,
          width: 18,
          height: 18,
          borderRadius: radius.pill,
          background: colors.white,
          transition: "inset-inline-start 0.15s",
          boxShadow: shadow.card,
        }}
      />
    </button>
  );
}

const TONES: Record<string, { bg: string; fg: string }> = {
  primary: { bg: colors.primarySoft, fg: colors.primary },
  amber: { bg: colors.amberSoft, fg: colors.amber },
  purple: { bg: colors.purpleSoft, fg: colors.purple },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
};

function SettingsRow({
  icon,
  tone,
  label,
  onClick,
  first,
}: {
  icon: ReactNode;
  tone: keyof typeof TONES;
  label: string;
  onClick: () => void;
  first?: boolean;
}) {
  const { bg, fg } = TONES[tone];
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 10px",
        background: "none",
        border: "none",
        borderTop: first ? "none" : `1px solid ${colors.border}`,
        cursor: "pointer",
        textAlign: "start",
      }}
    >
      <div style={{ width: 36, height: 36, borderRadius: radius.pill, background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: tone === "danger" ? colors.danger : colors.textPrimary }}>{label}</span>
      <ChevronIcon size={16} dir="end" color={colors.textFaint} />
    </button>
  );
}
