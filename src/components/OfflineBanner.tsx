import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography } from "@/theme";

// Bannière discrète affichée quand on montre des données issues du cache (hors-ligne).
export function OfflineBanner({ cachedAt }: { cachedAt: string | null }) {
  const label = cachedAt
    ? new Date(cachedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "dernier chargement";
  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline-outline" size={16} color={colors.textMuted} />
      <Text style={styles.text}>Hors-ligne — données du {label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  text: { ...typography.caption, color: colors.textMuted, flex: 1 },
});
