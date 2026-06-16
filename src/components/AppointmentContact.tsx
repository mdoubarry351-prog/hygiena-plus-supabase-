import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { hapticLight } from "@/lib/haptics";
import { colors, radius, spacing, typography } from "@/theme";
import type { ConsultationMode } from "@/lib/database.types";

// Normalise un numéro pour wa.me (chiffres uniquement, sans + ni espaces).
function digits(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

function ContactBtn({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

/**
 * Contact post-paiement d'une consultation, selon le mode.
 * - À distance : boutons WhatsApp + Appeler (téléphone du médecin), ou repli.
 * - En clinique : lieu du rendez-vous (clinic_name), ou message neutre.
 * Réutilisé sur le reçu et la carte « Mes rendez-vous ». Tokens uniquement.
 */
export function AppointmentContact({ mode, phone, clinicName }: { mode: ConsultationMode; phone?: string | null; clinicName?: string | null }) {
  const tel = phone?.trim() ?? "";
  const clinic = clinicName?.trim() ?? "";

  if (mode === "remote") {
    return (
      <View style={styles.box}>
        <View style={styles.head}>
          <Ionicons name="videocam-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.title}>Contacter votre médecin</Text>
        </View>
        {tel ? (
          <>
            <View style={styles.row}>
              <ContactBtn
                icon="logo-whatsapp"
                label="WhatsApp"
                onPress={() => {
                  hapticLight();
                  Linking.openURL(`https://wa.me/${digits(tel)}`).catch(() =>
                    Alert.alert("WhatsApp indisponible", "Impossible d'ouvrir WhatsApp sur cet appareil.")
                  );
                }}
              />
              <ContactBtn
                icon="call-outline"
                label="Appeler"
                onPress={() => {
                  hapticLight();
                  Linking.openURL(`tel:${tel}`).catch(() =>
                    Alert.alert("Appel indisponible", "Impossible de lancer l'appel sur cet appareil.")
                  );
                }}
              />
            </View>
            <Text style={styles.note}>Échange par WhatsApp ou appel à l'heure du rendez-vous.</Text>
          </>
        ) : (
          <Text style={styles.note}>Le médecin vous contactera à l'heure du rendez-vous.</Text>
        )}
      </View>
    );
  }

  // En clinique
  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <Ionicons name="business-outline" size={18} color={colors.primaryDark} />
        <Text style={styles.title}>Lieu du rendez-vous</Text>
      </View>
      <Text style={styles.place}>{clinic || "Lieu communiqué par le médecin."}</Text>
      {clinic ? <Text style={styles.note}>Présentez-vous à la clinique à l'heure du rendez-vous.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  title: { ...typography.name, color: colors.text },
  row: { flexDirection: "row", gap: spacing.sm },
  btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.card },
  btnPressed: { opacity: 0.6 },
  btnText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
  place: { ...typography.body, color: colors.text },
  note: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
});
