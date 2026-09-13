// ============================================================
// Small reusable presentational building blocks used across every
// screen, so a "card", "icon badge", or "pill button" always looks
// the same. Purely visual — no data/logic lives here.
// ============================================================
import type { CSSProperties, ReactNode } from "react";
import { colors, radius, shadow } from "../theme";

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: colors.surface,
        borderRadius: radius.lg,
        boxShadow: shadow.card,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function IconBadge({
  icon,
  bg,
  fg,
  size = 42,
}: {
  icon: ReactNode;
  bg: string;
  fg: string;
  size?: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: radius.pill,
        background: bg,
        color: fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {icon}
    </div>
  );
}

export function Avatar({ label, size = 42 }: { label: string; size?: number }) {
  const palette = [
    { bg: "#E4EEFD", fg: "#1E63D6" },
    { bg: "#E4F7EC", fg: "#1DA463" },
    { bg: "#F1EAFE", fg: "#8B5CF6" },
    { bg: "#FDF1DE", fg: "#C77B00" },
    { bg: "#FCE9E9", fg: "#E23D3D" },
  ];
  const idx = Math.abs(hashCode(label)) % palette.length;
  const { bg, fg } = palette[idx];
  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: radius.pill,
        background: bg,
        color: fg,
        fontWeight: 700,
        fontSize: size * 0.4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {label.trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash << 5) - hash + str.charCodeAt(i);
  return hash;
}

export function Pill({
  children,
  bg,
  fg,
  style,
}: {
  children: ReactNode;
  bg: string;
  fg: string;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: radius.pill,
        background: bg,
        color: fg,
        fontSize: 11,
        fontWeight: 600,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function SectionLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ fontSize: 12.5, color: colors.textSecondary, fontWeight: 600, marginBottom: 8, ...style }}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  onBack,
  right,
}: {
  title: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onBack && <BackButton onClick={onBack} />}
        <h1 style={{ fontSize: 19, fontWeight: 700, color: colors.textPrimary, margin: 0 }}>{title}</h1>
      </div>
      {right}
    </div>
  );
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="back"
      style={{
        width: 36,
        height: 36,
        borderRadius: radius.pill,
        border: "none",
        background: colors.surface,
        boxShadow: shadow.card,
        color: colors.textPrimary,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <ChevronBack />
    </button>
  );
}

function ChevronBack() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
}) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1,
              padding: "10px 8px",
              fontSize: 13.5,
              fontWeight: 600,
              borderRadius: radius.md,
              border: active ? "none" : `1px solid ${colors.border}`,
              background: active ? colors.primary : colors.surface,
              color: active ? colors.white : colors.textSecondary,
              cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function DirectionToggle({
  value,
  onChange,
  positiveLabel,
  negativeLabel,
  positiveIcon,
  negativeIcon,
}: {
  value: boolean; // true = positive
  onChange: (v: boolean) => void;
  positiveLabel: ReactNode;
  negativeLabel: ReactNode;
  positiveIcon: ReactNode;
  negativeIcon: ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <DirectionButton active={!value} onClick={() => onChange(false)} label={negativeLabel} icon={negativeIcon} tone="danger" />
      <DirectionButton active={value} onClick={() => onChange(true)} label={positiveLabel} icon={positiveIcon} tone="success" />
    </div>
  );
}

function DirectionButton({
  active,
  onClick,
  label,
  icon,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: ReactNode;
  icon: ReactNode;
  tone: "success" | "danger";
}) {
  const on = tone === "success" ? { bg: colors.successSoft, fg: colors.success } : { bg: colors.dangerSoft, fg: colors.danger };
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "11px 8px",
        borderRadius: radius.md,
        border: active ? "none" : `1px solid ${colors.border}`,
        background: active ? on.bg : colors.surface,
        color: active ? on.fg : colors.textSecondary,
        fontWeight: 600,
        fontSize: 14,
        cursor: "pointer",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        textAlign: "center",
        color: colors.textFaint,
        fontSize: 13.5,
        padding: "28px 12px",
      }}
    >
      {children}
    </div>
  );
}

export function DateGroupHeader({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: 700,
        marginTop: 16,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

export function SyncDot({ synced }: { synced: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: radius.pill,
        background: synced ? colors.success : colors.textFaint,
        marginInlineEnd: 4,
      }}
    />
  );
}
