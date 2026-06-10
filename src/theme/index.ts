export const colors = {
  primary: "#10B981",
  primaryDark: "#059669",
  primaryLight: "#D1FAE5",
  secondary: "#6366F1",
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

// Familles de polices chargées dans app/_layout.tsx (useFonts).
// TOUT en Inter (sans-serif) — la hiérarchie se fait uniquement par la graisse.
export const fonts = {
  titleBold: "Inter_700Bold",
  titleSemiBold: "Inter_600SemiBold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemiBold: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: "700" as const, fontFamily: fonts.titleBold, color: colors.text },
  h2: { fontSize: 22, fontWeight: "700" as const, fontFamily: fonts.titleBold, color: colors.text },
  h3: { fontSize: 18, fontWeight: "600" as const, fontFamily: fonts.titleSemiBold, color: colors.text },
  body: { fontSize: 15, fontWeight: "400" as const, fontFamily: fonts.body, color: colors.text },
  caption: { fontSize: 13, fontWeight: "400" as const, fontFamily: fonts.body, color: colors.textMuted },
} as const;

// Couleurs des phases du cycle — partagées par CycleRing (accueil) et le
// calendrier, pour une convention cohérente. "Soft" = fond clair de pastille.
export const phase = {
  period: "#EF4444", // Règles → rouge
  periodSoft: "#FEE2E2", // Règles prévues → rouge très clair
  fertile: colors.primary, // Fenêtre fertile → vert (#10B981)
  fertileSoft: colors.primaryLight, // → vert clair (#D1FAE5)
  ovulation: "#3B82F6", // Ovulation → bleu
  ovulationSoft: "#DBEAFE", // → bleu clair
  neutral: "#E5E7EB", // Reste du cycle → gris clair
} as const;

export const theme = { colors, spacing, radius, typography, fonts, phase };
