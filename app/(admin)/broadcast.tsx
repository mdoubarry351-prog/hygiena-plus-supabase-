import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { AdminHeader } from "@/components/AdminHeader";
import { useAuth } from "@/providers/AuthProvider";
import { adminService } from "@/lib/admin-service";
import { PREMIUM_ENABLED } from "@/lib/app-config";
import { hapticSuccess } from "@/lib/haptics";
import { colors, radius, spacing, typography } from "@/theme";

// Publics ciblables (alignés sur la RPC admin_broadcast). Le segment « Premium »
// est retiré tant que le Premium est désactivé (réversible) ; l'envoi reste intact.
const ALL_AUDIENCES: { value: string; label: string }[] = [
  { value: "all", label: "Tout le monde" },
  { value: "user", label: "Utilisatrices" },
  { value: "premium", label: "Abonnées Premium" },
  { value: "doctor", label: "Médecins" },
];
const AUDIENCES = PREMIUM_ENABLED ? ALL_AUDIENCES : ALL_AUDIENCES.filter((a) => a.value !== "premium");

// Au-delà de ce seuil, on insiste sur la confirmation (gros envoi).
const LARGE_THRESHOLD = 50;

export default function AdminBroadcast() {
  const { session } = useAuth();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("all");
  const [count, setCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);

  const audienceLabel = AUDIENCES.find((a) => a.value === audience)?.label ?? "";

  // Le compteur de preview dépend du public : on l'invalide si on en change.
  function pickAudience(value: string) {
    setAudience(value);
    setCount(null);
  }

  async function preview() {
    setPreviewing(true);
    try {
      setCount(await adminService.broadcastCount(audience));
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Prévisualisation impossible.");
    } finally {
      setPreviewing(false);
    }
  }

  function confirmSend() {
    if (!session?.user) return;
    if (!title.trim()) { Alert.alert("Titre requis", "Saisissez un titre."); return; }
    if (!message.trim()) { Alert.alert("Message requis", "Saisissez un message."); return; }

    const doSend = async () => {
      setSending(true);
      try {
        const sent = await adminService.sendBroadcast(session.user.id, title.trim(), message.trim(), audience);
        hapticSuccess();
        setTitle("");
        setMessage("");
        setCount(null);
        Alert.alert("Diffusion envoyée", `Notification envoyée à ${sent} personne${sent > 1 ? "s" : ""}.`);
      } catch (e) {
        Alert.alert("Erreur", e instanceof Error ? e.message : "Diffusion impossible.");
      } finally {
        setSending(false);
      }
    };

    const who = count !== null ? `${count} personne${count > 1 ? "s" : ""}` : `« ${audienceLabel} »`;
    const warn = count !== null && count > LARGE_THRESHOLD ? "\n\nC'est un envoi important." : "";
    Alert.alert("Envoyer la notification ?", `Cette notification sera envoyée à ${who}.${warn}`, [
      { text: "Annuler", style: "cancel" },
      { text: "Envoyer", onPress: doSend },
    ]);
  }

  return (
    <Screen>
      <AdminHeader title="Diffusion" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Envoyez une notification à un public ciblé.</Text>

        <Card style={styles.formCard}>
          <Input label="Titre" value={title} onChangeText={setTitle} placeholder="Titre de la notification" />
          <Input
            label="Message"
            value={message}
            onChangeText={setMessage}
            placeholder="Contenu du message…"
            multiline
            numberOfLines={5}
            style={styles.textArea}
          />

          <Text style={styles.fieldLabel}>Public</Text>
          <View style={styles.chips}>
            {AUDIENCES.map((a) => (
              <Chip key={a.value} label={a.label} active={audience === a.value} onPress={() => pickAudience(a.value)} size="md" inactiveBackground="transparent" />
            ))}
          </View>
        </Card>

        {/* Preview du nombre de destinataires */}
        <Card style={styles.previewCard}>
          <View style={styles.previewRow}>
            <Ionicons name="people-outline" size={20} color={colors.primaryDark} />
            <Text style={styles.previewText}>
              {count !== null
                ? `${count} destinataire${count > 1 ? "s" : ""}`
                : "Prévisualisez le nombre de destinataires"}
            </Text>
          </View>
          <Button title="Prévisualiser" variant="outline" onPress={preview} loading={previewing} />
        </Card>

        <Button title="Envoyer" onPress={confirmSend} loading={sending} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  subtitle: { ...typography.caption, color: colors.textMuted },
  formCard: { gap: spacing.sm },
  textArea: { height: 120, textAlignVertical: "top", paddingTop: spacing.sm },
  fieldLabel: { ...typography.caption, color: colors.text, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, fontWeight: "700", color: colors.text },
  chipTextActive: { color: colors.white },
  previewCard: { gap: spacing.sm },
  previewRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  previewText: { ...typography.body, color: colors.text, fontWeight: "600", flex: 1 },
});
