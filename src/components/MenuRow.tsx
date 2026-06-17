import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/Card";
import { colors, radius, spacing, typography } from "@/theme";

/**
 * Ligne de menu réutilisable : pastille d'icône + libellé/sous-libellé + chevron.
 * `Card onPress` → effet de pression (scale + ombre) + haptique léger.
 * Partagée par le profil et ses sous-écrans (Réglages, Aide & à propos).
 */
export function MenuRow({
  icon,
  title,
  sub,
  onPress,
  tint = colors.primary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  onPress: () => void;
  tint?: string;
}) {
  return (
    <Card onPress={onPress} haptic accessibilityLabel={title} style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={22} color={tint} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconWrap: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
  title: { ...typography.name },
  sub: { ...typography.caption, color: colors.textMuted },
});
