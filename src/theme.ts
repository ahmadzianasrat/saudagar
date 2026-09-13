// ============================================================
// Design tokens — single source of truth for color/spacing/radius
// across the app. Introduced to bring a consistent look (matching
// the reference UI screenshots: soft blue background, white rounded
// cards, colored circular icon badges, blue primary actions) to a
// codebase that previously used raw inline styles with no shared
// palette. Plain objects only — no CSS-in-JS library, consistent
// with the rest of the app's "inline styles, no framework" approach.
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
  nav: "0 -2px 16px rgba(20, 40, 90, 0.06)",
} as const;

export const spacing = (n: number) => n * 4;

export const fontStack =
  "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Noto Sans Arabic', Tahoma, Arial, sans-serif";

// Shared, reusable inline-style fragments so every screen doesn't
// hand-roll the same input/button chrome slightly differently.
export const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "12px 14px",
  fontSize: 14,
  borderRadius: radius.md,
  border: `1px solid ${colors.border}`,
  background: colors.surfaceMuted,
  color: colors.textPrimary,
  outline: "none",
};

export const cardStyle = {
  background: colors.surface,
  borderRadius: radius.lg,
  boxShadow: shadow.card,
  padding: 16,
};

export const primaryButtonStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "13px 16px",
  fontSize: 15,
  fontWeight: 600,
  color: colors.white,
  background: colors.primary,
  border: "none",
  borderRadius: radius.md,
  cursor: "pointer",
};

export const secondaryButtonStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "13px 16px",
  fontSize: 14,
  fontWeight: 600,
  color: colors.primary,
  background: colors.primarySoft,
  border: "none",
  borderRadius: radius.md,
  cursor: "pointer",
};
