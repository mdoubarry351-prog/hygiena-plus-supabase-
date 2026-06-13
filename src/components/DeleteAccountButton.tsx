import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { authService } from "@/lib/auth-service";
import { colors, radius, spacing, typography } from "@/theme";

/**
 * Zone de danger réutilisable : suppression DÉFINITIVE de son propre compte,
 * avec double confirmation. Après succès, la session est fermée et le provider
 * d'auth redirige vers la connexion (le composant se démonte).
 */
export function DeleteAccountButton() {
  const [deleting, setDeleting] = useState(false);

  async function doDelete() {
    setDeleting(true);
    try {
      await authService.deleteOwnAccount();
      // Session fermée → redirection automatique vers la connexion.
    } catch (e) {
      setDeleting(false);
      Alert.alert("Suppression impossible", e instanceof Error ? e.message : "Réessayez plus tard.");
    }
  }

  // 2ᵉ confirmation (irréversible).
  function confirmSecond() {
    Alert.alert(
      "Êtes-vous vraiment sûre ?",
      "Dernière étape : la suppression est définitive et immédiate.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Oui, supprimer définitivement", style: "destructive", onPress: doDelete },
      ]
    );
  }

  // 1ʳᵉ confirmation (explication).
  function confirmFirst() {
    Alert.alert(
      "Supprimer mon compte",
      "Cette action est définitive : toutes vos données — cycle, commandes, messages, etc. — seront supprimées et ne pourront pas être récupérées.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: confirmSecond },
      ]
    );
  }

  return (
    <View style={styles.zone}>
      <Text style={styles.zoneLabel}>Zone de danger</Text>
      <Button title="Supprimer mon compte" variant="danger" onPress={confirmFirst} loading={deleting} disabled={deleting} />
      <Text style={styles.zoneHint}>Action définitive et irréversible. Vos données seront effacées.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderRadius: radius.md,
  },
  zoneLabel: { ...typography.caption, color: colors.danger, fontWeight: "700", letterSpacing: 0.5 },
  zoneHint: { ...typography.caption, color: colors.textMuted },
});
