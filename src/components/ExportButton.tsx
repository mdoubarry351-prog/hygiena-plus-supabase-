import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@/theme";

// Bouton « Exporter CSV » (sobre) pour l'en-tête des listes admin.
// `loading` : export complet en cours (récupération de toutes les pages).
export function ExportButton({ onPress, loading = false }: { onPress: () => void; loading?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      hitSlop={8}
      style={styles.btn}
      accessibilityRole="button"
      accessibilityLabel="Exporter en CSV"
      accessibilityState={{ disabled: loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Ionicons name="download-outline" size={22} color={colors.text} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { padding: spacing.xs },
});
