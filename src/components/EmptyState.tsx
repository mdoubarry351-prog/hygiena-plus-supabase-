import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { colors, radius, spacing, typography } from "@/theme";

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  emoji?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

// État vide partagé : pastille douce (icône ou emoji) + titre + message
// bienveillant + bouton d'action optionnel. Utilisé sur tous les écrans
// « aucune donnée » pour un rendu identique et cohérent.
export function EmptyState({ icon = "sparkles-outline", emoji, title, message, actionLabel, onAction }: Props) {
  return (
    <Card style={styles.card}>
      <View style={styles.iconWrap}>
        {emoji ? <Text style={styles.emoji}>{emoji}</Text> : <Ionicons name={icon} size={28} color={colors.primary} />}
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button title={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  iconWrap: {
    width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.xs,
  },
  emoji: { fontSize: 30 },
  title: { ...typography.h3, textAlign: "center" },
  message: { ...typography.body, color: colors.textMuted, textAlign: "center" },
  action: { alignSelf: "stretch", marginTop: spacing.sm },
});
