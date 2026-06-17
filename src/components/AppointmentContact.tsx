import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { hapticLight } from "@/lib/haptics";
import { DOCTOR_MESSAGING_ENABLED } from "@/lib/app-config";
import { colors, radius, spacing, typography } from "@/theme";
import type { ConsultationMode } from "@/lib/database.types";

/**
 * Accès post-paiement à la SALLE DE CONSULTATION in-app (messagerie patiente ↔
 * praticien), pour un RDV payé/confirmé — en distanciel comme en présentiel
 * (le fil reste utile avant/après). Plus de renvoi vers WhatsApp/appel externe.
 * En présentiel, le lieu (clinic_name) reste affiché. Tokens uniquement.
 */
export function AppointmentContact({
  mode,
  clinicName,
  doctorId,
  doctorName,
  appointmentId,
  appointmentAt,
  noun = "médecin",
}: {
  mode: ConsultationMode;
  clinicName?: string | null;
  doctorId?: string | null;
  doctorName?: string | null;
  appointmentId?: string | null;
  appointmentAt?: string | null; // « YYYY-MM-DDTHH:MM:SS » (pour le gating d'appel)
  noun?: string;
}) {
  const router = useRouter();
  const clinic = clinicName?.trim() ?? "";
  const canOpenRoom = DOCTOR_MESSAGING_ENABLED && !!doctorId;

  function openRoom() {
    if (!doctorId) return;
    hapticLight();
    router.push({
      pathname: "/(user)/appointments/chat",
      params: { doctorId, doctorName: doctorName ?? "", appointmentId: appointmentId ?? "", appointmentAt: appointmentAt ?? "" },
    });
  }

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <Ionicons name="chatbubbles-outline" size={18} color={colors.primaryDark} />
        <Text style={styles.title}>Salle de consultation</Text>
      </View>

      {/* En présentiel : le lieu reste affiché. */}
      {mode === "physical" ? (
        <View style={styles.locRow}>
          <Ionicons name="business-outline" size={15} color={colors.textMuted} />
          <Text style={styles.place}>{clinic || "Lieu communiqué par votre praticien."}</Text>
        </View>
      ) : null}

      {canOpenRoom ? (
        <>
          <Pressable
            onPress={openRoom}
            style={({ pressed }) => [styles.accessBtn, pressed && styles.accessBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Accéder à la consultation"
          >
            <Ionicons name="videocam-outline" size={18} color={colors.white} />
            <Text style={styles.accessText}>Accéder à la consultation</Text>
          </Pressable>
          <Text style={styles.note}>
            {mode === "remote"
              ? `Échangez par messages avec votre ${noun} — l'appel audio/vidéo arrive bientôt.`
              : `Échangez avant et après votre rendez-vous avec votre ${noun}.`}
          </Text>
        </>
      ) : (
        <Text style={styles.note}>
          {mode === "physical"
            ? "Présentez-vous à la clinique à l'heure du rendez-vous."
            : `Votre ${noun} vous contactera à l'heure du rendez-vous.`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  title: { ...typography.name, color: colors.text },
  locRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  place: { ...typography.body, color: colors.text, flex: 1 },
  accessBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs,
    paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.primary,
  },
  accessBtnPressed: { opacity: 0.85 },
  accessText: { ...typography.caption, color: colors.white, fontWeight: "700" },
  note: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
});
