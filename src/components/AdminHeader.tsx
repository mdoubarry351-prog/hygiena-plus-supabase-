import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/theme";

// En-tête commun aux sous-écrans Admin : puce retour vers le hub + titre.
// En desktop (sidebar persistante), la puce retour est masquée.
export function AdminHeader({ title, right }: { title: string; right?: ReactNode }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  return (
    <View style={styles.header}>
      {!isDesktop && (
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
      )}
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingTop: spacing.lg },
  back: { padding: spacing.xs, marginLeft: -spacing.xs },
  title: { ...typography.h2, flex: 1 },
});
