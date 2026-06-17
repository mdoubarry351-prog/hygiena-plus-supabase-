import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { hapticLight } from "@/lib/haptics";
import { isWithinCallWindow } from "@/lib/call-service";
import { colors, radius, spacing, typography } from "@/theme";

/**
 * Zone « Appel audio / vidéo » dans la salle de consultation.
 * Lance l'écran d'appel Daily (app/(user)/appointments/call) avec l'appointmentId
 * et le mode. GATING TEMPOREL : actif uniquement dans la fenêtre du RDV
 * (≈ 5 min avant → 1 h après) ; hors fenêtre ou sans RDV → désactivé avec
 * « Disponible à l'heure du rendez-vous ». Utilisé patiente ET médecin.
 */
export function ConsultationCall({
  appointmentId,
  appointmentAtMs,
  peerName,
}: {
  appointmentId?: string | null;
  appointmentAtMs?: number | null;
  peerName?: string | null;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());

  // Réévalue la fenêtre périodiquement (le RDV peut s'ouvrir pendant l'affichage).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const enabled = !!appointmentId && isWithinCallWindow(appointmentAtMs ?? null, now);

  function launch(mode: "audio" | "video") {
    if (!enabled || !appointmentId) return;
    hapticLight();
    router.push({ pathname: "/(user)/appointments/call", params: { appointmentId, mode, peerName: peerName ?? "" } });
  }

  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        <Ionicons name="videocam-outline" size={18} color={colors.primaryDark} />
        <View style={styles.labelWrap}>
          <Text style={styles.label}>Appel audio / vidéo</Text>
          {!enabled ? <Text style={styles.soon}>Disponible à l'heure du rendez-vous</Text> : null}
        </View>
      </View>
      <View style={styles.actions}>
        <CallButton icon="call" label="Audio" disabled={!enabled} onPress={() => launch("audio")} />
        <CallButton icon="videocam" label="Vidéo" disabled={!enabled} onPress={() => launch("video")} />
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
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.btn, disabled ? styles.btnDisabled : styles.btnEnabled, pressed && !disabled && styles.btnPressed]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={`Appel ${label}${disabled ? " — disponible à l'heure du rendez-vous" : ""}`}
    >
      <Ionicons name={icon} size={18} color={disabled ? colors.textMuted : colors.white} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm,
  },
  left: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  labelWrap: { gap: 0, flex: 1 },
  label: { ...typography.caption, color: colors.text, fontWeight: "700" },
  soon: { ...typography.caption, fontSize: 10, color: colors.textMuted },
  actions: { flexDirection: "row", gap: spacing.xs },
  btn: { width: 38, height: 38, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  btnEnabled: { backgroundColor: colors.primary },
  btnDisabled: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, opacity: 0.7 },
  btnPressed: { opacity: 0.85 },
});
