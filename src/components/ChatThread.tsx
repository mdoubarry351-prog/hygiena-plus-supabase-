import { useRef, useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Loading } from "@/components/Loading";
import { colors, fonts, radius, spacing, typography } from "@/theme";

export type ChatMessage = {
  id: string;
  sender_role: string; // 'patient' | 'doctor'
  content: string;
  created_at: string;
};

type Props = {
  title: string;
  subtitle?: string;
  note?: string; // bandeau d'info (ex. « conseils — pour une consultation, prenez RDV »)
  messages: ChatMessage[];
  currentRole: "patient" | "doctor";
  loading?: boolean;
  sending?: boolean;
  onSend: (content: string) => void | Promise<void>;
};

// Fil de discussion réutilisable (patient ↔ médecin) : bulles + champ de saisie.
export function ChatThread({ title, subtitle, note, messages, currentRole, loading, sending, onSend }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  function handleSend() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onSend(text);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* En-tête */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>

      {note ? (
        <View style={styles.noteBar}>
          <Ionicons name="information-circle-outline" size={16} color={colors.primaryDark} />
          <Text style={styles.noteText}>{note}</Text>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={8}
      >
        {loading ? (
          <Loading />
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.messages}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 ? (
              <Text style={styles.emptyHint}>Aucun message pour l'instant. Écrivez le premier.</Text>
            ) : (
              messages.map((m) => {
                const mine = m.sender_role === currentRole;
                return (
                  <View key={m.id} style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowOther]}>
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                      <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.content}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Écrire un message…"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
          />
          <Pressable
            onPress={handleSend}
            disabled={!draft.trim() || sending}
            style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
          >
            <Ionicons name="send" size={18} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { padding: spacing.xs, marginLeft: -spacing.xs },
  headerText: { flex: 1 },
  title: { ...typography.name },
  subtitle: { ...typography.caption, color: colors.textMuted },
  noteBar: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.primaryLight, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  noteText: { ...typography.caption, color: colors.primaryDark, flex: 1 },
  messages: { padding: spacing.lg, gap: spacing.sm },
  emptyHint: { ...typography.caption, color: colors.textMuted, textAlign: "center", marginTop: spacing.xl },
  bubbleRow: { flexDirection: "row" },
  rowMine: { justifyContent: "flex-end" },
  rowOther: { justifyContent: "flex-start" },
  bubble: { maxWidth: "82%", borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: radius.sm },
  bubbleOther: { backgroundColor: colors.surface, borderBottomLeftRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  bubbleText: { ...typography.body, color: colors.text },
  bubbleTextMine: { color: colors.white },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  input: { flex: 1, maxHeight: 120, minHeight: 44, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, fontSize: 15, fontFamily: fonts.body, color: colors.text, backgroundColor: colors.surface },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { opacity: 0.4 },
});
