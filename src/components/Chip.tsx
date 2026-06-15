import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography } from "@/theme";

// Pastille de filtre/sélection tokenisée : état actif (vert plein) / inactif
// (contour). Icône optionnelle à gauche. Visuel identique aux chips existantes.
export function Chip({
  label,
  active = false,
  onPress,
  icon,
  style,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive, style]}>
      {icon ? <Ionicons name={icon} size={13} color={active ? colors.white : colors.textMuted} /> : null}
      <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { ...typography.caption, fontSize: 13, fontWeight: "700", color: colors.text },
  textActive: { color: colors.white },
});
