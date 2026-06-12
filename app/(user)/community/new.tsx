import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/providers/AuthProvider";
import { communityService, COMMUNITY_CATEGORIES, DEFAULT_CATEGORY } from "@/lib/community-service";
import { colors, radius, spacing, typography } from "@/theme";

export default function NewPost() {
  const { session } = useAuth();
  const router = useRouter();

  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>(DEFAULT_CATEGORY);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handlePublish() {
    if (!session?.user) return;
    const text = content.trim();
    if (!text) {
      Alert.alert("Publication vide", "Écrivez quelque chose avant de publier.");
      return;
    }
    setSaving(true);
    try {
      await communityService.createPost({
        userId: session.user.id,
        content: text,
        isAnonymous,
        category,
      });
      Alert.alert("Publié", "Votre publication a été partagée.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Publication échouée");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Nouvelle publication" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        <Input
          label="Votre message"
          value={content}
          onChangeText={setContent}
          placeholder="Partagez votre expérience, posez une question…"
          multiline
          numberOfLines={6}
          style={styles.textArea}
        />

        <Text style={styles.catLabel}>Catégorie</Text>
        <View style={styles.chips}>
          {COMMUNITY_CATEGORIES.map((c) => {
            const active = category === c;
            return (
              <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>

        <Card style={styles.anonRow}>
          <View style={styles.anonIcon}>
            <Ionicons name="eye-off-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.anonText}>
            <Text style={styles.anonTitle}>Publier anonymement</Text>
            <Text style={styles.anonHint}>Votre nom sera masqué et remplacé par « Anonyme ».</Text>
          </View>
          <Switch
            value={isAnonymous}
            onValueChange={setIsAnonymous}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </Card>

        <Button title="Publier" onPress={handlePublish} loading={saving} />
        <Button title="Annuler" variant="outline" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  textArea: { height: 140, textAlignVertical: "top", paddingTop: spacing.sm },
  catLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "700", marginTop: spacing.xs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, fontWeight: "700", color: colors.text },
  chipTextActive: { color: colors.white },
  anonRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  anonIcon: {
    width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  anonText: { flex: 1, gap: 2 },
  anonTitle: { ...typography.name },
  anonHint: { ...typography.caption, color: colors.textMuted },
});
