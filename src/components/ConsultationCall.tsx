import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography } from "@/theme";

/**
 * Zone « Appel audio / vidéo » dans la salle de consultation.
 * PHASE 1 : boutons DÉSACTIVÉS avec mention « Bientôt disponible » (aucun SDK
 * branché). PHASE 2 : passer `enabled` (gating temporel = à l'heure du RDV) et
 * brancher les `onAudio`/`onVideo`. Modulaire pour ne rien casser d'ici là.
 */
export function ConsultationCall({
  enabled = false,
  onAudio,
  onVideo,
}: {
  enabled?: boolean;
  onAudio?: () => void;
  onVideo?: () => void;
}) {
  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        <Ionicons name="videocam-outline" size={18} color={colors.primaryDark} />
        <View style={styles.labelWrap}>
          <Text style={styles.label}>Appel audio / vidéo</Text>
          {!enabled ? <Text style={styles.soon}>Bientôt disponible</Text> : null}
        </View>
      </View>
      <View style={styles.actions}>
        <CallButton icon="call-outline" label="Audio" disabled={!enabled} onPress={onAudio} />
        <CallButton icon="videocam" label="Vidéo" disabled={!enabled} onPress={onVideo} />
      </View>
    </View>
  );
}

function CallButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  disabled?: boolean;
  onPress?: () => void;
}) {
  // Désactivé en Phase 1 : on n'attache pas d'action (Pressable non interactif).
  return (
    <View
      style={[styles.btn, disabled && styles.btnDisabled]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={`Appel ${label}${disabled ? " — bientôt disponible" : ""}`}
    >
      <Ionicons name={icon} size={18} color={disabled ? colors.textMuted : colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm,
  },
  left: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  labelWrap: { gap: 0 },
  label: { ...typography.caption, color: colors.text, fontWeight: "700" },
  soon: { ...typography.caption, fontSize: 10, color: colors.textMuted },
  actions: { flexDirection: "row", gap: spacing.xs },
  btn: {
    width: 38, height: 38, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary,
    backgroundColor: colors.card, alignItems: "center", justifyContent: "center",
  },
  btnDisabled: { borderColor: colors.border, opacity: 0.7 },
});
