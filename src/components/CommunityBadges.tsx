import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { categoryLabel } from "@/lib/community-service";
import { colors, radius, spacing, typography } from "@/theme";

// Badge « Médecin vérifié » (auteur médecin validé, non anonyme).
export function VerifiedDoctorBadge() {
  return (
    <View style={styles.badge}>
      <Ionicons name="checkmark-circle" size={12} color={colors.primaryDark} />
      <Text style={styles.badgeText}>Médecin vérifié</Text>
    </View>
  );
}

// Tag de catégorie d'une publication.
export function CategoryTag({ category }: { category: string | null }) {
  if (!category) return null;
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{categoryLabel(category)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: colors.primaryLight, paddingHorizontal: spacing.xs, paddingVertical: 1,
    borderRadius: radius.pill,
  },
  badgeText: { ...typography.caption, fontSize: 11, color: colors.primaryDark, fontWeight: "700" },
  tag: {
    alignSelf: "flex-start", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill,
  },
  tagText: { ...typography.caption, fontSize: 11, color: colors.textMuted, fontWeight: "700" },
});
