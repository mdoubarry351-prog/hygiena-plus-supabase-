import { useState, useCallback } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { ChatThread, type ChatMessage } from "@/components/ChatThread";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { ConsultationCall } from "@/components/ConsultationCall";
import { useAuth } from "@/providers/AuthProvider";
import { useCycles } from "@/hooks/useCycles";
import { messagesService } from "@/lib/messages-service";
import { appointmentsService } from "@/lib/appointments-service";
import { appointmentAtMs } from "@/lib/call-service";
import { buildCycleSummary } from "@/lib/cycle-service";
import { hapticLight } from "@/lib/haptics";
import { DOCTOR_MESSAGING_ENABLED } from "@/lib/app-config";
import { colors, radius, spacing, typography } from "@/theme";

export default function PatientChat() {
  const { doctorId, doctorName, appointmentId, appointmentAt, consultationMode } = useLocalSearchParams<{ doctorId: string; doctorName?: string; appointmentId?: string; appointmentAt?: string; consultationMode?: string }>();
  const { session, role } = useAuth();
  const router = useRouter();
  const { cycles, prediction } = useCycles();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  // RDV patiente↔praticien découvert (si on n'est pas venu·e depuis un RDV précis).
  const [foundAppt, setFoundAppt] = useState<{ id: string; appointment_date: string; appointment_time: string; consultation_mode: "remote" | "physical" } | null>(null);
  // null = vérification en cours ; false = aucun RDV → saisie verrouillée (la RLS refuserait l'envoi).
  const [canMessage, setCanMessage] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    if (!session?.user || !doctorId) return;
    setLoading(true);
    try {
      setMessages(await messagesService.getThread(session.user.id, doctorId));
      // Marque comme lus les messages reçus du médecin (best-effort).
      messagesService.markThreadRead(doctorId, session.user.id).catch(() => {});
      // Messagerie liée à une consultation : on n'autorise la saisie que s'il existe
      // un RDV avec ce praticien (sinon la RLS refuse l'insert → on verrouille en amont).
      if (appointmentId) {
        setCanMessage(true); // on vient d'un RDV réel (reçu / « Mes rendez-vous »)
      } else {
        try {
          const found = await appointmentsService.findAppointmentForRoom(doctorId, session.user.id);
          setFoundAppt(found);
          setCanMessage(!!found);
        } catch {
          setCanMessage(true); // en cas de doute on ne verrouille pas (la RLS protège quand même)
        }
      }
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [session?.user, doctorId, appointmentId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Un médecin n'utilise pas la messagerie patient.
  if (role === "doctor") return <Redirect href="/(user)" />;
  // Salle conservée mais inaccessible si la messagerie est désactivée (réversible).
  if (!DOCTOR_MESSAGING_ENABLED) return <Redirect href="/(user)/appointments" />;

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
      Alert.alert(
        "Envoi impossible",
        denied ? "Réservez une consultation avec ce praticien pour pouvoir échanger." : (raw || "Erreur")
      );
    } finally {
      setSending(false);
    }
  }

  // Partage du suivi de cycle : génère le résumé, demande confirmation (aperçu), envoie.
  function shareCycle() {
    const summary = buildCycleSummary(cycles, prediction);
    if (!summary) {
      Alert.alert("Suivi indisponible", "Enregistre d'abord quelques cycles pour partager ton suivi.");
      return;
    }
    Alert.alert("Partager ce résumé avec le médecin ?", summary, [
      { text: "Annuler", style: "cancel" },
      { text: "Partager", onPress: () => handleSend(summary) },
    ]);
  }

  // Salle de consultation : appel calé sur le RDV reçu en paramètre, ou à défaut
  // sur le RDV trouvé pour ce praticien (ouverture depuis la liste/fiche).
  const effAppointmentId = appointmentId || foundAppt?.id || undefined;
  const effAppointmentAt = appointmentAt || (foundAppt ? `${foundAppt.appointment_date}T${foundAppt.appointment_time}:00` : undefined);
  const locked = canMessage === false;
  // L'appel audio/vidéo n'a de sens qu'en consultation à DISTANCE. Mode connu via
  // le paramètre (RDV précis) ou le RDV découvert ; inconnu → pas d'appel.
  const isRemote = (consultationMode ?? foundAppt?.consultation_mode) === "remote";

  return (
    <ChatThread
      title={doctorName || "Praticien"}
      subtitle="Salle de consultation"
      banner={
        <View style={styles.banner}>
          {isRemote ? (
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
      lockedNote="Réserve une consultation avec ce praticien pour pouvoir lui écrire."
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
