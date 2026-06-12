import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography } from "@/theme";

/**
 * Bannière de rappel médical discrète et réutilisable.
 * Ton sobre (gris/vert), petite icône info, pas de bloc rouge alarmant.
 * - `compact` : version très courte (icône + texte sur une ligne, fond transparent).
 */
export function MedicalDisclaimer({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <View
      style={[styles.base, compact ? styles.compact : styles.banner]}
      accessibilityRole="text"
      accessibilityLabel={`Information : ${text}`}
    >
      <Ionicons
        name="information-circle-outline"
        size={compact ? 14 : 16}
        color={colors.textMuted}
        style={styles.icon}
      />
      <Text style={[styles.text, compact && styles.textCompact]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xs },
  // Bannière : léger fond gris et coins arrondis pour bien séparer du contenu.
  banner: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  // Compacte : sans fond, juste une mention discrète en ligne.
  compact: { paddingVertical: spacing.xs },
  icon: { marginTop: 1 },
  text: { ...typography.caption, color: colors.textMuted, flex: 1, lineHeight: 18 },
  textCompact: { fontSize: 12, lineHeight: 16 },
});
