import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, spacing, typography } from "@/theme";

export type BadgeTone = "primary" | "success" | "danger" | "warning" | "info" | "neutral";
export type BadgeVariant = "solid" | "soft";

// Pilule de statut tokenisée (radius.pill).
// - variant 'solid' (défaut) : fond plein + texte blanc.
// - variant 'soft' : fond doux + texte teinté (badges publié/brouillon…).
// - `color` force une couleur ad hoc (rétro-compat avec les statuts déjà calculés).
// - `dense` : paddingVertical réduit (1) pour coller à certains badges existants.
const SOLID: Record<BadgeTone, string> = {
  primary: colors.primary,
  success: colors.success,
  danger: colors.danger,
  warning: colors.warning,
  info: colors.info,
  neutral: colors.textMuted,
};
const SOFT: Record<BadgeTone, { bg: string; fg: string }> = {
  primary: { bg: colors.primaryLight, fg: colors.primaryDark },
  success: { bg: colors.successSoft, fg: colors.success },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  info: { bg: colors.infoSoft, fg: colors.info },
  // « neutral » doux = fond surface (cohérent avec les badges « off » existants).
  neutral: { bg: colors.surface, fg: colors.textMuted },
};

export function Badge({
  label,
  tone = "neutral",
  color,
  variant = "solid",
  soft = false,
  dense = false,
  style,
}: {
  label: string;
  tone?: BadgeTone;
  color?: string;
  variant?: BadgeVariant;
  soft?: boolean; // alias rétro-compatible de variant="soft"
  dense?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isSoft = variant === "soft" || soft;
  const pill = [styles.pill, dense && styles.dense, style];

  if (isSoft) {
    const s = SOFT[tone];
    return (
      <View style={[...pill, { backgroundColor: s.bg }]}>
        <Text style={[styles.text, { color: color ?? s.fg }]}>{label}</Text>
      </View>
    );
  }
  return (
    <View style={[...pill, { backgroundColor: color ?? SOLID[tone] }]}>
      <Text style={[styles.text, styles.textSolid]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: "flex-start", paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden" },
  dense: { paddingVertical: 1 },
  text: { ...typography.caption, fontWeight: "700" },
  textSolid: { color: colors.white },
});
