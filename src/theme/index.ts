export const colors = {
  primary: "#FF5C8A",
  primaryDark: "#E84371",
  primaryLight: "#FFE4ED",
  secondary: "#7C6CF6",
  accent: "#FFB23E",
  background: "#FFFFFF",
  surface: "#F8F7FB",
  card: "#FFFFFF",
  text: "#1A1525",
  textMuted: "#6B6577",
  border: "#ECE9F2",
  success: "#2ECC8F",
  danger: "#FF4D6D",
  white: "#FFFFFF",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: "700" as const, color: colors.text },
  h2: { fontSize: 22, fontWeight: "700" as const, color: colors.text },
  h3: { fontSize: 18, fontWeight: "600" as const, color: colors.text },
  body: { fontSize: 15, fontWeight: "400" as const, color: colors.text },
  caption: { fontSize: 13, fontWeight: "400" as const, color: colors.textMuted },
} as const;

export const theme = { colors, spacing, radius, typography };
