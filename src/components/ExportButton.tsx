import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@/theme";

// Bouton « Exporter CSV » (sobre) pour l'en-tête des listes admin.
export function ExportButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.btn} accessibilityRole="button" accessibilityLabel="Exporter en CSV">
      <Ionicons name="download-outline" size={22} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { padding: spacing.xs },
});
