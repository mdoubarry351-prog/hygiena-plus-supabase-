import { useState, useCallback } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { ChatThread, type ChatMessage } from "@/components/ChatThread";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { ConsultationCall } from "@/components/ConsultationCall";
import { useAuth } from "@/providers/AuthProvider";
import { useCycles } from "@/hooks/useCycles";
import { messagesService } from "@/lib/messages-service";
import { buildCycleSummary } from "@/lib/cycle-service";
import { hapticLight } from "@/lib/haptics";
import { DOCTOR_MESSAGING_ENABLED } from "@/lib/app-config";
import { colors, spacing } from "@/theme";

export default function PatientChat() {
  const { doctorId, doctorName } = useLocalSearchParams<{ doctorId: string; doctorName?: string }>();
  const { session, role } = useAuth();
  const { cycles, prediction } = useCycles();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user || !doctorId) return;
    setLoading(true);
    try {
      setMessages(await messagesService.getThread(session.user.id, doctorId));
      // Marque comme lus les messages reçus du médecin (best-effort).
      messagesService.markThreadRead(doctorId, session.user.id).catch(() => {});
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [session?.user, doctorId]);

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

  return (
    <ChatThread
      title={doctorName || "Praticien"}
      subtitle="Salle de consultation"
      banner={
        <View style={styles.banner}>
          <ConsultationCall />
          <MedicalDisclaimer text="Ces échanges ne remplacent pas une consultation médicale. En cas d'urgence, rendez-vous aux urgences." />
        </View>
      }
      messages={messages}
      currentRole="patient"
      loading={loading}
      sending={sending}
      onSend={handleSend}
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
});
