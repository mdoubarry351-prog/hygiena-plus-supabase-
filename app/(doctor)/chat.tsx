import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { ChatThread, type ChatMessage } from "@/components/ChatThread";
import { Loading } from "@/components/Loading";
import { useMyDoctor } from "@/hooks/useMyDoctor";
import { messagesService } from "@/lib/messages-service";

export default function DoctorChat() {
  const { patientId, patientName } = useLocalSearchParams<{ patientId: string; patientName?: string }>();
  const { doctor, loading: loadingDoctor } = useMyDoctor();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!doctor || !patientId) return;
    setLoading(true);
    try {
      setMessages(await messagesService.getThread(patientId, doctor.id));
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
      subtitle="Conseils en ligne"
      messages={messages}
      currentRole="doctor"
      loading={loading}
      sending={sending}
      onSend={handleSend}
    />
  );
}
