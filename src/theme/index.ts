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
  successSoft: "#D6F5E8",
  danger: "#FF4D6D",
  dangerSoft: "#FFE0E6",
  // Avertissement (ambre, cohérent avec `accent`) + fond doux.
  warning: "#F59E0B",
  warningSoft: "#FFF3E0",
  // Information (indigo, à partir de `secondary`) + fond doux.
  info: "#6366F1",
  infoSoft: "#E0E2FF",
  neutralSoft: "#EEF0F4",
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

// Ombres réutilisables (douces, premium) avec équivalent `elevation` Android.
// sm = cartes au repos ; md = éléments surélevés / état pressé ; lg = modales.
export const shadows = {
  sm: {
    shadowColor: "#1A1525",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  md: {
    shadowColor: "#1A1525",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  lg: {
    shadowColor: "#1A1525",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
} as const;

// Durées d'animation (ms) — micro-interactions cohérentes.
export const durations = {
  fast: 120,
  normal: 200,
  slow: 320,
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
  h1: { fontSize: 28, lineHeight: 34, letterSpacing: 0.2, fontWeight: "700" as const, fontFamily: fonts.titleBold, color: colors.text },
  h2: { fontSize: 22, lineHeight: 28, letterSpacing: 0.2, fontWeight: "700" as const, fontFamily: fonts.titleBold, color: colors.text },
  h3: { fontSize: 18, lineHeight: 24, letterSpacing: 0.1, fontWeight: "700" as const, fontFamily: fonts.titleBold, color: colors.text },
  // Sous-titre : intermédiaire entre h3 et body (gris, pour introduire une section).
  subtitle: { fontSize: 16, lineHeight: 22, fontWeight: "600" as const, fontFamily: fonts.bodySemiBold, color: colors.textMuted },
  body: { fontSize: 15, lineHeight: 21, fontWeight: "400" as const, fontFamily: fonts.body, color: colors.text },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "400" as const, fontFamily: fonts.body, color: colors.textMuted },
  // Nom / titre principal de carte ou de ligne de liste (gras, taille corps).
  name: { fontSize: 15, lineHeight: 20, fontWeight: "700" as const, fontFamily: fonts.bodyBold, color: colors.text },
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

export const theme = { colors, spacing, radius, shadows, durations, typography, fonts, phase };
