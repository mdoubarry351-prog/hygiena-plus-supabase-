import { useState, useCallback, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useToast } from "@/providers/ToastProvider";
import { useConfirm } from "@/components/ConfirmDialog";
import { ChatThread, type ChatMessage } from "@/components/ChatThread";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { ConsultationCall } from "@/components/ConsultationCall";
import { useAuth } from "@/providers/AuthProvider";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useCycles } from "@/hooks/useCycles";
import { messagesService } from "@/lib/messages-service";
import { appointmentsService, formatAppointmentDate } from "@/lib/appointments-service";
import { appointmentAtMs, roomWindowState } from "@/lib/call-service";
import { buildCycleSummary } from "@/lib/cycle-service";
import { hapticLight } from "@/lib/haptics";
import { DOCTOR_MESSAGING_ENABLED } from "@/lib/app-config";
import { colors, radius, spacing, typography } from "@/theme";

export default function PatientChat() {
  const { doctorId, doctorName, appointmentId, appointmentAt, consultationMode } = useLocalSearchParams<{ doctorId: string; doctorName?: string; appointmentId?: string; appointmentAt?: string; consultationMode?: string }>();
  const { session, role } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { cycles, prediction } = useCycles();
  // Réglage admin : la messagerie/téléconsultation peut être coupée globalement.
  const { messaging_enabled } = useAppSettings();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  // RDV patiente↔praticien découvert (si on n'est pas venu·e depuis un RDV précis).
  const [foundAppt, setFoundAppt] = useState<{ id: string; appointment_date: string; appointment_time: string; consultation_mode: "remote" | "physical" } | null>(null);
  // Horloge réévaluée périodiquement → ouverture/fermeture auto de la salle au
  // passage de la fenêtre [RDV−1h, RDV+1h].
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!session?.user || !doctorId) return;
    setLoading(true);
    try {
      setMessages(await messagesService.getThread(session.user.id, doctorId));
      // Marque comme lus les messages reçus du médecin (best-effort).
      messagesService.markThreadRead(doctorId, session.user.id).catch(() => {});
      // Sans RDV précis en paramètre : on cherche le RDV pertinent (fenêtre active
      // en priorité) pour déterminer l'horaire/mode de la salle.
      if (!appointmentId) {
        try {
          setFoundAppt(await appointmentsService.findAppointmentForRoom(doctorId, session.user.id));
        } catch {
          setFoundAppt(null);
        }
      }
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [session?.user, doctorId, appointmentId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Réévalue la fenêtre toutes les 30 s (ouverture/fermeture automatique).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Un médecin n'utilise pas la messagerie patient.
  if (role === "doctor") return <Redirect href="/(user)" />;
  // Salle conservée mais inaccessible si la messagerie est désactivée (réversible).
  if (!DOCTOR_MESSAGING_ENABLED) return <Redirect href="/(user)/appointments" />;
  // Point de passage UNIQUE de la messagerie : on y applique le réglage admin
  // `messaging_enabled` (sinon la salle resterait joignable par d'autres entrées).
  if (!messaging_enabled) return <Redirect href="/(user)/appointments" />;

  async function handleSend(content: string) {
    if (!session?.user || !doctorId) return;
    setSending(true);
    try {
      const msg = await messagesService.sendPatientMessage(session.user.id, doctorId, content);
      setMessages((prev) => [...prev, msg]);
    } catch (e) {
      // La RLS exige un rendez-vous avec ce praticien : message clair.
      const raw = e instanceof Error ? e.message : "";
      const denied = /row-level security|policy|denied|not allowed|permission/i.test(raw);
      toast.error(denied ? "Réservez une consultation avec ce praticien pour pouvoir échanger." : (raw || "Erreur"));
    } finally {
      setSending(false);
    }
  }

  // Partage du suivi de cycle : génère le résumé, demande confirmation (aperçu), envoie.
  async function shareCycle() {
    const summary = buildCycleSummary(cycles, prediction);
    if (!summary) {
      toast.info("Suivi indisponible. Enregistre d'abord quelques cycles pour partager ton suivi.");
      return;
    }
    if (await confirm({ title: "Partager ce résumé avec le médecin ?", message: summary, confirmLabel: "Partager", cancelLabel: "Annuler" })) {
      handleSend(summary);
    }
  }

  // Salle de consultation : RDV reçu en paramètre, ou à défaut le RDV trouvé.
  const effAppointmentId = appointmentId || foundAppt?.id || undefined;
  const effAppointmentAt = appointmentAt || (foundAppt ? `${foundAppt.appointment_date}T${foundAppt.appointment_time}:00` : undefined);
  // Date/heure d'affichage du RDV (pour le message « s'ouvrira 1h avant… »).
  const apptDate = appointmentId ? (appointmentAt?.slice(0, 10) ?? "") : (foundAppt?.appointment_date ?? "");
  const apptTime = appointmentId ? (appointmentAt?.slice(11, 16) ?? "") : (foundAppt?.appointment_time?.slice(0, 5) ?? "");

  // Accès borné dans le temps : la salle (chat + appels) n'est ouverte que dans
  // la fenêtre [RDV−1h, RDV+1h]. État réévalué à chaque tick (`now`).
  const windowState = roomWindowState(appointmentAtMs(effAppointmentAt), now);
  const locked = windowState !== "active";
  // L'appel n'a de sens qu'en consultation à DISTANCE ET fenêtre active (même gating).
  const isRemote = (consultationMode ?? foundAppt?.consultation_mode) === "remote";
  const showCall = isRemote && windowState === "active";
  // Message de verrouillage selon le cas (avant / après-terminé / pas de RDV).
  const lockedNote =
    windowState === "upcoming" && apptDate
      ? `La consultation s'ouvrira 1h avant votre rendez-vous (le ${formatAppointmentDate(apptDate)} à ${apptTime}).`
      : "Ce créneau de consultation est terminé. Prends un nouveau rendez-vous pour échanger avec ce médecin.";

  return (
    <ChatThread
      title={doctorName || "Praticien"}
      subtitle="Salle de consultation"
      banner={
        <View style={styles.banner}>
          {showCall ? (
            <ConsultationCall
              appointmentId={effAppointmentId}
              appointmentAtMs={appointmentAtMs(effAppointmentAt)}
              peerName={doctorName}
            />
          ) : null}
          <MedicalDisclaimer text="Ces échanges ne remplacent pas une consultation médicale. En cas d'urgence, rendez-vous aux urgences." />
        </View>
      }
      messages={messages}
      currentRole="patient"
      loading={loading}
      sending={sending}
      onSend={handleSend}
      locked={locked}
      lockedNote={lockedNote}
      lockedAction={
        <Pressable onPress={() => { hapticLight(); router.push(`/(user)/appointments/${doctorId}`); }} style={({ pressed }) => [styles.reserveBtn, pressed && styles.reserveBtnPressed]} accessibilityRole="button" accessibilityLabel="Réserver une consultation">
          <Text style={styles.reserveText}>Réserver</Text>
        </Pressable>
      }
      composerAction={
        <Pressable onPress={() => { hapticLight(); shareCycle(); }} disabled={sending} style={({ pressed }) => [styles.shareBtn, pressed && styles.shareBtnPressed]} accessibilityRole="button" accessibilityLabel="Partager mon suivi de cycle">
          <Ionicons name="pulse-outline" size={20} color={colors.primary} />
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  banner: { gap: spacing.sm },
  shareBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.primary, alignItems: "center", justifyContent: "center" },
  shareBtnPressed: { opacity: 0.6, backgroundColor: colors.primaryLight },
  reserveBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.primary },
  reserveBtnPressed: { opacity: 0.85 },
  reserveText: { ...typography.caption, color: colors.white, fontWeight: "700" },
});
