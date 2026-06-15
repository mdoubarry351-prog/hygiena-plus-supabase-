import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { useConfirm } from "@/components/ConfirmDialog";
import { authService } from "@/lib/auth-service";
import { colors, radius, spacing, typography } from "@/theme";

/**
 * Zone de danger réutilisable : suppression DÉFINITIVE de son propre compte,
 * avec double confirmation. Après succès, la session est fermée et le provider
 * d'auth redirige vers la connexion (le composant se démonte).
 */
export function DeleteAccountButton() {
  const [deleting, setDeleting] = useState(false);
  const confirm = useConfirm();

  // Double confirmation (sécurité) via dialogue design system.
  async function handleDelete() {
    const first = await confirm({
      title: "Supprimer mon compte",
      message: "Cette action est définitive : toutes vos données — cycle, commandes, messages, etc. — seront supprimées et ne pourront pas être récupérées.",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!first) return;
    const second = await confirm({
      title: "Êtes-vous vraiment sûre ?",
      message: "Dernière étape : la suppression est définitive et immédiate.",
      confirmLabel: "Oui, supprimer définitivement",
      danger: true,
    });
    if (!second) return;
    setDeleting(true);
    try {
      await authService.deleteOwnAccount();
      // Session fermée → redirection automatique vers la connexion.
    } catch (e) {
      setDeleting(false);
      Alert.alert("Suppression impossible", e instanceof Error ? e.message : "Réessayez plus tard.");
    }
  }

  return (
    <View style={styles.zone}>
      <Text style={styles.zoneLabel}>Zone de danger</Text>
      <Button title="Supprimer mon compte" variant="danger" onPress={handleDelete} loading={deleting} disabled={deleting} />
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
