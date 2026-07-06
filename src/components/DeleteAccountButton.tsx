import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/Button";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/providers/ToastProvider";
import { useAuth } from "@/providers/AuthProvider";
import { authService } from "@/lib/auth-service";
import { appointmentsService } from "@/lib/appointments-service";
import { marketplaceService } from "@/lib/marketplace-service";
import { colors, radius, spacing, typography } from "@/theme";

// Clé date locale « YYYY-MM-DD » du jour (comparaison lexicale aux RDV).
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Construit l'avertissement (tutoiement) selon ce qui est présent : RDV à venir
// seuls, commandes en cours seules, ou les deux. Accord singulier/pluriel/genre.
// Renvoie "" si rien à signaler.
function buildWarning(appts: number, orders: number): string {
  if (appts <= 0 && orders <= 0) return "";
  const rdv = `${appts} rendez-vous à venir`; // « rendez-vous » invariable
  const cmd = `${orders} commande${orders > 1 ? "s" : ""} en cours`;
  if (appts > 0 && orders > 0) {
    return `Tu as actuellement ${rdv} et ${cmd}. Si tu supprimes ton compte, ils seront définitivement perdus.`;
  }
  if (appts > 0) {
    const tail = appts > 1 ? "ils seront définitivement perdus" : "il sera définitivement perdu";
    return `Tu as actuellement ${rdv}. Si tu supprimes ton compte, ${tail}.`;
  }
  const tail = orders > 1 ? "elles seront définitivement perdues" : "elle sera définitivement perdue";
  return `Tu as actuellement ${cmd}. Si tu supprimes ton compte, ${tail}.`;
}

/**
 * Zone de danger réutilisable : suppression DÉFINITIVE de son propre compte,
 * avec double confirmation. Avant la 1ʳᵉ confirmation, on vérifie (best-effort)
 * les RDV à venir et commandes en cours pour avertir explicitement. Après succès,
 * la session est fermée et le provider d'auth redirige vers la connexion.
 */
export function DeleteAccountButton() {
  const { session } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();

  // Double confirmation (sécurité) via dialogue design system.
  async function handleDelete() {
    // Vérification best-effort RDV à venir + commandes en cours (loader au tap).
    // Un échec réseau ne bloque PAS la suppression : on retombe sur le message standard.
    setDeleting(true);
    let warning = "";
    try {
      const uid = session?.user?.id;
      if (uid) {
        const [appts, orders] = await Promise.all([
          appointmentsService.getAppointments(uid).catch(() => []),
          marketplaceService.getOrders(uid).catch(() => []),
        ]);
        const key = todayKey();
        const upcoming = appts.filter((a) => (a.status === "pending" || a.status === "confirmed") && a.appointment_date >= key).length;
        const ongoing = orders.filter((o) => o.status !== "completed" && o.status !== "cancelled").length;
        warning = buildWarning(upcoming, ongoing);
      }
    } catch {
      // best-effort : on n'empêche pas la suppression
    } finally {
      setDeleting(false);
    }

    const baseMessage =
      "Cette action est définitive : toutes vos données — cycle, commandes, messages, etc. — seront supprimées et ne pourront pas être récupérées.";
    const first = await confirm({
      title: "Supprimer mon compte",
      message: warning ? `${warning}\n\n${baseMessage}` : baseMessage,
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
      toast.error(e instanceof Error ? e.message : "Suppression impossible, réessayez plus tard.");
    }
  }

  return (
    <View style={styles.zone}>
      <View style={styles.zoneHead}>
        <Ionicons name="warning-outline" size={16} color={colors.danger} />
        <Text style={styles.zoneLabel}>Zone sensible</Text>
      </View>
      <Text style={styles.zoneHint}>La suppression est définitive : profil, cycles, commandes et messages seront effacés et ne pourront pas être récupérés.</Text>
      <Button title="Supprimer mon compte" variant="danger" onPress={handleDelete} loading={deleting} disabled={deleting} />
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.lg,
  },
  zoneHead: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  zoneLabel: { ...typography.caption, color: colors.danger, fontWeight: "800", letterSpacing: 0.5 },
  zoneHint: { ...typography.caption, color: colors.text },
});
