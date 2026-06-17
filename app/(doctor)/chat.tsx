import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { ChatThread, type ChatMessage } from "@/components/ChatThread";
import { ConsultationCall } from "@/components/ConsultationCall";
import { Loading } from "@/components/Loading";
import { useMyDoctor } from "@/hooks/useMyDoctor";
import { messagesService } from "@/lib/messages-service";
import { appointmentsService } from "@/lib/appointments-service";
import { appointmentAtMs } from "@/lib/call-service";

export default function DoctorChat() {
  const { patientId, patientName } = useLocalSearchParams<{ patientId: string; patientName?: string }>();
  const { doctor, loading: loadingDoctor } = useMyDoctor();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  // RDV pertinent (pour le gating d'appel côté médecin).
  const [apptId, setApptId] = useState<string | null>(null);
  const [apptAtMs, setApptAtMs] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!doctor || !patientId) return;
    setLoading(true);
    try {
      setMessages(await messagesService.getThread(patientId, doctor.id));
      // Marque comme lus les messages reçus de la patiente (best-effort).
      messagesService.markThreadRead(doctor.id, patientId).catch(() => {});
      // RDV pour l'appel (best-effort, n'empêche pas le chat).
      appointmentsService.findAppointmentForRoom(doctor.id, patientId)
        .then((a) => { setApptId(a?.id ?? null); setApptAtMs(a ? appointmentAtMs(a.appointment_date, a.appointment_time) : null); })
        .catch(() => { setApptId(null); setApptAtMs(null); });
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [doctor, patientId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loadingDoctor) return <Loading />;

  async function handleSend(content: string) {
    if (!doctor || !patientId) return;
    setSending(true);
    try {
      const msg = await messagesService.sendDoctorMessage(patientId, doctor.id, content);
      setMessages((prev) => [...prev, msg]);
    } catch (e) {
      Alert.alert("Envoi impossible", e instanceof Error ? e.message : "Erreur");
    } finally {
      setSending(false);
    }
  }

  return (
    <ChatThread
      title={patientName || "Patiente"}
      subtitle="Salle de consultation"
      banner={<ConsultationCall appointmentId={apptId} appointmentAtMs={apptAtMs} peerName={patientName} />}
      messages={messages}
      currentRole="doctor"
      loading={loading}
      sending={sending}
      onSend={handleSend}
    />
  );
}
