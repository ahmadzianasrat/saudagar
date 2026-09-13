import type { CSSProperties, ReactNode } from "react";
import { colors, radius, shadow } from "./theme";

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: colors.surface,
        borderRadius: radius.lg,
        boxShadow: shadow.card,
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Avatar({ label, size = 34 }: { label: string; size?: number }) {
  const palette = [
    { bg: "#E4EEFD", fg: "#1E63D6" },
    { bg: "#E4F7EC", fg: "#1DA463" },
    { bg: "#F1EAFE", fg: "#8B5CF6" },
    { bg: "#FDF1DE", fg: "#C77B00" },
    { bg: "#FCE9E9", fg: "#E23D3D" },
  ];
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash << 5) - hash + label.charCodeAt(i);
  const { bg, fg } = palette[Math.abs(hash) % palette.length];
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

export function Pill({ children, bg, fg, style }: { children: ReactNode; bg: string; fg: string; style?: CSSProperties }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 10px",
        borderRadius: radius.pill,
        background: bg,
        color: fg,
        fontSize: 11,
        fontWeight: 700,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function StatCard({
  icon,
  iconBg,
  iconFg,
  label,
  value,
  sublabel,
  sublabelColor,
}: {
  icon: ReactNode;
  iconBg: string;
  iconFg: string;
  label: string;
  value: ReactNode;
  sublabel?: string;
  sublabelColor?: string;
}) {
  return (
    <Card style={{ flex: 1, minWidth: 140 }}>
      <div style={{ width: 38, height: 38, borderRadius: radius.md, background: iconBg, color: iconFg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </div>
      <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 12 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: colors.textPrimary, marginTop: 2 }}>{value}</div>
      {sublabel && <div style={{ fontSize: 11.5, fontWeight: 700, color: sublabelColor ?? colors.textFaint, marginTop: 2 }}>{sublabel}</div>}
    </Card>
  );
}

export function PageHeading({ title, right }: { title: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: colors.textPrimary, margin: 0 }}>{title}</h1>
      {right}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div style={{ textAlign: "center", color: colors.textFaint, fontSize: 13.5, padding: "36px 12px" }}>
      {children}
    </div>
  );
}

// Shown instead of EmptyState while a fetch is in flight, so the
// "no data yet" message never has a chance to flash on screen before
// real data has had a chance to arrive.
export function LoadingRows({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 58,
            borderRadius: radius.md,
            background: `linear-gradient(90deg, ${colors.surfaceMuted} 25%, #ECF1FA 37%, ${colors.surfaceMuted} 63%)`,
            backgroundSize: "400% 100%",
            animation: "admin-shimmer 1.4s ease infinite",
          }}
        />
      ))}
    </div>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <p style={{ color: colors.danger, fontSize: 13, background: colors.dangerSoft, padding: "10px 14px", borderRadius: radius.md, margin: "0 0 14px" }}>
      {children}
    </p>
  );
}

export function SuccessBanner({ children }: { children: ReactNode }) {
  return (
    <div style={{ color: colors.success, fontSize: 13, background: colors.successSoft, padding: "10px 14px", borderRadius: radius.md, margin: "0 0 14px" }}>
      {children}
    </div>
  );
}

export function IconButton({ icon, onClick, tone = "muted" }: { icon: ReactNode; onClick: () => void; tone?: "muted" | "primary" }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 34,
        height: 34,
        borderRadius: radius.pill,
        border: "none",
        background: tone === "primary" ? colors.primarySoft : colors.surfaceMuted,
        color: tone === "primary" ? colors.primary : colors.textSecondary,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      {icon}
    </button>
  );
}
