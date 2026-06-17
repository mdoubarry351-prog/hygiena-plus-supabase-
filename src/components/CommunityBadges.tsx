import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { categoryLabel } from "@/lib/community-service";
import { colors, radius, spacing, typography } from "@/theme";

// Badge « praticien vérifié » (auteur/praticien validé, non anonyme). `label`
// permet d'adapter le terme selon le type (« Médecin vérifié » par défaut,
// « Thérapeute vérifié·e » pour la thérapie). Avec `specialty`, ajoute « · {spé} ».
export function VerifiedDoctorBadge({ specialty, label = "Médecin vérifié" }: { specialty?: string | null; label?: string }) {
  const spec = specialty?.trim();
  return (
    <View style={styles.badge}>
      <Ionicons name="checkmark-circle" size={12} color={colors.primaryDark} />
      <Text style={styles.badgeText}>{label}{spec ? ` · ${spec}` : ""}</Text>
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
