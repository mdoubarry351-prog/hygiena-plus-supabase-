import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/theme";

/**
 * En-tête partagé des sous-écrans (tout écran qui n'est PAS un onglet principal).
 * Flèche de retour (← chevron) qui fait un vrai router.back() (pop d'un niveau,
 * cohérent avec le backBehavior "history" des onglets) + titre optionnel.
 * Placement et style identiques partout pour la cohérence de navigation.
 * À placer comme premier enfant de <Screen> (au-dessus du contenu défilant).
 */
export function ScreenHeader({ title, right }: { title?: string; right?: ReactNode }) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel="Retour"
      >
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
      {title ? (
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      ) : (
        <View style={styles.flex} />
      )}
      {right ? <View>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingTop: spacing.lg, paddingBottom: spacing.xs },
  back: { padding: spacing.xs, marginLeft: -spacing.xs },
  title: { ...typography.h2, flex: 1 },
  flex: { flex: 1 },
});
