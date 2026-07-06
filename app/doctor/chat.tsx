import { useState, useCallback, useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useToast } from "@/providers/ToastProvider";
import { ChatThread, type ChatMessage } from "@/components/ChatThread";
import { ConsultationCall } from "@/components/ConsultationCall";
import { Loading } from "@/components/Loading";
import { useMyDoctor } from "@/hooks/useMyDoctor";
import { messagesService } from "@/lib/messages-service";
import { appointmentsService, formatAppointmentDate } from "@/lib/appointments-service";
import { appointmentAtMs, roomWindowState } from "@/lib/call-service";

export default function DoctorChat() {
  const { patientId, patientName } = useLocalSearchParams<{ patientId: string; patientName?: string }>();
  const { doctor, loading: loadingDoctor } = useMyDoctor();
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  // RDV pertinent (fenêtre active en priorité) : pilote l'ouverture de la salle.
  const [appt, setAppt] = useState<{ id: string; appointment_date: string; appointment_time: string; consultation_mode: "remote" | "physical" } | null>(null);
  // Horloge réévaluée → ouverture/fermeture auto au passage de la fenêtre.
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!doctor || !patientId) return;
    setLoading(true);
    try {
      setMessages(await messagesService.getThread(patientId, doctor.id));
      // Marque comme lus les messages reçus de la patiente (best-effort).
      messagesService.markThreadRead(doctor.id, patientId).catch(() => {});
      // RDV pour la fenêtre d'accès (best-effort, n'empêche pas la lecture du fil).
      appointmentsService.findAppointmentForRoom(doctor.id, patientId)
        .then((a) => setAppt(a))
        .catch(() => setAppt(null));
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [doctor, patientId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Réévalue la fenêtre toutes les 30 s (ouverture/fermeture automatique).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  if (loadingDoctor) return <Loading />;

  async function handleSend(content: string) {
    if (!doctor || !patientId) return;
    setSending(true);
    try {
      const msg = await messagesService.sendDoctorMessage(patientId, doctor.id, content);
      setMessages((prev) => [...prev, msg]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi impossible");
    } finally {
      setSending(false);
    }
  }

  // Accès borné dans le temps : la salle s'ouvre dans [RDV−1h, RDV+1h]. La lecture
  // du fil reste possible ; la SAISIE suit la fenêtre.
  const atMs = appt ? appointmentAtMs(appt.appointment_date, appt.appointment_time) : null;
  const windowState = roomWindowState(atMs, now);
  const locked = windowState !== "active";
  const showCall = appt?.consultation_mode === "remote" && windowState === "active";
  const lockedNote =
    windowState === "upcoming" && appt
      ? `La salle s'ouvrira 1h avant le rendez-vous (le ${formatAppointmentDate(appt.appointment_date)} à ${appt.appointment_time.slice(0, 5)}).`
      : "Ce créneau de consultation est terminé.";

  return (
    <ChatThread
      title={patientName || "Patiente"}
      subtitle="Salle de consultation"
      banner={showCall ? <ConsultationCall appointmentId={appt!.id} appointmentAtMs={atMs} peerName={patientName} /> : undefined}
      messages={messages}
      currentRole="doctor"
      loading={loading}
      sending={sending}
      onSend={handleSend}
      locked={locked}
      lockedNote={lockedNote}
    />
  );
}
