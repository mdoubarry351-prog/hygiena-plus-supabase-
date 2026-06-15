import { useEffect, useState, useCallback } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/providers/AuthProvider";
import { adminService } from "@/lib/admin-service";
import { hapticSuccess } from "@/lib/haptics";
import type { BannedWord } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

// Sévérités : libellé + couleur du badge (1=Modéré ambre, 2=Grave orange, 3=Critique rouge).
const SEVERITIES: { value: number; label: string; color: string }[] = [
  { value: 1, label: "Modéré", color: colors.accent },
  { value: 2, label: "Grave", color: colors.warning },
  { value: 3, label: "Critique", color: colors.danger },
];
const severityMeta = (s: number) => SEVERITIES.find((x) => x.value === s) ?? SEVERITIES[0];

export default function AdminBannedWords() {
  const { session } = useAuth();
  const [words, setWords] = useState<BannedWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Formulaire d'ajout
  const [newWord, setNewWord] = useState("");
  const [severity, setSeverity] = useState(1);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setWords(await adminService.getBannedWords());
    } catch {
      setWords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function submitAdd() {
    if (!session?.user) return;
    const w = newWord.trim();
    if (!w) { Alert.alert("Mot requis", "Saisissez un terme à interdire."); return; }
    setSaving(true);
    try {
      const created = await adminService.addBannedWord(session.user.id, w, severity);
      setWords((prev) => [created, ...prev]);
      setNewWord("");
      setSeverity(1);
      hapticSuccess();
    } catch (e) {
      Alert.alert("Ajout impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(word: BannedWord) {
    if (!session?.user) return;
    const next = !word.is_active;
    setWords((prev) => prev.map((x) => (x.id === word.id ? { ...x, is_active: next } : x)));
    try {
      await adminService.setBannedWordActive(session.user.id, word.id, next);
    } catch (e) {
      // rollback en cas d'échec
      setWords((prev) => prev.map((x) => (x.id === word.id ? { ...x, is_active: word.is_active } : x)));
      Alert.alert("Erreur", e instanceof Error ? e.message : "Action échouée");
    }
  }

  function confirmDelete(word: BannedWord) {
    if (!session?.user) return;
    Alert.alert(
      "Supprimer ce mot ?",
      `« ${word.word} » ne bloquera plus les publications ni les commentaires.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await adminService.deleteBannedWord(session.user.id, word.id);
              setWords((prev) => prev.filter((x) => x.id !== word.id));
            } catch (e) {
              Alert.alert("Erreur", e instanceof Error ? e.message : "Suppression échouée");
            }
          },
        },
      ]
    );
  }

  if (loading && words.length === 0) return <Loading />;

  return (
    <Screen>
      <AdminHeader title="Mots interdits" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={styles.subtitle}>
          Les publications et commentaires contenant un mot ACTIF sont automatiquement bloqués.
        </Text>

        {/* Formulaire d'ajout */}
        <Card style={styles.addCard}>
          <Text style={typography.h3}>Ajouter un mot</Text>
          <Input
            label="Terme à interdire"
            value={newWord}
            onChangeText={setNewWord}
            placeholder="Ex. insulte"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.fieldLabel}>Sévérité</Text>
          <View style={styles.sevRow}>
            {SEVERITIES.map((s) => {
              const active = severity === s.value;
              return (
                <Pressable
                  key={s.value}
                  onPress={() => setSeverity(s.value)}
                  style={[styles.sevChip, active && { backgroundColor: s.color, borderColor: s.color }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Sévérité ${s.label}`}
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.sevChipText, active && styles.sevChipTextActive]}>
                    {s.value} · {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Button title="Ajouter" onPress={submitAdd} loading={saving} />
        </Card>

        {/* Liste des mots */}
        {words.length === 0 ? (
          <EmptyState icon="shield-checkmark-outline" title="Aucun mot interdit" message="Ajoutez un terme pour activer le filtre." />
        ) : (
          words.map((w) => {
            const meta = severityMeta(w.severity);
            return (
              <Card key={w.id} style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={[styles.word, !w.is_active && styles.wordInactive]} numberOfLines={1}>{w.word}</Text>
                  <View style={styles.metaRow}>
                    <View style={[styles.badge, { backgroundColor: meta.color }]}>
                      <Text style={styles.badgeText}>{meta.label}</Text>
                    </View>
                    {!w.is_active ? <Text style={styles.inactiveTag}>Inactif</Text> : null}
                  </View>
                </View>
                <Switch
                  value={w.is_active}
                  onValueChange={() => toggleActive(w)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.white}
                />
                <Pressable onPress={() => confirmDelete(w)} hitSlop={8} style={styles.deleteBtn} accessibilityRole="button" accessibilityLabel={`Supprimer ${w.word}`}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </Card>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  subtitle: { ...typography.caption, color: colors.textMuted },
  addCard: { gap: spacing.sm },
  fieldLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "700" },
  sevRow: { flexDirection: "row", gap: spacing.sm },
  sevChip: { flex: 1, alignItems: "center", paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border },
  sevChipText: { ...typography.caption, fontWeight: "700", color: colors.text },
  sevChipTextActive: { color: colors.white },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowInfo: { flex: 1, gap: spacing.xs },
  word: { ...typography.name },
  wordInactive: { color: colors.textMuted, textDecorationLine: "line-through" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  badgeText: { ...typography.caption, color: colors.white, fontWeight: "700" },
  inactiveTag: { ...typography.caption, color: colors.textMuted, fontStyle: "italic" },
  deleteBtn: { padding: spacing.xs },
});
