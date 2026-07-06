// =====================================================
// Thème « Violette électrique » — évolution vive du Coton doux.
// Même design (rondeur, Nunito, douceur), couleurs saturées et
// lumineuses : violet vif, menthe, orange chaud, rose franc.
// =====================================================
export const colors = {
  // Violet vif — couleur principale de la marque.
  primary: "#8A63F0",
  primaryDark: "#6C46D9",
  primaryLight: "#F0EAFE",
  // Menthe éclatante — validations, santé, succès.
  secondary: "#00B894",
  // Orange chaud — moments précieux (accents, badges).
  accent: "#FF8A3D",
  // Fonds : blanc chaud (jamais de blanc pur clinique).
  background: "#FCFBFF",
  surface: "#F5F2FC",
  card: "#FFFFFF",
  // Encre adoucie (jamais de noir pur).
  text: "#332F3F",
  textMuted: "#8B8599",
  border: "#EDE9F5",
  success: "#00B894",
  successSoft: "#E2F8F1",
  // Rose franc — destructif/règles, vif mais chaleureux.
  danger: "#FF5C8A",
  dangerSoft: "#FFE8EF",
  warning: "#FFAD33",
  warningSoft: "#FFF3DD",
  info: "#8A63F0",
  infoSoft: "#F0EAFE",
  neutralSoft: "#F0EDF6",
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

// Rondeur généreuse — signature « Coton doux ».
export const radius = {
  sm: 12,
  md: 18,
  lg: 26,
  pill: 999,
} as const;

// Ombres teintées lavande (douces, jamais grises/dures).
export const shadows = {
  sm: {
    shadowColor: "#5C48A8",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  md: {
    shadowColor: "#5C48A8",
    shadowOpacity: 0.13,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  lg: {
    shadowColor: "#5C48A8",
    shadowOpacity: 0.18,
    shadowRadius: 26,
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

// Mise en page responsive. Au-delà du breakpoint (tablette / grand écran / web),
// le contenu est contraint à `maxContentWidth` et centré (rendu téléphone inchangé
// en dessous). Purement additif.
export const layout = {
  maxContentWidth: 640,
  tabletBreakpoint: 700,
} as const;

// Familles de polices chargées dans app/_layout.tsx (useFonts).
// TOUT en Nunito (sans-serif ronde et chaleureuse) — la hiérarchie se fait par
// la graisse ; les titres montent jusqu'à ExtraBold pour la personnalité.
export const fonts = {
  titleBold: "Nunito_800ExtraBold",
  titleSemiBold: "Nunito_700Bold",
  body: "Nunito_500Medium",
  bodyMedium: "Nunito_600SemiBold",
  bodySemiBold: "Nunito_700Bold",
  bodyBold: "Nunito_800ExtraBold",
} as const;

export const typography = {
  h1: { fontSize: 28, lineHeight: 34, letterSpacing: 0.1, fontWeight: "800" as const, fontFamily: fonts.titleBold, color: colors.text },
  h2: { fontSize: 22, lineHeight: 28, letterSpacing: 0.1, fontWeight: "800" as const, fontFamily: fonts.titleBold, color: colors.text },
  h3: { fontSize: 18, lineHeight: 24, letterSpacing: 0.1, fontWeight: "800" as const, fontFamily: fonts.titleBold, color: colors.text },
  // Sous-titre : intermédiaire entre h3 et body (gris, pour introduire une section).
  subtitle: { fontSize: 16, lineHeight: 22, fontWeight: "700" as const, fontFamily: fonts.bodySemiBold, color: colors.textMuted },
  body: { fontSize: 15, lineHeight: 21, fontWeight: "500" as const, fontFamily: fonts.body, color: colors.text },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "500" as const, fontFamily: fonts.body, color: colors.textMuted },
  // Nom / titre principal de carte ou de ligne de liste (gras, taille corps).
  name: { fontSize: 15, lineHeight: 20, fontWeight: "800" as const, fontFamily: fonts.bodyBold, color: colors.text },
} as const;

// Couleurs des phases du cycle — partagées par CycleRing (accueil) et le
// calendrier, pour une convention cohérente. "Soft" = fond clair de pastille.
export const phase = {
  period: "#FF5C8A", // Règles → rose franc
  periodSoft: "#FFE8EF", // Règles prévues → rose très clair
  fertile: colors.primary, // Fenêtre fertile → violet vif (#8A63F0)
  fertileSoft: colors.primaryLight, // → violet clair (#F0EAFE)
  ovulation: "#FFAD33", // Ovulation → ambre lumineux
  ovulationSoft: colors.warningSoft, // → ambre très clair (#FFF3DD)
  neutral: "#ECE8F4", // Reste du cycle → gris violet clair
} as const;

export const theme = { colors, spacing, radius, shadows, durations, layout, typography, fonts, phase };
