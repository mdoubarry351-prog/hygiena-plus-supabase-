import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography } from "@/theme";

export type TrustSignal = "privacy" | "verified" | "payment" | "confidential" | "noCommitment";

// Signaux de confiance prédéfinis (icône + libellé court). Cohérent avec
// VerifiedDoctorBadge (checkmark + primaryDark) pour « médecins vérifiés ».
const SIGNALS: Record<TrustSignal, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  privacy: { icon: "lock-closed", label: "Données chiffrées" },
  verified: { icon: "checkmark-circle", label: "Médecins vérifiés" },
  payment: { icon: "shield-checkmark", label: "Paiement sécurisé" },
  confidential: { icon: "eye-off", label: "Infos santé confidentielles" },
  noCommitment: { icon: "refresh", label: "Sans engagement" },
};

/**
 * Rangée réutilisable de signaux de confiance, en pastilles sobres (tokens).
 * À placer aux moments rassurants (premium, checkout, prise de RDV, aide),
 * SANS surcharger. Non intrusif : libellés courts, fond neutre.
 */
export function TrustRow({ signals }: { signals: TrustSignal[] }) {
  return (
    <View style={styles.row}>
      {signals.map((s) => (
        <View key={s} style={styles.item}>
          <Ionicons name={SIGNALS[s].icon} size={13} color={colors.primaryDark} />
          <Text style={styles.label}>{SIGNALS[s].label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, justifyContent: "center" },
  item: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.pill },
  label: { ...typography.caption, fontSize: 11, color: colors.text, fontWeight: "600" },
});
