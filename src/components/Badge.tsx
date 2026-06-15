import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, spacing, typography } from "@/theme";

export type BadgeTone = "primary" | "success" | "danger" | "warning" | "info" | "neutral";

// Pilule de statut tokenisée (radius.pill). Variante pleine (texte blanc) par
// défaut, ou `soft` (fond doux + texte coloré). `color` force une couleur ad hoc
// (rétro-compat avec les badges qui calculent déjà leur couleur de statut).
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
  neutral: { bg: colors.neutralSoft, fg: colors.textMuted },
};

export function Badge({
  label,
  tone = "neutral",
  color,
  soft = false,
  style,
}: {
  label: string;
  tone?: BadgeTone;
  color?: string;
  soft?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  if (soft) {
    const s = SOFT[tone];
    return (
      <View style={[styles.pill, { backgroundColor: s.bg }, style]}>
        <Text style={[styles.text, { color: color ?? s.fg }]}>{label}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.pill, { backgroundColor: color ?? SOLID[tone] }, style]}>
      <Text style={[styles.text, styles.textSolid]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: "flex-start", paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden" },
  text: { ...typography.caption, fontWeight: "700" },
  textSolid: { color: colors.white },
});
