import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { ChatThread, type ChatMessage } from "@/components/ChatThread";
import { useAuth } from "@/providers/AuthProvider";
import { messagesService } from "@/lib/messages-service";

export default function PatientChat() {
  const { doctorId, doctorName } = useLocalSearchParams<{ doctorId: string; doctorName?: string }>();
  const { session, profile, role } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user || !doctorId) return;
    setLoading(true);
    try {
      setMessages(await messagesService.getThread(session.user.id, doctorId));
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [session?.user, doctorId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Un médecin n'utilise pas la messagerie patient ; gating premium pour le patient.
  if (role === "doctor") return <Redirect href="/(user)" />;
  if (!profile?.is_premium) return <Redirect href="/(user)/premium" />;

  async function handleSend(content: string) {
    if (!session?.user || !doctorId) return;
    setSending(true);
    try {
      const msg = await messagesService.sendPatientMessage(session.user.id, doctorId, content);
      setMessages((prev) => [...prev, msg]);
    } catch (e) {
      Alert.alert("Envoi impossible", e instanceof Error ? e.message : "Erreur");
    } finally {
      setSending(false);
    }
  }

  return (
    <ChatThread
      title={doctorName || "Médecin"}
      subtitle="Conseils en ligne"
      note="Messagerie de conseils. Pour une consultation, prenez rendez-vous."
      messages={messages}
      currentRole="patient"
      loading={loading}
      sending={sending}
      onSend={handleSend}
    />
  );
}
