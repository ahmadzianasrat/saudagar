// ============================================================
// Design tokens for the admin panel. This is a separate Vite app
// from the main PWA (deliberately, for attack-surface hygiene — see
// vite.config.ts), so tokens are duplicated here rather than shared
// via import. Kept in sync in spirit with ../src/theme.ts in the
// root app so both surfaces feel like the same product.
// ============================================================

export const colors = {
  bg: "#EEF3FB",
  surface: "#FFFFFF",
  surfaceMuted: "#F5F8FD",
  border: "#E7ECF5",

  textPrimary: "#101B33",
  textSecondary: "#7B879C",
  textFaint: "#A6B0C3",

  primary: "#1E63D6",
  primaryDark: "#154FAE",
  primarySoft: "#E4EEFD",

  success: "#1DA463",
  successSoft: "#E4F7EC",
  danger: "#E23D3D",
  dangerSoft: "#FCE9E9",
  purple: "#8B5CF6",
  purpleSoft: "#F1EAFE",
  amber: "#C77B00",
  amberSoft: "#FDF1DE",

  white: "#FFFFFF",
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
} as const;

export const shadow = {
  card: "0 2px 14px rgba(20, 40, 90, 0.06)",
  raised: "0 6px 20px rgba(20, 40, 90, 0.10)",
} as const;

export const layout = {
  sidebarWidth: 232,
  topbarHeight: 60,
} as const;

export const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "10px 14px",
  fontSize: 14,
  borderRadius: radius.md,
  border: `1px solid ${colors.border}`,
  background: colors.surfaceMuted,
  color: colors.textPrimary,
  outline: "none",
};

export const primaryButtonStyle = {
  padding: "10px 18px",
  fontSize: 13.5,
  fontWeight: 600,
  color: colors.white,
  background: colors.primary,
  border: "none",
  borderRadius: radius.md,
  cursor: "pointer",
};

export const secondaryButtonStyle = {
  padding: "10px 18px",
  fontSize: 13.5,
  fontWeight: 600,
  color: colors.primary,
  background: colors.primarySoft,
  border: "none",
  borderRadius: radius.md,
  cursor: "pointer",
};

export const dangerButtonStyle = {
  padding: "9px 16px",
  fontSize: 13,
  fontWeight: 600,
  color: colors.danger,
  background: colors.dangerSoft,
  border: "none",
  borderRadius: radius.md,
  cursor: "pointer",
};
